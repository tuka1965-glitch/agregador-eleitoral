"""Build an auditable dataset from retrieved observed poll tables. No generated polls."""
import json, re, pathlib, datetime as dt, unicodedata, collections
from lxml import html

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data'/'audit_sources'
OUT=ROOT/'experiments'/'real_data'
OUT.mkdir(parents=True,exist_ok=True)
MONTHS={'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12}
issues=[]

def clean(v):
    v=re.sub(r'【\d+†([^†】]+)(?:†[^】]+)?】',r'\1',v)
    v=re.sub(r'\^\{[^}]+\}|\[[^\]]*\]','',v)
    return re.sub(r'\s+',' ',v).strip()

def num(v):
    v=clean(v)
    if '<' in v:return None
    m=re.search(r'\d+(?:[.,]\d+)?',v)
    if not m:return None
    x=m[0]
    return float(x.replace('.','').replace(',','.')) if ',' in x else float(x)

def sample(v):
    m=re.search(r'\d[\d.\s]*',clean(v));return int(re.sub(r'\D','',m[0])) if m else None

def date_range(v,y):
    v=clean(v).lower()
    v=re.sub(r'20\d\d','',v)
    hits=list(re.finditer(r'(\d{1,2})\s*(?:(?:a|e|[-–—])\s*(\d{1,2}))?\s*(?:de\s*)?([a-zç]+)',v))
    hits=[h for h in hits if h[3][:3] in MONTHS]
    if not hits:raise ValueError(v)
    last=hits[-1];m=MONTHS[last[3][:3]];end=dt.date(y,m,int(last[2] or last[1]))
    if len(hits)>1:
        first=hits[0];start=dt.date(y,MONTHS[first[3][:3]],int(first[1]))
    elif last[2]:start=dt.date(y,m,int(last[1]))
    else:
        prefix=v[:last.start()];days=re.findall(r'\d{1,2}',prefix)
        d=int(days[-1]) if days else int(last[1]);sm=m-1 if d>end.day else m
        start=dt.date(y,sm,d)
    if start>end:raise ValueError(v)
    return start,end

def canonical(v):
    s=clean(v);k=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    for pats,n in [(['datafolha'],'Datafolha'),(['ibope'],'Ibope'),(['ipec'],'Ipec'),(['mda'],'CNT/MDA'),(['vox populi'],'Vox Populi'),(['realtime','real time'],'Real Time Big Data'),(['ipspe','ipespe'],'Ipespe'),(['parana'],'Paraná Pesquisas'),(['datapoder','poderdata'],'PoderData'),(['fsb'],'FSB'),(['quaest'],'Quaest'),(['atlas'],'AtlasIntel'),(['futura'],'Futura'),(['ideia'],'Ideia'),(['verita'],'Veritá'),(['brasmarket'],'Brasmarket'),(['gerp'],'Gerp'),(['nexus'],'Nexus'),(['brasilis'],'Brasilis'),(['sensus'],'Sensus'),(['ifp'],'IFP'),(['indexa'],'Indexa'),(['palver'],'Palver'),(['vox brasil','vox'],'Vox Brasil'),(['datatrends'],'DataTrends')]:
        if any(p in k for p in pats):return n
    return re.sub(r'\s*BR[-‐–]?\s*\d+/\d{4}.*','',s).strip()

def source_lines(y):
    d={}
    for p in sorted(DATA.glob(f'wiki-{y}-*.txt')):
        for n,v in re.findall(r'^L(\d+): ?(.*)$',p.read_text(),re.M):
            if int(n) in d and clean(d[int(n)])!=clean(v):issues.append({'type':'source_line_conflict','year':y,'line':n})
            d[int(n)]=v
    if y in [2014,2022]:
        p=DATA/'final-source-checks.txt'
        for n,v in re.findall(r'^L(\d+): ?(.*)$',p.read_text(),re.M):
            if (y==2022 and 500<=int(n)<590) or (y==2014 and 140<=int(n)<335):d[int(n)]=v
    return d

def record(y,r,inst,dtext,values,margin,sz,source,locator,residual=None,links=None,scenario='final_ballot',flags=None,release=None):
    start,end=date_range(dtext,y)
    # Keep only the stable final candidate regime; no pre-first-round runoff simulations.
    minimum={2014:dt.date(2014,8,21),2018:dt.date(2018,9,12),2022:dt.date(2022,8,16),2026:dt.date(2026,9,1)}[y] if r==1 else {2014:dt.date(2014,10,6),2018:dt.date(2018,10,8),2022:dt.date(2022,10,3),2026:dt.date(2026,10,5)}[y]
    if start<minimum:return None
    if not values or any(v is None or v<0 for v in values.values()):return None
    total=sum(values.values())
    if not 65<=total<=103:
        issues.append({'type':'invalid_candidate_total','year':y,'round':r,'pollster':inst,'date':dtext,'total':total,'locator':locator});return None
    if residual is not None and abs(total+residual-100)>(1.6 if r==2 else 3.1):
        issues.append({'type':'inconsistent_total_excluded','year':y,'round':r,'pollster':inst,'date':dtext,'total':total,'residual':residual,'locator':locator});return None
    flags=list(flags or [])
    if release:
        availability=release;basis='confirmed_publication'
    else:
        availability=(end+dt.timedelta(days=2)).isoformat();basis='field_end_plus_2_days_proxy';flags.append('publication_date_unverified')
    denom=total if r==2 or residual is None else 100-residual
    focal={2014:['Dilma','Aécio','Marina'],2018:['Haddad','Bolsonaro','Ciro','Alckmin','Amoêdo'],2022:['Lula','Bolsonaro','Tebet','Ciro'],2026:['Lula','Flávio','Cury','Caiado','Renan','Zema']}[y] if r==1 else list(values)
    valid={k:values[k]/denom*100 for k in focal if k in values}
    if r==1:valid['Outros']=100-sum(valid.values())
    return dict(election=y,round=r,scenario=scenario,pollster=canonical(inst),field_start=start.isoformat(),field_end=end.isoformat(),date=(dt.datetime.combine(start,dt.time())+(dt.datetime.combine(end,dt.time())-dt.datetime.combine(start,dt.time()))/2).isoformat(),available=availability,availability_basis=basis,sample=sz,margin=margin,raw=values,values=valid,denominator=denom,residual=residual,source=source,locator=locator,source_links=links or [],flags=flags)

polls=[]
for y in [2014,2018,2022]:
    d=source_lines(y);url=f'https://pt.wikipedia.org/wiki/Pesquisas_de_opinião_para_a_eleição_presidencial_no_Brasil_em_{y}'
    if y==2014:
        for n in range(164,231):
            line=d.get(n,'');cs=[clean(v) for v in line.split('|')]
            if len(cs)<8 or not re.fullmatch(r'\d+',cs[0]):continue
            r=1 if n<208 else 2
            names=['Dilma','Marina','Aécio','Everaldo','Luciana','Eduardo Jorge','Eymael','Levy','Mauro','Zé Maria','Rui'] if r==1 else ['Dilma','Aécio']
            if len(cs)!=4+len(names)+2:raise ValueError((y,n,len(cs)))
            vals={name:num(v) for name,v in zip(names,cs[4:4+len(names)])}
            if any(v is None for v in vals.values()):continue
            reference=re.search(r'\[([0-9]+)\]',line)
            release=None
            if reference:
                bib=next((clean(v) for v in d.values() if re.match(r'^\s*'+reference[1]+r'\. ',clean(v))),None)
                if bib:
                    m=re.search(r'\d{1,2} de [a-zç]+ de 2014',bib,re.I)
                    if m:release=date_range(m[0],2014)[1].isoformat()
            p=record(y,r,cs[2],cs[1],vals,num(cs[3]),None,url,f'line:{n}',sum(num(v) or 0 for v in cs[-2:]),flags=['sample_unavailable'],release=release)
            if p and release:p['availability_basis']='publication_date_in_bibliography'
            if p:polls.append(p)
    elif y==2018:
        # Flatten only complete rows; candidate labels in parentheses disambiguate parties.
        starts=[n for n in range(219,554) if re.match(r'^\d{1,2}[^|]*de 2018\s*\|',clean(d.get(n,'')))]
        for j,n in enumerate(starts):
            nxt=starts[j+1] if j+1<len(starts) else 553
            if any(k not in d for k in range(n,nxt)):raise ValueError(('missing row',y,n))
            text=' '.join(d[k] for k in range(n,nxt));text=re.sub(r'【\d+†([^†】]+)(?:†[^】]+)?】',r'\1',text)
            cs=[clean(v) for v in text.split('|')]
            # Additional candidate-description experiment is not an independent round.
            if len(cs)>15:cs=cs[:15]
            if len(cs)!=15:continue
            if 'Haddad' not in cs[4] or re.search(r'apoiad',cs[4],re.I):continue
            ns=['Haddad','Ciro','PSB','Marina','Meirelles','Dias','Alckmin','Amoêdo','Bolsonaro','Outros']
            vals={k:num(v) for k,v in zip(ns,cs[4:14]) if num(v) is not None}
            # PSB has no candidate after withdrawal; absent choices are omitted.
            links=re.findall(r'【\d+†[^†】]+†([^】]+)】',d[n])
            p=record(y,1,cs[1],cs[0],vals,num(cs[3]),sample(cs[2]),url,f'lines:{n}-{nxt-1}',num(cs[14]),links)
            if p:polls.append(p)
        for n in range(2768,2793):
            cs=[clean(v) for v in d.get(n,'').split('|')]
            if len(cs)!=7:continue
            vals={'Haddad':num(cs[4]),'Bolsonaro':num(cs[5])}
            p=record(y,2,cs[1],cs[0],vals,num(cs[3]),sample(cs[2]),url,f'line:{n}',num(cs[6]))
            if p:polls.append(p)
    else:
        for n in range(502,581):
            cs=[clean(v) for v in d.get(n,'').split('|')]
            if len(cs)!=18:continue
            ns=['Bolsonaro','Lula','Ciro','Tebet','Soraya','Felipe','Eymael','Sofia','Léo','Vera','Marçal','Kelmon','Outros']
            vals={k:num(v) for k,v in zip(ns,cs[4:17]) if num(v) is not None}
            p=record(y,1,cs[0],cs[1],vals,num(cs[3]),sample(cs[2]),url,f'line:{n}',num(cs[17]))
            if p:polls.append(p)
        for n in range(2067,2117):
            cs=[clean(v) for v in d.get(n,'').split('|')]
            if len(cs)!=7:continue
            vals={'Bolsonaro':num(cs[3]),'Lula':num(cs[4])}
            p=record(y,2,cs[0],cs[1],vals,None,sample(cs[2]),url,f'line:{n}',num(cs[5]),flags=['margin_unavailable'])
            if p:polls.append(p)

def grid(table):
    carry={};rows=[]
    for tr in table.xpath('./tr|./tbody/tr'):
        cells=tr.xpath('./td|./th');out={};col=0;new={}
        for c in cells:
            while col in carry:out[col]=carry[col][0];col+=1
            for sup in c.xpath('.//sup'):sup.getparent().remove(sup)
            value=clean(' '.join(c.itertext()))
            for k in range(int(c.get('colspan','1'))):
                out[col+k]=value
                if int(c.get('rowspan','1'))>1:new[col+k]=(value,int(c.get('rowspan'))-1)
            col+=int(c.get('colspan','1'))
        for k,v in carry.items():out.setdefault(k,v[0])
        carry={k:(v[0],v[1]-1) for k,v in carry.items() if v[1]>1};carry.update(new)
        rows.append([out.get(k,'') for k in range(max(out,default=-1)+1)])
    return rows

snapshot=json.loads((ROOT/'data'/'wikipedia-latest.json').read_text())
doc=html.fromstring(snapshot['payload']['parse']['text']['*'])
tables=doc.xpath('//table[contains(@class,"wikitable")]')
url='https://pt.wikipedia.org/wiki/Pesquisas_de_opinião_para_a_eleição_presidencial_no_Brasil_em_2026'
for ti in [2,3,21]:
    table=tables[ti]
    # Preserve reference URLs before grid strips footnotes.
    rawtrs=table.xpath('./tr|./tbody/tr');refs=[]
    for tr in rawtrs:
        links=[]
        for a in tr.xpath('.//sup//a'):
            target=doc.xpath('//*[@id=$id]',id=a.get('href','').lstrip('#'))
            if target:links.extend(target[0].xpath('.//a[starts-with(@href,"http")]/@href'))
        refs.append(list(dict.fromkeys(links)))
    names=[clean(' '.join(c.itertext())).split()[0] for c in rawtrs[1].xpath('./td|./th')]
    rows=grid(table)
    names=[{'Flávio':'Flávio','Lula':'Lula'}.get(v,v) for v in names]
    for ri,cs in enumerate(rows[3:],3):
        r=2 if ti==21 else 1
        if len(cs)<6 or not re.search(r'\d',cs[1]) or 'divulgado' in ' '.join(cs):continue
        # The first table contains a duplicate, contradictory Datafolha row.
        if ti==2 and ri==6:
            issues.append({'type':'duplicate_datafolha_conflict_excluded','locator':f'table:{ti}/row:{ri}','reason':'2002 sample conflicts with primary final 4006 interviews'});continue
        vals={};censored=[]
        for j,name in enumerate(names):
            if j+4>=len(cs):break
            if name in ['','Indecisos','Vantagem','Outros']:continue
            val=num(cs[j+4])
            if '<' in cs[j+4]:censored.append(name)
            if val is not None:vals[name]=val
        # Require exact percentages for all named choices, rather than imputing censored values.
        if censored:
            issues.append({'type':'censored_values_excluded','year':2026,'round':r,'pollster':cs[0],'date':cs[1],'locator':f'table:{ti}/row:{ri}','candidates':censored});continue
        if r==1:
            # Complete candidate roster + explicit Other value; keep missing dashes absent.
            otheridx=4+len(names)
            if otheridx<len(cs)-1 and num(cs[otheridx]) is not None:vals['Outros']=num(cs[otheridx])
            residual=num(cs[-1])
        else:residual=num(cs[6]) if len(cs)>6 else None
        if not {'Lula','Flávio'}.issubset(vals):continue
        if r==1 and len(vals)<5:
            issues.append({'type':'incomplete_first_round_scenario_excluded','pollster':cs[0],'date':cs[1],'locator':f'table:{ti}/row:{ri}'});continue
        release=None;flags=[];dtext=cs[1];sz=sample(cs[2])
        if r==1 and canonical(cs[0])=='Datafolha' and ti==2 and ri==3:
            dtext='2 Out – 3 Out';release='2026-10-03';flags=['field_start_corrected_from_primary']
        p=record(2026,r,cs[0],dtext,vals,num(cs[3]),sz,url,f'table:{ti}/row:{ri}',residual,refs[ri],flags=flags,release=release)
        if p:polls.append(p)

# Final duplicate protection: one pollster x fieldwork x scenario, identical rows collapsed.
seen={};final=[]
for p in polls:
    key=(p['election'],p['round'],p['pollster'],p['field_start'],p['field_end'],p['scenario'])
    if key in seen:
        issues.append({'type':'duplicate_collapsed','key':key,'same_values':seen[key]['values']==p['values'],'locator':p['locator']});continue
    seen[key]=p;p['poll_id']=f"{p['election']}-T{p['round']}-{len(final)+1:04d}";final.append(p)
final.sort(key=lambda p:(p['election'],p['round'],p['date'],p['pollster']))
# Explicitly verified published valid shares take priority over ratios of rounded totals.
published={
 (2014,1,'Datafolha','2014-10-04'):({'Dilma':44,'Aécio':26,'Marina':24,'Outros':6},'2014-10-04','https://datafolha.folha.uol.com.br/eleicoes/2014/10/1527380-dilma-lidera-com-44-aecio-26-e-marina-24-empatam-por-2-turno.shtml'),
 (2014,2,'Datafolha','2014-10-25'):({'Dilma':52,'Aécio':48},'2014-10-25','https://datafolha.folha.uol.com.br/eleicoes/2014/10/1538369-dilma-52-e-aecio-48-chegam-empatados-ao-dia-da-eleicao.shtml'),
 (2018,1,'Datafolha','2018-10-06'):({'Haddad':25,'Bolsonaro':40,'Ciro':15,'Alckmin':8,'Amoêdo':3,'Outros':9},'2018-10-06','https://www1.folha.uol.com.br/poder/2018/10/bolsonaro-alcanca-40-dos-votos-validos-no-datafolha-haddad-tem-25-e-ciro-15.shtml'),
 (2018,2,'Datafolha','2018-10-27'):({'Haddad':45,'Bolsonaro':55},'2018-10-27','https://www1.folha.uol.com.br/poder/2018/10/pesquisa-datafolha-mostra-bolsonaro-com-55-e-haddad-com-45-na-vespera-da-eleicao.shtml'),
 (2022,1,'Datafolha','2022-10-01'):({'Lula':50,'Bolsonaro':36,'Ciro':5,'Tebet':6,'Outros':3},'2022-10-01','https://datafolha.folha.uol.com.br/eleicoes/2022/10/na-vespera-da-eleicao-lula-tem-50-e-bolsonaro-36.shtml'),
 (2022,2,'Datafolha','2022-10-29'):({'Lula':52,'Bolsonaro':48},'2022-10-29','https://noticias.uol.com.br/eleicoes/2022/10/29/datafolha-lula-bolsonaro-segundo-turno.htm'),
 (2026,1,'Datafolha','2026-10-03'):({'Lula':45,'Flávio':42,'Cury':3,'Caiado':4,'Renan':3,'Zema':1,'Outros':2},'2026-10-03','https://datafolha.folha.uol.com.br/eleicoes/2026/10/na-vespera-da-eleicao-lula-tem-45-dos-validos-no-1o-turno-empatado-com-flavio-bolsonaro-42.shtml'),
}
for p in final:
    k=(p['election'],p['round'],p['pollster'],p['field_end'])
    if k in published:
        values,release,source=published[k];p['values']=values;p['available']=release;p['availability_basis']='confirmed_publication';p['source_links'].insert(0,source);p['flags'].append('published_valid_override')
        if k==(2014,1,'Datafolha','2014-10-04'):p['sample']=18116
        if k==(2014,2,'Datafolha','2014-10-25'):p['sample']=19318
        if k==(2022,2,'Datafolha','2022-10-29'):p['sample']=8320;p['flags'].append('sample_corrected_from_primary')
    elif p['election']==2026:
        dates=[]
        for link in p['source_links']:
            if 'archive.org' in link:continue
            m=re.search(r'/((?:2026)[/-]\d{2}[/-]\d{2})/',link)
            if m:
                day=m[1].replace('/','-')
                if day>=p['field_end'] and (dt.date.fromisoformat(day)-dt.date.fromisoformat(p['field_end'])).days<=7:dates.append(day)
        if dates:p['available']=min(dates);p['availability_basis']='dated_cited_source_url'
    if p['election']==2026 and p['pollster']=='Datafolha' and p['round']==2:
        p['available']=p['field_end'];p['availability_basis']='confirmed_publication'
    assert p['available']>=p['field_end'],p
(OUT/'polls.json').write_text(json.dumps(final,ensure_ascii=False,indent=2)+'\n')
(OUT/'exclusions.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'polls':len(final),'counts':dict(collections.Counter(f"{p['election']}-T{p['round']}" for p in final)),'issues':len(issues),'issue_types':dict(collections.Counter(i['type'] for i in issues))},ensure_ascii=False,indent=2))
