"""Deterministic ablations with real polls, cutoff controls and chronological scoring.

Run: python experiments/validation_2026/run_experiment.py
No network calls, no production mutation, no outcome-dependent point estimator.
"""
import csv
import hashlib
import json
import math
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from scipy.stats import norm

HERE=Path(__file__).resolve().parent
DAY=86400
MODELS=['B0','B1','R0','R1','R2','R3','R4']
HORIZONS=[1,7,14]

def load(name): return json.loads((HERE/name).read_text())
def stamp(value): return datetime.fromisoformat(value.replace('Z','')).replace(tzinfo=timezone.utc).timestamp()
def average(values): return float(np.mean(values)) if len(values) else None
def close(values):
    total=sum(values.values())
    if total<=0: raise ValueError('empty composition')
    return {k:100*v/total for k,v in values.items()}

def simplex(v):
    """Euclidean projection of forecasts only; never modifies poll observations."""
    v=np.asarray(v,dtype=float)
    u=np.sort(v)[::-1]; css=np.cumsum(u)-100
    rho=np.where(u-css/np.arange(1,len(u)+1)>0)[0][-1]
    return np.maximum(v-css[rho]/(rho+1),0)

def available_on(p,lag=2):
    if p['availability_basis']=='field_end_plus_2_days_proxy':
        return (datetime.fromisoformat(p['field_end'])+timedelta(days=lag)).date().isoformat()
    return p['available']

def eligible(polls,year,turn,cutoff,reset=True,lag=2,strict=False):
    first_date={2014:'2014-10-05',2018:'2018-10-07',2022:'2022-10-02',2026:'2026-10-04'}[year]
    return sorted([p for p in polls
        if p['election']==year and p['round']==turn
        and not p.get('quality_excluded',False)
        and not (turn==1 and p.get('excluded_by_undecided',False))
        and p['field_end']<=cutoff and available_on(p,lag)<=cutoff
        and (not strict or p['availability_basis']!='field_end_plus_2_days_proxy')
        and (not reset or turn!=2 or p['field_start']>first_date)
    ],key=lambda p:(p['date'],p['poll_id']))

def window(ps,days=21):
    if not ps:return []
    latest=max(stamp(p['date']) for p in ps)
    return [p for p in ps if stamp(p['date'])>=latest-days*DAY]

def cap_institutes(weights,houses,cap=.25):
    weights=np.asarray(weights,dtype=float).copy()
    if len(set(houses))<4:return weights
    for _ in range(30):
        changed=False
        for house in sorted(set(houses)):
            ix=np.array([h==house for h in houses]); total=weights.sum(); group=weights[ix].sum()
            if group>cap*total+1e-10:
                target=cap/(1-cap)*(total-group)
                weights[ix]*=target/group;changed=True
        if not changed:break
    return weights

def poll_se(p):
    margin=p.get('margin_valid_scale')
    if margin and margin>0:return margin/1.96
    return 100*math.sqrt(.25/max(100,p.get('sample') or 1000))

def conditional_gap_sd(ps,weights,focal):
    """Shared conservative approximation, not an exact model posterior.

    Repeated rounds from one institute are treated as perfectly correlated for
    sampling error; robust between-poll dispersion is retained in full.
    """
    used=[p for p in ps if p['poll_id'] in weights]
    if not used:return None
    a,b=focal
    gaps=np.array([p['values'][a]-p['values'][b] for p in used])
    se=np.array([2*poll_se(p) for p in used])
    mad=np.median(np.abs(gaps-np.median(gaps)))
    between=max(0,(1.4826*mad)**2-float(np.median(se**2)))
    clusters=defaultdict(float)
    for p,s in zip(used,se):clusters[p['pollster']]+=abs(weights[p['poll_id']])*s
    sampling=sum(v*v for v in clusters.values())
    return float(math.sqrt(max(1e-10,sampling+between)))

