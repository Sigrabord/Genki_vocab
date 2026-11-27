// Японский ввод: ромадзи → хирагана, нормализация ответа
const rows={'':'あいうえお',k:'かきくけこ',s:'さしすせそ',t:'たちつてと',n:'なにぬねの',h:'はひふへほ',m:'まみむめも',r:'らりるれろ',g:'がぎぐげご',z:'ざじずぜぞ',d:'だぢづでど',b:'ばびぶべぼ',p:'ぱぴぷぺぽ'};
const T={};
for(const c in rows)[...'aiueo'].forEach((v,i)=>{T[c+v]=rows[c][i]});
Object.assign(T,{ya:'や',yu:'ゆ',yo:'よ',wa:'わ',wo:'を',shi:'し',chi:'ち',tsu:'つ',fu:'ふ',ji:'じ'});
const Y={ya:'ゃ',yu:'ゅ',yo:'ょ'};
for(const c of 'kgnhmrbp')for(const y in Y)T[c+y]=rows[c][1]+Y[y];
for(const [p,b] of [['sh','し'],['ch','ち'],['j','じ'],['sy','し'],['ty','ち'],['zy','じ'],['jy','じ'],['dy','ぢ'],['cy','ち']]){T[p+'a']=b+'ゃ';T[p+'u']=b+'ゅ';T[p+'o']=b+'ょ'}
const K2V={},V2K={a:'あ',i:'い',u:'う',e:'え',o:'お'};
for(const k in T){const v=k[k.length-1];if('aiueo'.includes(v))K2V[T[k][T[k].length-1]]=v}

export function romajiToHira(s){
  s=s.toLowerCase().replace(/[āâ]/g,'aa').replace(/[īî]/g,'ii').replace(/[ūû]/g,'uu').replace(/[ēê]/g,'ee').replace(/[ōô]/g,'ou');
  let out='',i=0;
  while(i<s.length){
    const ch=s[i];
    if(!/[a-z]/.test(ch)){out+=ch==="'"?'':ch;i++;continue}
    if(ch==='n'){const nx=s[i+1];if(!(nx&&/[aiueoy]/.test(nx))){out+='ん';i+=nx==="'"?2:1;continue}}
    if(i+1<s.length&&ch===s[i+1]&&!'aiueon'.includes(ch)){out+='っ';i++;continue}
    if(ch==='t'&&s.substr(i+1,2)==='ch'){out+='っ';i++;continue}
    let m=false;
    for(let l=3;l>=1;l--){const k=s.substr(i,l);if(T[k]){out+=T[k];i+=l;m=true;break}}
    if(!m){out+=ch;i++}
  }
  return out;
}
export const toHira=s=>s.replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function expandLong(s){let o='';for(const ch of s){if(ch==='ー'&&o){o+=V2K[K2V[o[o.length-1]]]||'';}else o+=ch}return o}
// каноническая форма для сравнения
export function canon(s){
  s=(s||'').normalize('NFKC').trim().toLowerCase();
  if(/[a-z]/.test(s)){s=s.replace(/-/g,'ー');s=romajiToHira(s)}
  s=expandLong(toHira(s));
  s=s.replace(/[\s〜~…・.,!?、。！？'’]/g,'');
  return s.replace(/([おこそとのほもよろをごぞどぼぽょ])う/g,'$1お').replace(/([えけせてねへめれげぜでべぺ])い/g,'$1え');
}
export function matches(input,w){
  const x=canon(input);if(!x)return false;
  const ok=(w.k||'').split('/').map(canon);
  if(w.j)ok.push(canon(w.j));
  return ok.includes(x);
}
