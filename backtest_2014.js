const PAGE_TITLE = "Pesquisas de opinião para a eleição presidencial no Brasil em 2014";
const API_URL = `https://pt.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE_TITLE)}&prop=text&format=json&origin=*`;

const FIRST_RESULTS = {
  Dilma: 41.59,
  Aecio: 33.55,
  Marina: 21.32,
  Luciana: 1.55,
  Everaldo: 0.75,
  "Eduardo Jorge": 0.61,
};

const SECOND_RESULTS = {
  Dilma: 51.64,
  Aecio: 48.36,
};

const RATED = [
  ["Datafolha", 3.16, 190, -0.4],
  ["Ibope", 3.34, 1089, -0.61],
  ["Ipec", 3.34, 1089, -0.61],
  ["MDA", 3.92, 29, -0.42],
  ["CNT/MDA", 3.92, 29, -0.42],
  ["Vox Populi", 4.29, 50, 0.07],
];

function cleanText(v) {
  return (v || "").replace(/<sup[\s\S]*?<\/sup>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
function key(v) {
  return cleanText(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "").toLowerCase();
}
const ratingMap = new Map(RATED.map(([n,e,p,s]) => [key(n), { e,p,s }]));
function rating(name) {
  const k = key(name);
  if (ratingMap.has(k)) return ratingMap.get(k);
  for (const [rk, rv] of ratingMap) if (k.includes(rk) || rk.includes(k)) return rv;
  return null;
}
function qualityWeight(name) {
  const r = rating(name);
  if (!r) return 1;
  return Math.min(2.2, Math.max(0.35, (4 / Math.max(2, r.e)) ** 2 * Math.exp(-0.18 * r.s) * Math.min(1.15, Math.max(0.75, Math.log10(r.p + 1) / 2))));
}
function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([a-z]+)="?([^"\s>]+)"?/gi)) out[m[1].toLowerCase()] = m[2];
  return out;
}
function cells(html) {
  return [...html.matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi)].map(m => {
    const a = attrs(m[2]);
    return { tag:m[1].toLowerCase(), text:cleanText(m[3]), colspan:+(a.colspan||1), rowspan:+(a.rowspan||1) };
  });
}
function grid(rows) {
  const carry=[];
  return rows.map(row => {
    const vals=[]; let col=0;
    const fill=()=>{while(carry[col]){vals[col]=carry[col].text; carry[col].n--; if(carry[col].n<=0) delete carry[col]; col++;}};
    row.forEach(c=>{ fill(); for(let i=0;i<c.colspan;i++){vals[col+i]=c.text;if(c.rowspan>1) carry[col+i]={text:c.text,n:c.rowspan-1};} col+=c.colspan;});
    fill(); return vals;
  });
}
function number(v){const m=cleanText(v).match(/-?\d+(?:[.,]\d+)?/); return m?+m[0].replace(".","").replace(",","."):null;}
function pct(v){const n=number(v); return n==null||n>100?null:n;}
function date(v){
  const mm={jan:0,janeiro:0,fev:1,fevereiro:1,mar:2,"março":2,marco:2,abr:3,abril:3,mai:4,maio:4,jun:5,junho:5,jul:6,julho:6,ago:7,agosto:7,set:8,setembro:8,out:9,outubro:9,nov:10,novembro:10,dez:11,dezembro:11};
  const ps=[...cleanText(v).toLowerCase().matchAll(/(\d{1,2})(?:\s*(?:a|e|-|–)\s*(\d{1,2}))?\s*(?:de\s*)?([a-zç]+)\s*(?:de\s*)?(20\d{2})?/gi)];
  if(!ps.length)return null; const p=ps.at(-1), mo=mm[p[3]]; if(mo==null)return null;
  return new Date((Date.UTC(+(p[4]||2014),mo,+p[1])+Date.UTC(+(p[4]||2014),mo,+(p[2]||p[1])))/2);
}
function candidate(header){
  if(/dilma/i.test(header)) return "Dilma";
  if(/a[eé]cio/i.test(header)) return "Aecio";
  if(/marina/i.test(header)) return "Marina";
  if(/luciana/i.test(header)) return "Luciana";
  if(/everaldo/i.test(header)) return "Everaldo";
  if(/eduardo jorge/i.test(header)) return "Eduardo Jorge";
  return null;
}
function parse(section, scenario){
  const polls=[];
  for(const tm of section.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)){
    const rs=[...tm[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>cells(m[1]));
    const hs=[], ds=[]; let body=false;
    rs.forEach(r=>{const hasTd=r.some(c=>c.tag==="td"); if(!body&&!hasTd)hs.push(r); else {body=true;ds.push(r);}});
    const hg=grid(hs), width=Math.max(0,...hg.map(r=>r.length)), parts=Array.from({length:width},()=>[]);
    hg.forEach(r=>r.forEach((t,i)=>{if(t&&!parts[i].includes(t))parts[i].push(t);}));
    const headers=parts.map(p=>p.join(" "));
    const dateCol=headers.findIndex(h=>/per[ií]odo|data/i.test(h));
    const instCol=headers.findIndex(h=>/instituto|contratante/i.test(h));
    const marginCol=headers.findIndex(h=>/margem/i.test(h));
    if(dateCol<0||instCol<0)continue;
    grid(ds).forEach(row=>{
      const d=date(row[dateCol]), pollster=cleanText(row[instCol]);
      if(!d||!pollster||/^\d+$/.test(pollster))return;
      const candidates={};
      headers.forEach((h,i)=>{const c=candidate(h), v=pct(row[i]); if(c&&v!=null)candidates[c]=v;});
      if(Object.keys(candidates).length<2)return;
      polls.push({scenario,pollster,t:d.getTime(),margin:number(row[marginCol]),candidates});
    });
  }
  return polls.sort((a,b)=>a.t-b.t);
}
function group(items, fn){return items.reduce((m,x)=>{const k=fn(x); if(!m.has(k))m.set(k,[]);m.get(k).push(x);return m;},new Map());}
function mean(polls,c,target,half,effects=new Map(),opts={}){
  const vals=polls.map(p=>p.candidates[c]).filter(v=>v!=null); if(!vals.length)return null;
  let ws=2500, vs=(vals.reduce((a,b)=>a+b,0)/vals.length)*ws;
  polls.forEach(p=>{let v=p.candidates[c]; if(v==null)return; const he=effects.get(key(p.pollster)); if(opts.houseCorrection&&he&&he.n>2&&v>=15)v-=opts.houseCorrection*he.effect;
    const recentBoost = opts.latestTimes?.has(p.t) ? (opts.momentumWeight || 1) : 1;
    const wt=(0.5**(Math.max(0,(target-p.t)/86400000)/half))*1000*(p.margin?1/Math.max(.0001,p.margin*p.margin):1)*qualityWeight(p.pollster)*(he&&he.n>2?Math.min(1.1,Math.max(.35,1/(1+Math.abs(he.effect)/4))):1)*recentBoost;
    ws+=wt;vs+=v*wt;});
  return vs/ws;
}
function leader(prev){const w=prev.slice(-10), cs=[...new Set(w.flatMap(p=>Object.keys(p.candidates)))];return cs.map(c=>({c,e:mean(w,c,w.at(-1)?.t||0,999999)})).filter(x=>x.e!=null).sort((a,b)=>b.e-a.e)[0];}
function effects(polls){const arr=[]; group(polls,p=>p.scenario).forEach(ps=>ps.forEach((p,i)=>{const l=leader(ps.slice(0,i)); if(!l)return; const v=p.candidates[l.c]; if(v!=null)arr.push({pollster:p.pollster,effect:v-l.e,abs:Math.abs(v-l.e)});})); return new Map([...group(arr,x=>key(x.pollster))].map(([k,v])=>[k,{n:v.length,effect:v.reduce((s,x)=>s+x.effect,0)/v.length,abs:v.reduce((s,x)=>s+x.abs,0)/v.length}]));}
function regimeStrength(polls,cands){
  const recent=polls.slice(-5), prior=polls.slice(-10,-5);
  if(recent.length<5||prior.length<5)return 0;
  return Math.max(...cands.map(c=>{
    const r=recent.map(p=>p.candidates[c]).filter(v=>v!=null);
    const q=prior.map(p=>p.candidates[c]).filter(v=>v!=null);
    if(!r.length||!q.length)return 0;
    return Math.abs(r.reduce((a,b)=>a+b,0)/r.length-q.reduce((a,b)=>a+b,0)/q.length);
  }));
}
function aggregate(polls,cutoff,cands,opts={}){
  const t=new Date(`${cutoff}T23:59:59Z`).getTime(), usable=polls.filter(p=>p.t<=t), he=effects(usable);
  const strength=regimeStrength(usable,cands);
  const half=opts.dynamicRegime && strength>=3 ? 7 : 14;
  const latestTimes=new Set(usable.slice(-5).map(p=>p.t));
  return Object.fromEntries(cands.map(c=>[c,mean(usable,c,t,half,he,{...opts,latestTimes})]));
}
function valid(est,cands){const s=cands.reduce((a,c)=>a+(est[c]||0),0);return Object.fromEntries(cands.map(c=>[c,s?est[c]/s*100:null]));}
function err(est,actual){return Object.fromEntries(Object.keys(actual).map(c=>[c,est[c]-actual[c]]));}
function mae(e){const v=Object.values(e).map(Math.abs);return v.reduce((a,b)=>a+b,0)/v.length;}
async function main(){
  const html=(await (await fetch(API_URL)).json()).parse.text["*"];
  const first=parse(html.slice(html.indexOf('id="Primeiro_turno"'),html.indexOf('id="Segundo_turno"')),"Primeiro turno");
  const ss=html.indexOf('id="Segundo_turno"'), se=Math.min(...[html.indexOf('id="Referências"',ss),html.length].filter(x=>x>ss));
  const second=parse(html.slice(ss,se),"Segundo turno");
  const c1=Object.keys(FIRST_RESULTS), c2=Object.keys(SECOND_RESULTS);
  const baseline1=valid(aggregate(first,"2014-10-04",c1),c1), improved1=valid(aggregate(first,"2014-10-04",c1,{houseCorrection:.6,dynamicRegime:true,momentumWeight:2}),c1);
  const baseline2=valid(aggregate(second,"2014-10-25",c2),c2), improved2=valid(aggregate(second,"2014-10-25",c2,{houseCorrection:.6,dynamicRegime:true,momentumWeight:2}),c2);
  console.log(JSON.stringify({counts:{first:first.length,second:second.length},baseline:{first:{valid:baseline1,errors:err(baseline1,FIRST_RESULTS),mae:mae(err(baseline1,FIRST_RESULTS))},second:{valid:baseline2,errors:err(baseline2,SECOND_RESULTS),mae:mae(err(baseline2,SECOND_RESULTS))}},improved:{first:{valid:improved1,errors:err(improved1,FIRST_RESULTS),mae:mae(err(improved1,FIRST_RESULTS))},second:{valid:improved2,errors:err(improved2,SECOND_RESULTS),mae:mae(err(improved2,SECOND_RESULTS))}}},null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