def joint_estimate(ps,candidates,cutoff,slope_prior_sd=.15,house_prior_sd=2):
    ps=window(ps)
    houses=sorted(set(p['pollster'] for p in ps)); n=len(ps)
    target=stamp(cutoff+'T12:00:00')
    ages=np.array([(stamp(p['date'])-target)/DAY for p in ps])
    X=np.zeros((n,2+len(houses)));X[:,0]=1;X[:,1]=ages
    for i,p in enumerate(ps):X[i,2+houses.index(p['pollster'])]=1
    Y=np.array([[p['values'][c] for c in candidates] for p in ps])
    weights=np.array([.5**(max(0,-age)/21)/(poll_se(p)**2) for p,age in zip(ps,ages)])
    weights=cap_institutes(weights,[p['pollster'] for p in ps])
    penalty=np.diag([0,1/slope_prior_sd**2]+[1/house_prior_sd**2]*len(houses))
    precision=X.T@(weights[:,None]*X)+penalty
    beta=np.linalg.solve(precision,X.T@(weights[:,None]*Y))
    estimates=dict(zip(candidates,map(float,simplex(beta[0]))))
    # Linear influence of each observed row on the intercept (can be negative
    # under extrapolation). The interval below remains an approximation.
    influence=np.linalg.solve(precision,np.eye(len(precision))[:,0])@X.T*weights
    return estimates,{p['poll_id']:float(w) for p,w in zip(ps,influence)}, {
        'window_polls':n,'slope_pp_day':dict(zip(candidates,map(float,beta[1]))),
        'houses':len(houses),'projection_applied':not np.allclose(beta[0],simplex(beta[0])),
    }

def point_forecasts(polls,metadata,lag=2,strict=False,joint_options=None):
    requests=[];rows=[]
    for election,truth in metadata.items():
        year,turn=map(int,election.split('-'))
        candidates=list(truth['focal'])+[c for c in truth['candidates'] if c not in truth['focal']]
        for horizon in HORIZONS:
            cut=(datetime.fromisoformat(truth['date'])-timedelta(days=horizon)).date().isoformat()
            for model in MODELS:
                reset=model not in ['R0','R1']
                ps=eligible(polls,year,turn,cut,reset,lag,strict)
                if not ps:continue
                ws=window(ps)
                identity=f'{year}-{turn}-{horizon}-{model}'
                item={'id':identity,'year':year,'round':turn,'horizon':horizon,'cutoff':cut,'model':model,
                    'polls':len(ps),'window_polls':len(ws),'institutes':len(set(p['pollster'] for p in ws)),
                    'proxy_polls':sum(p['availability_basis']=='field_end_plus_2_days_proxy' for p in ps),
                    'window_hypothetical':sum(p.get('hypothetical',False) for p in ws),
                    'poll_ids':[p['poll_id'] for p in ps],
                    'max_field_end':max(p['field_end'] for p in ps),
                    'max_available':max(available_on(p,lag) for p in ps),
                    'focal':truth['focal'],'_ps':ps,
                }
                if model in ['B0','B1']:
                    if model=='B0':
                        last={p['pollster']:p for p in ws}; ws=list(last.values())
                    estimates={c:average([p['values'][c] for p in ws]) for c in candidates}
                    item['estimates']=close(estimates)
                    item['_weights']={p['poll_id']:1/len(ws) for p in ws}
                elif model=='R3':
                    estimates,weights,diagnostics=joint_estimate(ps,candidates,cut,**(joint_options or {}))
                    item.update(estimates=estimates,_weights=weights,joint_diagnostics=diagnostics)
                else:
                    requests.append({'id':identity,'records':ps,'candidates':candidates,'normalized':model!='R0','robust':model!='R4'})
                rows.append(item)
    native=[]
    if requests:
        result=subprocess.run(['node',str(HERE/'production_adapter.mjs')],input=json.dumps(requests),text=True,capture_output=True,check=True)
        native=json.loads(result.stdout)
    lookup={r['id']:r for r in native}
    for row in rows:
        if row['id'] in lookup:
            out=lookup[row['id']]
            row['estimates']=out['estimates'];row['_weights']=out['weights'];row['effective_half_life']=out['halfLife']
        row['conditional_margin_sd']=conditional_gap_sd(row['_ps'],row['_weights'],row['focal'])
        row.pop('_ps');row.pop('_weights')
        assert row['max_available']<=row['cutoff'] and row['max_field_end']<=row['cutoff']
        assert abs(sum(row['estimates'].values())-100)<1e-7
        assert all(v>=-1e-8 for v in row['estimates'].values())
    return rows

