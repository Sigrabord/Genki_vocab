import {S} from './store.js';
export const CAT={n:'Существительное',r:'Глагол на -ru',u:'Глагол на -u',x:'Неправильный глагол',ai:'い-прилагательное',an:'な-прилагательное',o:'Прочее'};
export const GROUPS=[
  {id:'n',name:'Существительные',cats:['n']},
  {id:'v',name:'Глаголы',cats:['r','u','x']},
  {id:'o',name:'Прочее: прилагательные, наречия, выражения',cats:['ai','an','o']}
];
export const catGroup=c=>c==='n'?'n':['r','u','x'].includes(c)?'v':'o';
let BASE=[],LESSONS=[],cache=null;
export async function loadBase(){
  const r=await fetch('textbook/genki.json');if(!r.ok)throw new Error('genki.json: '+r.status);
  LESSONS=(await r.json()).lessons;BASE=[];
  for(const l of LESSONS)for(const w of l.words)BASE.push({...w,n:l.n});
  cache=null;
}
export const lessons=()=>LESSONS;
export function invalidate(){cache=null}
export function words(){
  if(!cache){const all=BASE.concat(S.my.map(w=>({...w,n:0})));cache={list:all,map:new Map(all.map(w=>[w.id,w]))}}
  return cache.list;
}
export const byId=id=>{words();return cache.map.get(id)};
export const written=w=>w.j||w.k;
