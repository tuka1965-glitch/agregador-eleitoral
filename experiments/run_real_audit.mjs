// Real observations only. Run: node experiments/run_real_audit.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { estimateHouseEffects } from './house_effect_contemporaneous.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'experiments','real_data');
const out=path.join(root,'experiments','real_results');fs.mkdirSync(out,{recursive:true});
const polls=JSON.parse(fs.readFileSync(path.join(dir,'polls.json')));
const results=JSON.parse(fs.readFileSync(path.join(dir,'tse_results.json')));
const DAY=86400000, END='2026-10-23';
const at=x=>Date.parse(x), avg=x=>x.reduce((a,b)=>a+b,0)/x.length;
const key=p=>`${p.election}-${p.round}`;
const metric=err=>({n:err.length,mae:avg(err.map(Math.abs)),rmse:Math.sqrt(avg(err.map(x=>x*x))),mean_error:avg(err)});
const norm=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
function groupBy(items,fn){const m=new Map();for(const x of items){const k=fn(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;}
function write(name,data){fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');}
function long(ps){return ps.flatMap(p=>Object.entries(p.values).map(([candidate,value])=>({...p,candidate,value})));}
function eligible(all,cut,lag=2,strict=false){
  return all.filter(p=>{
    if(strict&&p.availability_basis==='field_end_plus_2_days_proxy')return false;
    const available=p.availability_basis==='field_end_plus_2_days_proxy'?new Date(at(p.field_end)+lag*DAY).toISOString().slice(0,10):p.available;
    return available<=cut&&p.field_end<=cut;
  });
}

// Extract actual legacy functions from the pinned branch, rather than approximating them.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
function extract(name){const start=app.indexOf(`function ${name}(`);assert(start>=0,name);let end=app.indexOf('\nfunction ',start+10);if(end<0)end=app.length;return app.slice(start,end);}
const funcs=['pollUnitsFromRows','bayesianMeanFromUnits','referenceLeaderFromLast10','computeHouseEffects'];
const context=vm.createContext({groupBy,normalizePollsterKey:norm,canonicalPollsterName:x=>x,pollsterQualityWeight:()=>1});
vm.runInContext(funcs.map(extract).join('\n')+'\nthis.legacy=computeHouseEffects;',context);
function legacyEffects(ps){
 const rows=ps.flatMap(p=>Object.entries(p.values).map(([candidate,pct])=>({scenario:`T${p.round}`,pollId:p.poll_id,scenarioIndex:1,pollster:p.pollster,dateMid:p.date,t:at(p.date),sample:p.election===2014?1000:p.sample,margin:p.margin,candidate,pct})));
 return context.legacy(rows);
}

const effectCache=new Map();
function effectsFor(ps,options={}){
  const token=ps.map(p=>p.poll_id).join(',')+JSON.stringify(options);
  if(!effectCache.has(token))effectCache.set(token,estimateHouseEffects(long(ps),options));
  return effectCache.get(token);
}
function aggregate(all,year,round,cut,model,{lag=2,strict=false,windowDays=7,priorSd=2,halfLife=21,equalInstitutes=false}={}){
 const available=eligible(all.filter(p=>p.election===year),cut,lag,strict);
 const ps=available.filter(p=>p.round===round).sort((a,b)=>at(a.date)-at(b.date)||a.poll_id.localeCompare(b.poll_id));
 if(!ps.length)return null;
 const latest=Math.max(...ps.map(p=>at(p.date))),target=at(cut+'T23:59:59Z');
 const window=ps.filter(p=>at(p.date)>=latest-halfLife*DAY);
 const candidates=[...new Set(ps.flatMap(p=>Object.keys(p.values)))];
 const recent=window.slice(-5),prior=window.slice(-10,-5);
 const strength=recent.length<5||prior.length<5?0:Math.max(...candidates.filter(c=>c!=='Outros').map(c=>Math.abs(avg(recent.map(p=>p.values[c]).filter(Number.isFinite))-avg(prior.map(p=>p.values[c]).filter(Number.isFinite)))));
 const hl=strength>=3?7:halfLife,latestTimes=new Set(recent.map(p=>at(p.date)));
 const old=model==='M1'?legacyEffects(available):new Map();
 const exp=model==='M2'?effectsFor(ps,{windowDays,priorSd}):{estimates:[]};
 const index=new Map(exp.estimates.map(e=>[`${e.pollster}|${e.candidate}`,e]));
 const weights=window.map(p=>{
  const he=old.get(norm(p.pollster));
  const hw=he&&he.n>2?Math.min(1.1,Math.max(.35,1/(1+Math.abs(he.effect)/4))):1;
  return Math.max(300,p.election===2014?1000:(p.sample||1000))*(p.margin?1/Math.max(.0001,p.margin*p.margin):1)*Math.pow(.5,Math.max(0,(target-at(p.date))/DAY)/hl)*hw*(latestTimes.has(at(p.date))?2:1);
 });
 if(equalInstitutes){for(const [inst,ix] of groupBy(window.map((p,i)=>i),i=>window[i].pollster)){const s=ix.reduce((a,i)=>a+weights[i],0);for(const i of ix)weights[i]/=s;}}
 const estimates={};
 for(const c of candidates){
  const vals=ps.map(p=>p.values[c]).filter(Number.isFinite);if(!vals.length)continue;
  const pw=equalInstitutes?0:2500;let sw=pw,sv=avg(vals)*pw;
  window.forEach((p,i)=>{let v=p.values[c];if(!Number.isFinite(v))return;
   if(model==='M1'){const he=old.get(norm(p.pollster));if(c!=='Outros'&&he&&he.n>2&&v>=15)v=Math.min(100,Math.max(0,v-.6*he.effect));}
   if(model==='M2'){const he=index.get(`${p.pollster}|${c}`);if(he?.effect!=null)v=Math.min(100,Math.max(0,v-he.effect));}
   sw+=weights[i];sv+=weights[i]*v;
  });estimates[c]=sv/sw;
 }
 const total=Object.values(estimates).reduce((a,b)=>a+b,0);
 for(const c of candidates)if(estimates[c]!=null)estimates[c]=100*estimates[c]/total;
 return {year,round,cutoff:cut,model,polls:ps.length,window_polls:window.length,pollsters:new Set(ps.map(p=>p.pollster)).size,proxy_publication:ps.filter(p=>p.availability_basis==='field_end_plus_2_days_proxy').length,effective_half_life:hl,estimates,poll_ids:ps.map(p=>p.poll_id)};
}

const config={data:'observed_real_polls_only',code_commit:'043d4e670d93e0ed4dcbdcfd376d11867160757d',asof:END,comparison:'Controlled substitution of house-effect component on the pinned-branch aggregation backbone; not a verified full Sites v3.0 reproduction.',half_life:21,prior_sd:2,window_days:7,minimum_rounds:3,minimum_peers:2,historical_quality_ratings:'disabled in all models because current ratings incorporate later elections',publication:'known dates used when available; otherwise end of fieldwork + 2 days, explicitly a proxy',metrics:'two eventual finalists, actual full valid-vote shares; each election-round equal weight',outcome_fitting:'none; no results or future elections enter estimation; default experimental parameters retained'};
write('config.json',config);

// Outcomes are used only after forecasts have been constructed.
const forecasts=[];
for(const [kr,truth] of Object.entries(results)){
 const [year,round]=kr.split('-').map(Number);
 const cuts=truth.values?[1,7,14].map(h=>[h,new Date(at(truth.date)-h*DAY).toISOString().slice(0,10)]):[[null,END]];
 for(const [h,cut] of cuts)for(const m of ['M0','M1','M2']){
  const f=aggregate(polls,year,round,cut,m);if(!f)continue;
  f.horizon=h;f.election_date=truth.date;
  f.errors=truth.values?Object.fromEntries(truth.focal.map(c=>[c,f.estimates[c]-truth.values[c]])):null;
  f.metrics=f.errors?metric(Object.values(f.errors)):null;forecasts.push(f);
 }
}
write('forecasts.json',forecasts);
const summary=[];
for(const years of [[2014,2018,2022],[2014,2018,2022,2026]])for(const h of [1,7,14])for(const m of ['M0','M1','M2']){
 const rows=forecasts.filter(f=>years.includes(f.year)&&f.horizon===h&&f.model===m&&f.errors);const err=rows.flatMap(f=>Object.values(f.errors));
 summary.push({years,horizon:h,model:m,election_rounds:rows.length,...metric(err)});
}
write('summary.json',summary);

// Per-institute effects as of the pre-election cutoff (or current date for the future runoff).
const effects=[],deviations=[];
for(const [kr,truth] of Object.entries(results)){
 const [y,r]=kr.split('-').map(Number),cut=truth.values?new Date(at(truth.date)-DAY).toISOString().slice(0,10):END;
 const ps=eligible(polls.filter(p=>p.election===y&&p.round===r),cut);
 const e=effectsFor(ps);effects.push(...e.estimates.map(row=>({...row,cutoff:cut})));
 deviations.push(...e.observations.map(row=>({election:row.election,round:row.round,pollster:row.pollster,candidate:row.candidate,poll_id:row.poll_id,date:row.date,reference:row.reference,deviation:row.deviation,peerInstitutes:row.peerInstitutes})));
}
write('effects.json',effects);write('deviations.json',deviations);

// Availability, peer-window and weighting sensitivity; never choose parameters using outcomes.
const sensitivity=[];
for(const options of [{lag:0},{lag:1},{lag:3},{lag:7},{strict:true},{windowDays:3},{windowDays:14},{priorSd:1},{priorSd:3},{equalInstitutes:true}]){
 for(const m of ['M0','M1','M2']){
  const rows=[];
  for(const [kr,t] of Object.entries(results)){if(!t.values)continue;const [y,r]=kr.split('-').map(Number);const cut=new Date(at(t.date)-DAY).toISOString().slice(0,10);const f=aggregate(polls,y,r,cut,m,options);if(!f)continue;rows.push({year:y,round:r,errors:t.focal.map(c=>f.estimates[c]-t.values[c]),polls:f.polls});}
  sensitivity.push({options,model:m,election_rounds:rows.length,...metric(rows.flatMap(x=>x.errors)),details:rows});
 }
}
write('sensitivity.json',sensitivity);

// Deterministic future-record deletion invariance on the real dataset.
let checks=0;
for(const f of forecasts){
 const subset=polls.filter(p=>p.field_end<=f.cutoff&&p.election<=f.year);
 const again=aggregate(subset,f.year,f.round,f.cutoff,f.model);
 assert.deepEqual(f.estimates,again.estimates);checks++;
 assert(f.poll_ids.every(id=>{const p=polls.find(p=>p.poll_id===id);return p.field_end<=f.cutoff&&p.available<=f.cutoff;}));checks++;
 assert(f.cutoff<f.election_date||!f.errors);checks++;
}
assert(effects.some(e=>e.pollster==='Datafolha'&&e.election==='2026'&&e.round==='2'&&e.n===3));checks++;
assert(!forecasts.some(f=>f.year===2026&&f.round===2&&f.errors));checks++;
assert(polls.every(p=>p.source&&p.raw&&p.field_start<=p.field_end));checks++;
const ids=polls.map(p=>p.poll_id);assert.equal(new Set(ids).size,ids.length);checks++;
const test={status:'passed',checks,synthetic_observations:0,polls:polls.length,outcome_independent_estimator:true,future_deletion_invariance:'passed for every forecast',publication_timestamp_certification:'incomplete; proxy availability explicitly reported'};write('real_data_checks.json',test);

console.log(JSON.stringify({checks:test,summary:summary.filter(x=>x.horizon===1),datafolha:effects.filter(e=>e.pollster==='Datafolha'&&results[`${e.election}-${e.round}`].focal.includes(e.candidate))},null,2));
