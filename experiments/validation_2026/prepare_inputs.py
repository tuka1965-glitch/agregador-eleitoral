"""Freeze the analytical input; production data and prior audits remain unchanged."""
import copy
import hashlib
import json
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SITE = ROOT.parent / 'auditoria-2026-t0RahA'

def canonical(name):
    return {'BTG/Nexus':'Nexus', 'Meio/Ideia':'Ideia', 'PoderData/Aya':'PoderData', 'Ranking Pesquisa':'Ranking', 'Vox':'Vox Brasil', 'Genial/Quaest':'Quaest'}.get(name, name)

def prepare():
    old_path = ROOT / 'experiments/real_data/polls.json'
    old = json.loads(old_path.read_text())
    ps = copy.deepcopy(old)
    changes = []
    for p in ps:
        p['pollster'] = canonical(p['pollster'])
        p['input_origin'] = 'curated_20261023'
        p['hypothetical'] = False
        p['undecided_identified'] = None
        p['excluded_by_undecided'] = False
        # This is an analytical reconstruction of the old denominator, not a
        # claim to recover every originally rounded candidate percentage.
        p['original_scale'] = {k: v * p['denominator'] / 100 for k,v in p['values'].items()}
        p['margin_valid_scale'] = p['margin'] * 100 / p['denominator'] if p['margin'] else None
    # Selected first-round eligibility follows the documented primary audit.
    # Residual shares are NEVER used as a substitute for identified undecideds.
    for p in ps:
        if p['election'] != 2026 or p['round'] != 1:
            continue
        if p['field_end'] == '2026-10-03' and p['pollster'] in ['Datafolha','Quaest']:
            p['undecided_identified'] = 3.0
        if p['field_end'] == '2026-10-02' and p['pollster'] in ['Gerp','CNT/MDA']:
            p['available'] = '2026-10-03'
            p['availability_basis'] = 'documented_primary_audit_publication'
            p['publication_source'] = 'https://agregador-eleitoral.tuka1965.chatgpt.site/boletins/boletim-pos-eleitoral-2026-10-06.pdf'
            if p['pollster'] == 'CNT/MDA': p['undecided_identified'] = 4.7
            changes.append({'poll_id':p['poll_id'], 'change':'known 3 October publication from selected primary-source audit'})
        if (p['field_end'],p['pollster']) in [('2026-10-03','Futura'),('2026-10-02','AtlasIntel')]:
            p['undecided_identified'] = 2.4 if p['pollster']=='Futura' else 0.3
            p['excluded_by_undecided'] = True
            p['exclusion_source'] = 'https://agregador-eleitoral.tuka1965.chatgpt.site/boletins/boletim-pos-eleitoral-2026-10-06.pdf'
            changes.append({'poll_id':p['poll_id'],'change':'first-round exclusion: reliably identified undecideds below 3%; no such exclusion in runoff'})

    snapshot_path = SITE / 'data/bulletins/20261016-20261025/base-snapshot.json'
    snapshot = json.loads(snapshot_path.read_text())
    rows = [dict(zip(snapshot['pollFields'],r)) for r in snapshot['pollRows']]
    groups = {}
    for row in rows:
        if row['scenario']=='Segundo turno' and row['scenarioVariant']=='Lula × Flavio Bolsonaro':
            groups.setdefault(row['pollId'], []).append(row)
    matches = {(canonical(p['pollster']),p['field_start'],p['field_end']):p for p in ps if p['election']==2026 and p['round']==2}
    for i, (site_id, rs) in enumerate(groups.items()):
        first = rs[0]
        pair = {r['candidate']:r['pct'] for r in rs}
        if 'Lula' not in pair or 'Flavio Bolsonaro' not in pair: continue
        raw = {'Lula':pair['Lula'], 'Flávio':pair['Flavio Bolsonaro']}
        denominator = sum(raw.values())
        if not 0 < denominator <= 100.05:
            changes.append({'poll_id':site_id,'change':'rejected incomplete/inconsistent pair denominator','denominator':denominator})
            continue
        k=(canonical(first['pollster']),first['dateStart'],first['dateEnd'])
        if k in matches:
            matches[k]['active_snapshot_match'] = site_id
            continue
        p = {
            'election':2026,'round':2,'scenario':'final_ballot','pollster':k[0],
            'field_start':first['dateStart'],'field_end':first['dateEnd'],
            'date':first['dateMid']+'T00:00:00',
            'available':(date.fromisoformat(first['dateEnd'])+timedelta(days=2)).isoformat(),
            'availability_basis':'field_end_plus_2_days_proxy',
            'sample':first['sample'],'margin':first['margin'],
            'raw':raw,'original_scale':raw,
            'values':{c:100*v/denominator for c,v in raw.items()},
            'denominator':denominator,'residual':100-denominator,
            'margin_valid_scale':first['margin']*100/denominator if first['margin'] else None,
            'source':snapshot['metadata']['sourceUrl'],'locator':site_id,'source_links':[],
            'flags':['publication_date_unverified'],'poll_id':f'2026-SITE-T2-{i:04d}',
            'input_origin':'site_snapshot_20261026',
            'hypothetical':first['dateStart'] <= '2026-10-04',
            'undecided_identified':None,'excluded_by_undecided':False,
        }
        ps.append(p)

    # Final Datafolha: commissioned primary publication, before rounding.
    for p in ps:
        if p['election']==2026 and p['round']==2 and p['pollster']=='Datafolha' and p['field_end']=='2026-10-24':
            p['values']={'Lula':49.11,'Flávio':50.89}
            p['margin_valid_scale']=2.0
            p['available']='2026-10-24'
            p['availability_basis']='verified_primary_publication'
            p['publication_source']='https://www1.folha.uol.com.br/poder/2026/10/datafolha-flavio-bolsonaro-tem-51-dos-votos-validos-e-lula-49-em-empate-tecnico.shtml'
            p['source_links'].append(p['publication_source'])
            p['flags'].append('published_valid_shares_take_precedence_over_normalized_rounded_totals')
            changes.append({'poll_id':p['poll_id'],'change':'primary valid shares 50.89/49.11 and publication date verified; original total shares preserved separately'})
    # The publication dates below have direct contemporary reports, but are not
    # falsely labelled primary institute reports.
    contemporary = {
        ('Quaest','2026-10-24'):('2026-10-24','https://noticias.uol.com.br/eleicoes/2026/10/24/quaest-presidencial-segundo-turno-24-de-outubro.ghtm'),
        ('AtlasIntel','2026-10-23'):('2026-10-24','https://www.poder360.com.br/poder-eleicoes-2026/flavio-tem-508-dos-votos-validos-e-lula-492-diz-atlasintel/'),
    }
    for p in ps:
        evidence=contemporary.get((p['pollster'],p['field_end'])) if p['election']==2026 and p['round']==2 else None
        if evidence:
            p['available'],p['publication_source']=evidence
            p['availability_basis']='verified_contemporary_report'
            p['source_links'].append(p['publication_source'])
    # Old curated raw records sometimes omit minor candidates. Keep their
    # audited normalized vectors rather than inventing new interviews or shares.
    for p in ps:
        assert p['field_start'] <= p['field_end'] <= p['available'],p['poll_id']
        assert abs(sum(p['values'].values())-100)<1e-7,p['poll_id']
        p['quality_excluded'] = any(v < -1e-8 for v in p['values'].values())
        if p['quality_excluded']:
            changes.append({'poll_id':p['poll_id'],'change':'excluded in all models: negative category share in prior normalized input; original record retained without repair','values':p['values']})
        assert all(isinstance(v,(int,float)) for v in p['values'].values())
    identities=[(p['election'],p['round'],p['pollster'],p['field_start'],p['field_end']) for p in ps]
    duplicates=[x for x,n in Counter(identities).items() if n>1]
    assert not duplicates,duplicates
    truths=json.loads((ROOT/'experiments/real_data/tse_results.json').read_text())
    for turn in [1,2]:
        j=json.loads((HERE/f'inputs/tse-round-{turn}.json').read_text())
        cs=[c for a in j['carg'][0]['agr'] for part in a['par'] for c in part['cand']]
        n=int(j['v']['vvc']); assert sum(int(c['vap']) for c in cs)==n
        by={c['n']:100*int(c['vap'])/n for c in cs}
        vals={'Lula':by['13'],'Flávio':by['22']}
        if turn==1:
            vals.update({'Cury':by['70'],'Caiado':by['55'],'Renan':by['14'],'Zema':by['30']})
            vals['Outros']=100-sum(vals.values())
        truths[f'2026-{turn}']={'date':'2026-10-04' if turn==1 else '2026-10-25','focal':['Lula','Flávio'],'values':vals,'source':f'https://resultados.tse.jus.br/oficial/ele2026/{j["ele"]}/dados/br/br-c0001-e00{j["ele"]}-u.json','note':'finalized official totals; computed directly from integer votes'}
    metadata={
        'prepared_on':'2026-10-26','ancestor_commit':'3af6734e80dc78a466ee75fd0a09c0a4659a6308',
        'sites_source_commit':'e72e0b6e0b2f543b6658473e3d5d6f0dfef994ad',
        'curated_input_sha256':hashlib.sha256(old_path.read_bytes()).hexdigest(),
        'active_snapshot_sha256':hashlib.sha256(snapshot_path.read_bytes()).hexdigest(),
        'production_core_sha256':hashlib.sha256((HERE/'vendor/election-model-core.js').read_bytes()).hexdigest(),
        'polls':len(ps),'curated_polls':len(old),'added_rounds':len(ps)-len(old),
        'counts':dict(Counter(f'{p["election"]}-{p["round"]}' for p in ps)),
        'scope':'observed national polls only; prior source compilation plus frozen active Site snapshot; not a census or individual recertification',
        'availability':'main protocol keeps documented dates; unknown availability uses field end + 2 days, tested at lags 0,1,3,7 and documented-only subset',
        'first_round_undecided':'exclude identified values <3% only; missing values never replaced by residual; second round has zero undecided exclusions',
        'changes':changes,
    }
    for name,payload in [('polls.json',ps),('tse_results.json',truths),('provenance.json',metadata)]:
        (HERE/'inputs'/name).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in metadata.items() if k!='changes'},ensure_ascii=False,indent=2))

if __name__=='__main__': prepare()
