import assert from 'node:assert/strict';
import {estimateHouseEffects} from './house_effect_contemporaneous.mjs';
const polls=[];
const dates=['2026-09-01','2026-09-08','2026-09-15','2026-09-22'];
for(let i=0;i<dates.length;i++){
  const base=40+i;
  for(const [pollster,delta] of [['Datafolha',2],['Instituto B',0],['Instituto C',0]]){
    polls.push({pollster,date:dates[i],election:'2026',round:1,scenario:'A',
      candidate:'Candidato X',value:base+delta,sample:1000});
  }
}
const result=estimateHouseEffects(polls);
const df=result.estimates.find(x=>x.pollster==='Datafolha');
assert.ok(df);
assert.equal(df.n,4);
assert.equal(df.raw,2);
assert.equal(df.status,'exploratory');
assert.ok(df.effect>0 && df.effect<=2);
assert.equal(result.observations.length,12);
const short=estimateHouseEffects(polls.slice(0,3));
assert.equal(short.estimates.find(x=>x.pollster==='Datafolha').status,'insufficient_data');
const isolated=estimateHouseEffects(polls.filter(x=>x.pollster==='Datafolha'));
assert.equal(isolated.observations.length,0);
const otherRound=estimateHouseEffects(polls.map(p=>({...p,round:2})));
assert.equal(otherRound.estimates.find(x=>x.pollster==='Datafolha').round,'2');
console.log(JSON.stringify({status:'ok',syntheticOnly:true,checks:6,
  example:{n:df.n,raw:df.raw,effect:df.effect,ci95:df.ci95}},null,2));