def score_points(points,truths):
    scored=[]
    for p in points:
        row=dict(p);truth=truths[f'{p["year"]}-{p["round"]}']['values']
        errors={c:p['estimates'][c]-truth[c] for c in p['focal']}
        all_errors={c:p['estimates'][c]-truth[c] for c in p['estimates']}
        a,b=p['focal']; predicted=p['estimates'][a]-p['estimates'][b]; observed=truth[a]-truth[b]
        row.update(errors=errors,all_errors=all_errors,mae=average(list(map(abs,errors.values()))),mse=average([e*e for e in errors.values()]),
            all_mae=average(list(map(abs,all_errors.values()))),predicted_margin=predicted,observed_margin=observed,
            margin_error=predicted-observed,correct_order=predicted*observed>0)
        scored.append(row)
    return scored

def chronological_uncertainty(scored):
    rows=[]
    for p in scored:
        train=[x for x in scored if x['model']==p['model'] and x['horizon']==p['horizon'] and x['year']<p['year']]
        years=sorted(set(x['year'] for x in train))
        if len(years)<2:continue
        # Each cycle has one weight, regardless of the number of turns/cuts.
        excess=average([average([x['margin_error']**2-x['conditional_margin_sd']**2 for x in train if x['year']==y]) for y in years])
        common_variance=max(0,excess)
        sd=math.sqrt(p['conditional_margin_sd']**2+common_variance)
        for name,sigma in [('conditional',p['conditional_margin_sd']),('with_common_election_error',sd)]:
            mu=p['predicted_margin'];lo=mu-1.96*sigma;hi=mu+1.96*sigma;actual=p['observed_margin']
            probability=float(np.clip(norm.cdf(mu/sigma),1e-9,1-1e-9)); outcome=int(actual>0)
            interval_score=hi-lo+40*max(lo-actual,0)+40*max(actual-hi,0)
            rows.append({'year':p['year'],'round':p['round'],'horizon':p['horizon'],'model':p['model'],'uncertainty':name,
                'train_years':years,'common_margin_sd':math.sqrt(common_variance),'conditional_margin_sd':p['conditional_margin_sd'],
                'margin_low':lo,'margin_high':hi,'covered':lo<=actual<=hi,'width':hi-lo,'interval_score_95':interval_score,
                'probability_a_ahead':probability,'outcome_a_ahead':outcome,'brier':(probability-outcome)**2,
                'log_loss':-math.log(probability if outcome else 1-probability),
                'note':'nominal Gaussian approximation; only prior cycles; not certified prospective calibration'})
    return rows

def summaries(scored):
    output=[]
    for model in MODELS:
        for horizon in HORIZONS:
            rows=[x for x in scored if x['model']==model and x['horizon']==horizon]
            if not rows:continue
            output.append({'model':model,'horizon':horizon,'election_rounds':len(rows),'cycles':len(set(x['year'] for x in rows)),
                'mae':average([x['mae'] for x in rows]),'rmse':math.sqrt(average([x['mse'] for x in rows])),
                'absolute_margin_error':average([abs(x['margin_error']) for x in rows]),
                'correct_order':sum(x['correct_order'] for x in rows),'all_category_mae':average([x['all_mae'] for x in rows])})
    return output

def paired_comparisons(scored):
    out=[];rng=np.random.default_rng(20261026)
    for model in ['R1','R2','R3','R4']:
        for baseline in ['B0','R0']:
            differences=[]
            for year in [2014,2018,2022,2026]:
                a=[r['mae'] for r in scored if r['model']==model and r['year']==year and r['horizon']==1]
                b=[r['mae'] for r in scored if r['model']==baseline and r['year']==year and r['horizon']==1]
                differences.append({'year':year,'delta_mae':average(a)-average(b)})
            ds=np.array([r['delta_mae'] for r in differences]);draws=ds[rng.integers(0,len(ds),size=(20000,len(ds)))].mean(axis=1)
            out.append({'model':model,'baseline':baseline,'mean_delta_mae':float(ds.mean()),'improved_cycles':int((ds<0).sum()),
                'worst_cycle_regression':float(ds.max()),'bootstrap_cycle_interval_95':list(map(float,np.quantile(draws,[.025,.975]))),
                'cycles':differences,'note':'descriptive cluster bootstrap with only four cycles; not a reliable significance test'})
    return out

