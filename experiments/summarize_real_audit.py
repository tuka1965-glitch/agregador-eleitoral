"""Uncertainty and tables from observed deviations; no synthetic polling data."""
import json,pathlib,collections,datetime as dt,math,csv,hashlib
import numpy as np
from scipy.stats import t

ROOT=pathlib.Path(__file__).resolve().parents[1]
D=ROOT/'experiments'/'real_results'
load=lambda n:json.loads((D/n).read_text())
ps=json.loads((ROOT/'experiments/real_data/polls.json').read_text())
truth=json.loads((ROOT/'experiments/real_data/tse_results.json').read_text())
effects=load('effects.json');dev=load('deviations.json');forecasts=load('forecasts.json')

for e in effects:
    rows=[d for d in dev if str(d['election'])==e['election'] and str(d['round'])==e['round'] and d['pollster']==e['pollster'] and d['candidate']==e['candidate']]
    groups=collections.defaultdict(list)
    for d in rows:
        day=dt.datetime.fromisoformat(d['date']);groups[day.isocalendar()[:2]].append(d['deviation'])
    n=len(rows);g=len(groups);e['week_clusters']=g;e['weekly_ci95']=None
    if e['effect'] is not None and g>=3:
        shrink=e['effect']/e['raw'] if e['raw'] else 1
        se=math.sqrt(g/(g-1)*sum(sum(v-e['raw'] for v in xs)**2 for xs in groups.values())/n**2)*shrink
        width=max(float(t.ppf(.975,g-1))*se,(e['ci95'][1]-e['ci95'][0])/2)
        e['weekly_ci95']=[e['effect']-width,e['effect']+width]
    e['uncertainty_note']='Approximate interval with weekly cluster scores and Student t; conditional on peers and extraction. Not calibrated for common election error. No interval if fewer than 3 week clusters.'
(D/'effects_with_uncertainty.json').write_text(json.dumps(effects,ensure_ascii=False,indent=2)+'\n')

def export(name,rows):
    if not rows:return
    cols=list(dict.fromkeys(k for r in rows for k in r))
    with open(D/name,'w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=cols);w.writeheader()
        for r in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items()})

export('efeitos_por_instituto.csv',effects)
export('previsoes_e_erros.csv',forecasts)
export('comparacao_modelos.csv',load('summary.json'))
export('pesquisas_utilizadas.csv',ps)

paired=[]
for a,b in [('M2','M1'),('M2','M0')]:
    diffs=[]
    for k in truth:
        y,r=map(int,k.split('-'));fa=next((f for f in forecasts if f['year']==y and f['round']==r and f['model']==a and f['horizon']==1),None);fb=next((f for f in forecasts if f['year']==y and f['round']==r and f['model']==b and f['horizon']==1),None)
        if fa and fb and fa['metrics']:diffs.append((y,fa['metrics']['mae']-fb['metrics']['mae']))
    n=len(diffs);mu=np.mean([v for y,v in diffs]);groups=collections.defaultdict(list)
    for y,v in diffs:groups[y].append(v)
    g=len(groups);se=math.sqrt(g/(g-1)*sum(sum(v-mu for v in vs)**2 for vs in groups.values())/n**2);w=float(t.ppf(.975,g-1))*se
    paired.append({'contrast':f'{a}-{b}','delta_mae':float(mu),'ci95_election_cluster':[mu-w,mu+w],'elections':g,'election_rounds':n,'note':'Few clusters; descriptive, low power. Positive means M2 is worse.'})
(D/'paired_comparison.json').write_text(json.dumps(paired,ensure_ascii=False,indent=2)+'\n')

last=[]
for k,tr in truth.items():
    if not tr['values']:continue
    y,r=map(int,k.split('-'));xs=[p for p in ps if p['election']==y and p['round']==r and p['pollster']=='Datafolha'];p=max(xs,key=lambda p:p['field_end']);c=tr['focal'][0];o=tr['focal'][1]
    last.append({'year':y,'round':r,'candidate':c,'opponent':o,'published':p['values'][c],'official':tr['values'][c],'error':p['values'][c]-tr['values'][c],'opponent_error':p['values'][o]-tr['values'][o],'margin_error':(p['values'][c]-p['values'][o])-(tr['values'][c]-tr['values'][o]),'source':p['source_links'][0]})
(D/'datafolha_last_poll.json').write_text(json.dumps(last,ensure_ascii=False,indent=2)+'\n')

manifest={}
for p in [ROOT/'app.js',ROOT/'experiments/house_effect_contemporaneous.mjs',ROOT/'experiments/real_data/polls.json',ROOT/'experiments/real_data/tse_results.json',ROOT/'data/wikipedia-latest.json']:
    manifest[str(p.relative_to(ROOT))]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
(D/'input_checksums.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'paired':paired,'mean_signed_error_last_datafolha':np.mean([d['error'] for d in last]),'datafolha_current':[e for e in effects if e['pollster']=='Datafolha' and e['election']=='2026' and e['candidate']=='Lula'],'output_csv_files':4},ensure_ascii=False,indent=2))
