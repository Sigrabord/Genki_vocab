// Состояние приложения (localStorage) и расписание повторений
const KEY='genki.v1', DAY=86400000;
const defaults=()=>({v:1,cards:{},my:[],active:[1],days:{},set:{newPerDay:15,dir:'jr',style:'b',speak:true,mode:'cards'}});
export let S=load();
function load(){
  try{const r=JSON.parse(localStorage.getItem(KEY));if(r&&r.v===1){const d=defaults();return {...d,...r,set:{...d.set,...r.set}}}}catch(e){}
  return defaults();
}
export function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
export function replaceState(o){const d=defaults();S=Object.assign(S,d,o,{set:{...d.set,...(o.set||{})}});save()}
export function resetProgress(){S.cards={};S.days={};save()}
export const dayKey=(t=Date.now())=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

// g: 0 «не знаю», 1 «сложно», 2 «знаю»
export function calc(c,g){
  const n={ivl:c?c.ivl:0,ease:c?c.ease:2.3,reps:c?c.reps:0};
  if(g===0){n.ease=Math.max(1.3,n.ease-.2);n.ivl=0}
  else if(g===1){n.ease=Math.max(1.3,n.ease-.1);n.ivl=n.ivl<1?1:Math.max(n.ivl+1,Math.round(n.ivl*1.2))}
  else{n.ivl=n.ivl<1?1:n.ivl<2?3:Math.round(n.ivl*n.ease);if(n.reps>2)n.ease=Math.min(3,n.ease+.05)}
  return n;
}
export function grade(id,g){
  const now=Date.now();let c=S.cards[id];const isNew=!c;
  const n=calc(c,g);
  if(!c)c=S.cards[id]={ivl:0,ease:2.3,due:now,reps:0,lapses:0,d0:dayKey()};
  c.reps++;c.ease=n.ease;c.ivl=n.ivl;c.last=now;
  if(g===0){c.lapses++;c.due=now+10*60000}else c.due=now+n.ivl*DAY;
  const e=S.days[dayKey()]||(S.days[dayKey()]={r:0,n:0});e.r++;if(isNew){if(id.startsWith('my-'))e.m=(e.m||0)+1;else e.n++}
  save();return c;
}
// «выучено» — интервал не меньше 5 дней (3 верных ответа подряд в один день не считаются)
export const isLearned=c=>!!c&&c.ivl>=5;
export function streak(){
  let n=0,t=Date.now();
  if(!(S.days[dayKey(t)]||{}).r)t-=DAY;
  while((S.days[dayKey(t)]||{}).r){n++;t-=DAY}
  return n;
}
export const fmtIvl=(n,hard)=>n<1?'10 мин':n<30?Math.round(n)+' дн':Math.round(n/30)+' мес';
