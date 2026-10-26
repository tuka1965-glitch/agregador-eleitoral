// Executes pinned production functions with uniform ratings and cutoff-safe inputs.
// It is a controlled reconstruction, NOT an archived full production forecast.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const context=vm.createContext({
  state:{houseEffects:new Map()},
  normalizePollsterKey:x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase(),
  canonicalPollsterName:x=>x,normalizeName:x=>x,pollsterQualityWeight:()=>1,
  HOUSE_EFFECT_CORRECTION:.6,REGIME_SHIFT_THRESHOLD:3,REGIME_HALF_LIFE_DAYS:7,MOMENTUM_POLL_COUNT:5,
});
vm.runInContext(fs.readFileSync(path.join(here,'vendor/election-model-core.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(here,'vendor/production-functions.js'),'utf8'),context);
const requests=JSON.parse(fs.readFileSync(0,'utf8'));
const outputs=[];
for(const request of requests){
  const {id,records,candidates,normalized,halfLife=21,robust=true}=request;
  const rows=records.flatMap(p=>Object.entries(normalized?p.values:p.original_scale).map(([candidate,pct])=>({
    scenario:'ballot',scenarioVariant:'final_ballot',pollId:p.poll_id,scenarioIndex:1,
    pollster:p.pollster,dateMid:p.date,t:Date.parse(p.date+'Z'),sample:p.sample,
    margin:normalized?p.margin_valid_scale:p.margin,candidate,pct,
  })));
  const target=Math.max(...rows.map(p=>p.t));
  const window=rows.filter(p=>p.t>=target-halfLife*86400000);
  context.state.houseEffects=context.computeHouseEffects(rows);
  const recent=context.recentPollTimes(window,'ballot');
  const hl=context.effectiveHalfLife(window,'ballot',candidates,halfLife);
  const estimates={},shares={};
  for(const candidate of candidates){
    const points=window.filter(p=>p.candidate===candidate).map(p=>({...p,isRecent:recent.has(p.t)}));
    const all=rows.filter(p=>p.candidate===candidate);
    const options=context.bayesianEstimateOptions(points,all,target,hl,candidate);
    if(!robust)options.studentTDegreesFreedom=1e12;
    const details=context.ElectionModelCore.weightedEstimateDetails(options);
    if(!details)throw Error(candidate+' missing');
    estimates[candidate]=details.estimate;
    shares[candidate]=details.entries.map(x=>({poll_id:x.point.pollId,weight:x.finalShare}));
  }
  const total=Object.values(estimates).reduce((s,x)=>s+x,0);
  for(const c of candidates)estimates[c]=100*estimates[c]/total;
  const focal=candidates.slice(0,2),weights={};
  for(const c of focal)for(const row of shares[c])weights[row.poll_id]=(weights[row.poll_id]||0)+row.weight/2;
  outputs.push({id,estimates,halfLife:hl,windowPolls:new Set(window.map(x=>x.pollId)).size,weights});
}
process.stdout.write(JSON.stringify(outputs));
