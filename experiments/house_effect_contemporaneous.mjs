// Experimental relative house effects; independent of production aggregation.
// Each observation: {pollster, date, election, round, scenario, candidate, value, sample}.
const day = 86400000;
const time = x => new Date(x).getTime();
const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;
export function estimateHouseEffects(polls, options={}) {
  const windowDays=options.windowDays??7, priorSd=options.priorSd??2;
  const minPeers=options.minPeers??2, minRounds=options.minRounds??3;
  const observations=[];
  for(const p of polls) {
    if(!Number.isFinite(p.value)||!Number.isFinite(time(p.date))) continue;
    const peers=polls.filter(q=>q.pollster!==p.pollster && q.election===p.election &&
      q.round===p.round && q.scenario===p.scenario && q.candidate===p.candidate &&
      Number.isFinite(q.value) && Math.abs(time(q.date)-time(p.date))<=windowDays*day);
    const institutions=new Set(peers.map(q=>q.pollster));
    if(institutions.size<minPeers) continue;
    // Equal total weight per peer institute to avoid repeated-fieldwork dominance.
    const groups=[...institutions].map(inst=>peers.filter(q=>q.pollster===inst));
    const reference=mean(groups.map(g=>{
      const weights=g.map(q=>Math.exp(-0.5*Math.pow((time(q.date)-time(p.date))/(3*day),2)));
      return g.reduce((s,q,i)=>s+q.value*weights[i],0)/weights.reduce((a,b)=>a+b,0);
    }));
    observations.push({...p,reference,deviation:p.value-reference,peerInstitutes:institutions.size});
  }
  const grouped=new Map();
  for(const o of observations) {
    const key=[o.pollster,o.election,o.round,o.scenario,o.candidate].join('|');
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(o);
  }
  const estimates=[];
  for(const [key,rows] of grouped) {
    // Conservative effective n: repeated polls within one fieldwork date count once.
    const unique=[...new Map(rows.map(r=>[r.date,r])).values()];
    const n=unique.length;
    const raw=mean(unique.map(r=>r.deviation));
    const variance=n>1?unique.reduce((s,r)=>s+(r.deviation-raw)**2,0)/(n-1):priorSd**2;
    const noise=Math.max(0.25,variance)/Math.max(1,n);
    const shrink=priorSd**2/(priorSd**2+noise);
    const effect=n>=minRounds?shrink*raw:null;
    const posteriorSd=Math.sqrt(priorSd**2*noise/(priorSd**2+noise));
    const [pollster,election,round,scenario,candidate]=key.split('|');
    estimates.push({pollster,election,round,scenario,candidate,n,raw,effect,
      ci95:effect===null?null:[effect-1.96*posteriorSd,effect+1.96*posteriorSd],
      status:n>=minRounds?'exploratory':'insufficient_data'});
  }
  return {method:'leave-one-institute-out-contemporaneous-v1',observations,estimates};
}
