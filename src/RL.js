export const Q = {};
export const α = 0.1, γ = 0.9, ε = 0.2;
export function key(s){ return `${s.distBin}-${s.playerDir}`; }
export function chooseAction(state){
  const acts = ['attack','approach','lunge_left','lunge_right'];
  if(Math.random()<ε) return acts[Math.floor(Math.random()*acts.length)];
  const row = Q[key(state)]|| (Q[key(state)] = Object.fromEntries(acts.map(a=>[a,0])));
  return Object.entries(row).sort((a,b)=>b[1]-a[1])[0][0];
}
export function updateQ(prev,act,reward,next){
  const acts = ['attack','approach','lunge_left','lunge_right'];
  const r = Q[key(prev)] || (Q[key(prev)] = Object.fromEntries(acts.map(a=>[a,0])));
  const n = Q[key(next)] || (Q[key(next)] = Object.fromEntries(acts.map(a=>[a,0])));
  r[act] += α*(reward + γ*Math.max(...Object.values(n)) - r[act]);
}