def write_csv(path,rows):
    if not rows:return
    fields=list(dict.fromkeys(key for row in rows for key in row))
    with path.open('w',newline='') as file:
        writer=csv.DictWriter(file,fieldnames=fields);writer.writeheader()
        for r in rows:writer.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v for k,v in r.items()})

def run():
    polls=load('inputs/polls.json');truths=load('inputs/tse_results.json')
    metadata={k:{'date':v['date'],'focal':v['focal'],'candidates':list(v['values'])} for k,v in truths.items()}
    # Construct ALL point estimates before any outcome scoring or calibration.
    points=point_forecasts(polls,metadata)
    variants={}
    for lag in [0,1,3,7]:variants[f'publication_lag_{lag}']=point_forecasts(polls,metadata,lag=lag)
    variants['documented_only']=point_forecasts(polls,metadata,strict=True)
    for options in [{'slope_prior_sd':.10},{'slope_prior_sd':.30},{'house_prior_sd':1.0},{'house_prior_sd':4.0}]:
        key='joint_'+json.dumps(options,sort_keys=True)
        # Keep the complete variant to preserve identically filtered benchmarks.
        variants[key]=point_forecasts(polls,metadata,joint_options=options)
    scored=score_points(points,truths)
    uncertainty=chronological_uncertainty(scored)
    sensitivity=[{'variant':name,'summary':summaries(score_points(ps,truths))} for name,ps in variants.items()]
    main=summaries(scored);paired=paired_comparisons(scored)
    uncertainty_summary=[]
    for model in MODELS:
        for name in ['conditional','with_common_election_error']:
            rs=[r for r in uncertainty if r['model']==model and r['uncertainty']==name and r['horizon']==1]
            uncertainty_summary.append({'model':model,'uncertainty':name,'election_rounds':len(rs),
                'coverage':average([int(r['covered']) for r in rs]),'mean_width':average([r['width'] for r in rs]),
                'interval_score_95':average([r['interval_score_95'] for r in rs]),'brier':average([r['brier'] for r in rs]),'log_loss':average([r['log_loss'] for r in rs])})
    hashes={str(p.relative_to(HERE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((HERE/'inputs').glob('*.json'))}
    hashes['protocol.json']=hashlib.sha256((HERE/'protocol.json').read_bytes()).hexdigest()
    for p in sorted((HERE/'vendor').glob('*.js')):hashes[str(p.relative_to(HERE))]=hashlib.sha256(p.read_bytes()).hexdigest()
    payload={'protocol':load('protocol.json'),'input_hashes':hashes,'point_summary':main,'paired_comparisons':paired,
        'uncertainty_summary':uncertainty_summary,'sensitivity':sensitivity,'forecasts':scored,'uncertainty':uncertainty,
        'decision':{'production_changed':False,'automatically_promoted':None,'reason':'experimental retrospective results; report cross-cycle comparisons and uncertainty before any production decision'}}
    (HERE/'results/experiment.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    write_csv(HERE/'results/point_summary.csv',main)
    write_csv(HERE/'results/forecasts.csv',scored)
    write_csv(HERE/'results/uncertainty.csv',uncertainty)
    print(json.dumps({'main_D1':[r for r in main if r['horizon']==1],
        '2026_D1':[{k:r[k] for k in ['model','round','estimates','mae','margin_error','correct_order','polls','window_hypothetical']} for r in scored if r['year']==2026 and r['horizon']==1],
        'uncertainty_D1':uncertainty_summary},ensure_ascii=False,indent=2))

if __name__=='__main__':run()
