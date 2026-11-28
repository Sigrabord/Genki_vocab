import {S,save,grade,calc,isLearned,dayKey,streak,fmtIvl,replaceState,resetProgress} from './store.js';
import {loadBase,lessons,words,byId,invalidate,written,CAT,GROUPS,catGroup} from './data.js';
import {say,canSpeak,listVoices,setVoice} from './speech.js';
import {canon,matches,romajiToHira,toHira} from './kana.js';

const $=s=>document.querySelector(s);
const view=$('#view'),title=$('#title'),back=$('#back'),toastEl=$('#toast');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const toast=m=>{toastEl.textContent=m;toastEl.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>toastEl.classList.remove('show'),2200)};

let SES=null,lessonFilter='all',hideTr=false,query='';
const spk=(w)=>{if(!say(w))toast('Озвучка не поддерживается в этом браузере')};

/* ---------- статистика ---------- */
function stats(){
  const now=Date.now(),W=words(),d=S.days[dayKey()]||{};
  const calc=L=>{let due=0,learned=0,learning=0;for(const w of L){const c=S.cards[w.id];if(!c)continue;if(c.due<=now)due++;isLearned(c)?learned++:learning++}return {due,learned,learning,total:L.length}};
  const g=calc(W.filter(w=>w.n>0)),o=calc(W.filter(w=>w.n===0));
  g.pool=newPool().length;g.newLeft=Math.max(0,Math.min(g.pool,S.set.newPerDay-(d.n||0)));
  o.pool=ownPool().length;o.newLeft=Math.max(0,Math.min(o.pool,S.set.newPerDay-(d.m||0)));
  return {...g,own:o,newToday:d.n||0};
}
const newPool=()=>words().filter(w=>w.n>0&&!S.cards[w.id]&&S.active.includes(w.n));
const ownPool=()=>words().filter(w=>w.n===0&&!S.cards[w.id]);
const status=w=>{const c=S.cards[w.id];return !c?['новое','']:isLearned(c)?['выучено','lvl0']:c.lapses>0&&c.ivl<2?['трудное','lvl2']:['учу','lvl1']};

/* ---------- разметка ---------- */
const row=w=>{const [st,cl]=status(w);return `<div class="word-row" data-id="${w.id}">
  <button class="ic" data-act="say" data-id="${w.id}" aria-label="Озвучить">🔊</button>
  <div class="grow"><div class="jw jp"><span class="es">${esc(written(w))}</span>${w.j?`<span class="rd">${esc(w.k)}</span>`:''}</div>
  <div class="tr"><div class="ru">${esc(w.ru)}</div><div class="mut small">${esc(w.en)}</div></div></div>
  <span class="chip ${cl}">${st}</span></div>`};
const grouped=(list)=>GROUPS.map(g=>{
  const ws=list.filter(w=>g.cats.includes(w.c));if(!ws.length)return '';
  let inner='';
  if(g.cats.length>1){for(const c of g.cats){const x=ws.filter(w=>w.c===c);if(x.length)inner+=`<div class="sub">${CAT[c]} · ${x.length}</div>`+x.map(row).join('')}}
  else inner=ws.map(row).join('');
  return `<div class="sec-title">${g.name} · ${ws.length}</div><div class="c tight">${inner}</div>`}).join('');

/* ---------- маршрутизация ---------- */
function route(){
  const p=(location.hash||'#/today').slice(2).split('/');const name=p[0]||'today';
  document.querySelectorAll('.tabs a').forEach(a=>a.classList.toggle('on',a.dataset.tab===name));
  back.hidden=!(p[1]);
  const f={today,lessons:p[1]?lesson:lessonsView,review:p[1]==='run'?run:reviewView,my,settings}[name]||today;
  f(p[1]);view.scrollTop=0;
}
addEventListener('hashchange',route);
back.onclick=()=>history.length>1?history.back():(location.hash='#/today');

/* ---------- Сегодня ---------- */
function today(){
  title.textContent='genki.uchit';
  const st=stats(),d=S.days[dayKey()]||{r:0,n:0};
  const pct=st.total?Math.round(st.learned/st.total*100):0;
  view.innerHTML=`<div class="c hero stack"><div style="opacity:.85">К повторению сегодня</div><div class="big">${st.due}</div>
    <div>${st.newLeft?`+ ${st.newLeft} новых слов`:'Новых слов на сегодня нет'}</div>
    <a class="btn" href="#/review" data-act="scopeDue">${st.due+st.newLeft?'Начать':'Выбрать режим'}</a></div>
    <div class="c stack"><div class="row"><b>Выучено</b><span>${st.learned} из ${st.total} (${pct}%)</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="row mut"><span>В изучении: ${st.learning}</span><span>Серия: ${streak()} дн.</span></div></div>
    <div class="c row"><span>Сегодня повторено</span><b>${d.r}</b></div>
    ${S.my.length?`<div class="c stack"><div class="row"><b>Свой урок</b><span>выучено ${st.own.learned} из ${S.my.length}</span></div>
    <a class="btn ghost" href="#/review" data-act="scopeOwn">Повторить: ${st.own.due} + ${st.own.newLeft} новых</a></div>`:''}
    <div class="sec-title">Уроки в изучении</div>
    <div class="c stack"><div class="btns">${S.active.slice().sort((a,b)=>a-b).map(n=>`<a class="chip on" href="#/lessons/${n}">Урок ${n}</a>`).join('')||'<span class="mut">Не выбрано</span>'}</div>
    <a class="btn ghost" href="#/lessons">Выбрать уроки</a></div>`;
}

/* ---------- Уроки ---------- */
function lessonsView(){
  title.textContent='Уроки';
  view.innerHTML=`<input class="inp" id="q" placeholder="Поиск: слово, кана, ромадзи, перевод" value="${esc(query)}" autocomplete="off">
  <div id="out" class="stack"></div>`;
  const out=$('#out'),q=$('#q');
  const draw=()=>{
    query=q.value.trim();
    if(query){
      const k=canon(query),t=query.toLowerCase();
      const r=words().filter(w=>(w.j&&w.j.includes(query))||canon(w.k).includes(k)||w.ru.toLowerCase().includes(t)||w.en.toLowerCase().includes(t)).slice(0,60);
      out.innerHTML=r.length?`<div class="c tight">${r.map(row).join('')}</div>`:'<div class="empty-note">Ничего не найдено</div>';return;
    }
    out.innerHTML=lessons().map(l=>{
      const done=l.words.filter(w=>isLearned(S.cards[w.id])).length,pc=Math.round(done/l.words.length*100);
      return `<a class="c lesson" href="#/lessons/${l.n}"><div class="num">${l.n}</div>
      <div class="grow"><b>Урок ${l.n}</b> <span class="mut">${l.part}</span><div class="mut small">${l.words.length} слов · выучено ${done}</div><div class="bar" style="margin-top:6px"><i style="width:${pc}%"></i></div></div>
      ${S.active.includes(l.n)?'<span class="chip on">учу</span>':''}</a>`}).join('')+
      (()=>{const O=words().filter(w=>w.n===0),dn=O.filter(w=>isLearned(S.cards[w.id])).length;
        return `<a class="c lesson" href="#/lessons/my" style="margin-top:30px"><div class="num">★</div><div class="grow"><b>Свой урок</b><div class="mut small">${O.length?`${O.length} ваших слов · выучено ${dn}`:'Пока пусто — добавьте слова во вкладке «Мои слова»'}</div>${O.length?`<div class="bar" style="margin-top:6px"><i style="width:${Math.round(dn/O.length*100)}%"></i></div>`:''}</div></a>`})()
  };
  q.oninput=draw;draw();
}
function lesson(n){
  const own=n==='my';n=own?0:+n;const L=own?{part:'Ваши слова'}:lessons().find(l=>l.n===n);if(!L){location.hash='#/lessons';return}
  title.textContent=own?'Свой урок':'Урок '+n;
  const ws=words().filter(w=>w.n===n),list=lessonFilter==='all'?ws:ws.filter(w=>catGroup(w.c)===lessonFilter);
  const act=S.active.includes(n),done=ws.filter(w=>isLearned(S.cards[w.id])).length;
  view.innerHTML=`<div class="c stack"><div class="row"><span class="mut">${L.part} · ${ws.length} слов</span><span>выучено ${done}</span></div>
    <div class="btns">${own?`<a class="btn" href="#/my">+ Добавить слово</a>`:`<button class="btn ${act?'ghost':''}" data-act="toggleLesson" data-n="${n}">${act?'✓ В изучении':'Учить этот урок'}</button>`}
    ${ws.length?`<a class="btn line" href="#/review" data-act="scopeLesson" data-n="${own?'my':n}">Повторить урок</a>`:''}</div></div>
    <div class="seg">${[['all','Все'],['n','Сущ.'],['v','Глаголы'],['o','Прочее']].map(([k,t])=>`<button class="${lessonFilter===k?'on':''}" data-act="filter" data-k="${k}">${t}</button>`).join('')}</div>
    <label class="check"><input type="checkbox" id="hide" ${hideTr?'checked':''}><span>Скрыть перевод (нажмите на слово, чтобы показать)</span></label>
    <div class="${hideTr?'hid':''}" id="wl">${grouped(list)||`<div class="empty-note">${own?'Здесь будут слова, которые вы добавите сами. Они не смешиваются со словами Genki.':'Нет слов'}</div>`}</div>`;
  $('#hide').onchange=e=>{hideTr=e.target.checked;$('#wl').classList.toggle('hid',hideTr)};
}

/* ---------- Повторение: выбор режима ---------- */
let scope='due',mode=S.set.mode;
function reviewView(){
  title.textContent='Повторить';SES=null;
  const st=stats(),L=lessons();
  const weak=words().filter(w=>{const c=S.cards[w.id];return w.n>0&&c&&c.lapses>0&&!isLearned(c)}).length;
  view.innerHTML=`<div class="c stack"><div class="sec-title" style="margin:0">Режим</div>
    <div class="seg">${[['cards','Карточки'],['quiz','Тест'],['type','Писать'],['listen','На слух']].map(([k,t])=>`<button class="${mode===k?'on':''}" data-act="mode" data-k="${k}">${t}</button>`).join('')}</div>
    ${mode==='cards'||mode==='quiz'?`<div class="seg">${[['jr','Японский → русский'],['rj','Русский → японский']].map(([k,t])=>`<button class="${S.set.dir===k?'on':''}" data-act="dir" data-k="${k}">${t}</button>`).join('')}</div>`:''}
    <div class="mut small">${{cards:'Показать слово, вспомнить, оценить себя.',quiz:'Выбрать правильный вариант из четырёх.',type:'Увидеть перевод и набрать чтение: кана или ромадзи (neko, ねこ).',listen:'Прослушать слово и выбрать перевод.'}[mode]}</div></div>
    <div class="c stack"><div class="sec-title" style="margin:0">Что повторять</div>
    <select class="inp" id="sc">
      <option value="due">По расписанию (Genki): ${st.due} к повторению + ${st.newLeft} новых</option>
      ${L.map(l=>`<option value="l${l.n}">Урок ${l.n} целиком (${l.words.length})</option>`).join('')}
      <option value="weak">Трудные слова Genki (${weak})</option>
      <optgroup label="Свой урок (только ваши слова)"><option value="mydue">По расписанию: ${st.own.due} к повторению + ${st.own.newLeft} новых</option><option value="my">Весь свой урок (${S.my.length})</option></optgroup></select>
    <button class="btn" data-act="start">Начать</button></div>`;
  $('#sc').value=scope;$('#sc').onchange=e=>scope=e.target.value;
}
function buildQueue(){
  const W=words(),now=Date.now(),isDue=w=>{const c=S.cards[w.id];return c&&c.due<=now};
  let q=[];
  if(scope==='due')q=shuffle(W.filter(w=>w.n>0&&isDue(w))).concat(newPool().slice(0,stats().newLeft));
  else if(scope==='mydue')q=shuffle(W.filter(w=>w.n===0&&isDue(w))).concat(ownPool().slice(0,stats().own.newLeft));
  else if(scope==='my')q=shuffle(W.filter(w=>w.n===0));
  else if(scope[0]==='l')q=shuffle(W.filter(w=>w.n===+scope.slice(1)));
  else q=shuffle(W.filter(w=>{const c=S.cards[w.id];return w.n>0&&c&&c.lapses>0&&!isLearned(c)}));
  return q.map(w=>w.id);
}

/* ---------- Повторение: сессия ---------- */
function startSession(){
  const q=buildQueue();
  if(!q.length){toast('Нечего повторять — выберите другой набор');return}
  const own=scope==='my'||scope==='mydue';
  if(own&&(mode==='quiz'||mode==='listen')&&S.my.length<2){toast('Для теста и аудирования нужно минимум 2 своих слова');return}
  S.set.mode=mode;save();
  SES={own,q,i:0,ok:0,no:0,mode,dir:S.set.dir,redo:{},total:q.length,flip:false,locked:false};
  location.hash='#/review/run';
}
function pickOptions(w,dir){
  const g=catGroup(w.c),key=x=>dir==='jr'?x.ru:written(x);
  const base=words().filter(x=>(SES.own?x.n===0:x.n>0)&&x.id!==w.id&&key(x)!==key(w));
  let pool=base.filter(x=>catGroup(x.c)===g);if(pool.length<3)pool=base;
  const seen=new Set([key(w)]),opts=[];
  for(const x of shuffle(pool)){if(!seen.has(key(x))){seen.add(key(x));opts.push(x)}if(opts.length===3)break}
  return shuffle(opts.concat(w));
}
function run(){
  if(!SES){location.hash='#/review';return}
  title.textContent='Повторение';
  const id=SES.q[SES.i];if(!id)return finish();
  const w=byId(id);if(!w){SES.i++;return run()}
  SES.locked=false;SES.flip=false;
  const bar=`<div class="bar"><i style="width:${Math.round(SES.i/SES.q.length*100)}%"></i></div><div class="row mut small"><span>${SES.i+1} из ${SES.q.length}</span><span>✓ ${SES.ok} · ✗ ${SES.no}</span></div>`;
  const sp=`<button class="ic" data-act="say" data-id="${w.id}" aria-label="Озвучить">🔊</button>`;
  let body='';
  if(SES.mode==='cards'){
    const jr=SES.dir==='jr';
    const front=jr?`<div class="word jp big">${esc(written(w))}</div>`:`<div class="word">${esc(w.ru)}</div><div class="mut">${esc(w.en)}</div>`;
    const backH=(jr?`${w.j?`<div class="rdbig jp">${esc(w.k)}</div>`:''}<div class="word">${esc(w.ru)}</div><div class="mut">${esc(w.en)}</div>`
      :`<div class="word jp big">${esc(written(w))}</div>${w.j?`<div class="rdbig jp">${esc(w.k)}</div>`:''}`)+`<div><span class="chip">${CAT[w.c]}</span></div>`;
    const c=S.cards[w.id];
    body=`<div class="flash" id="fl"><div class="face fb-front"><div class="stack" style="justify-items:center">${front}${jr?sp:''}<div class="mut small">нажмите, чтобы показать ответ</div></div></div>
      <div class="face fb-back"><div class="stack" style="justify-items:center">${backH}${sp}</div></div></div>
      <div class="grade" id="gr" hidden>${[[0,'Не знаю'],[1,'Сложно'],[2,'Знаю']].map(([g,t])=>`<button data-act="g" data-g="${g}">${t}<small>${g===0?'10 мин':fmtIvl(calc(c,g).ivl)}</small></button>`).join('')}</div>`;
  }else if(SES.mode==='type'){
    body=`<div class="c stack" style="text-align:center"><div class="mut">Напишите чтение (кана или ромадзи)</div><div class="q-prompt">${esc(w.ru)}</div><div class="mut">${esc(w.en)}</div><span class="chip" style="justify-self:center">${CAT[w.c]}</span></div>
      <input class="inp jp" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="neko / ねこ"><div id="rom" class="mut small" style="min-height:1.4em"></div>
      <button class="btn" data-act="check">Проверить</button><div id="fb"></div>`;
  }else{
    const jr=SES.dir==='jr'||SES.mode==='listen',opts=pickOptions(w,jr?'jr':'rj');
    const prompt=SES.mode==='listen'?`<button class="ic listen" data-act="say" data-id="${w.id}" style="width:72px;height:72px;font-size:30px;margin:auto">🔊</button><div class="mut">Что это значит?</div>`
      :jr?`<div class="q-prompt jp">${esc(written(w))}</div>${w.j?`<div class="mut jp">${esc(w.k)}</div>`:''}${sp}`:`<div class="q-prompt">${esc(w.ru)}</div><div class="mut">${esc(w.en)}</div>`;
    body=`<div class="c stack" style="text-align:center;justify-items:center">${prompt}</div><div class="opts">${opts.map(o=>`<button class="opt ${jr?'':'jp'}" data-act="opt" data-id="${o.id}">${jr?esc(o.ru):`${esc(written(o))}${o.j?`<div class="mut small">${esc(o.k)}</div>`:''}`}</button>`).join('')}</div><div id="fb"></div>`;
  }
  view.innerHTML=`<div class="stack">${bar}${body}</div>`;
  if(SES.mode==='listen')setTimeout(()=>spk(w),250);
  if(SES.mode==='type'){const a=$('#ans');a.focus();a.oninput=()=>{$('#rom').textContent=/[a-z]/i.test(a.value)?romajiToHira(a.value):''};a.onkeydown=e=>{if(e.key==='Enter')ACT.check()}}
}
function reveal(){const fl=$('#fl');if(!fl||SES.flip)return;SES.flip=true;fl.classList.add('flip');$('#gr').hidden=false;if(S.set.speak&&SES.dir==='jr')spk(byId(SES.q[SES.i]))}
function advance(g){
  const id=SES.q[SES.i];grade(id,g);
  if(g===0){SES.no++;SES.redo[id]=(SES.redo[id]||0)+1;if(SES.redo[id]<=2)SES.q.push(id)}else SES.ok++;
  SES.i++;run();
}
function answerChoice(ok,w,html){
  if(SES.locked)return;SES.locked=true;
  const fb=$('#fb');
  fb.innerHTML=`<div class="fb ${ok?'ok':'bad'} stack">${html}${ok?'':'<button class="btn" data-act="next">Дальше</button>'}</div>`;
  if(ok)setTimeout(()=>advance(2),700);else SES.pending=0;
}
function finish(){
  title.textContent='Готово';const t=SES.ok+SES.no,acc=t?Math.round(SES.ok/t*100):0;const sc=SES;SES=null;
  view.innerHTML=`<div class="c hero stack"><div class="big">Сессия окончена</div><div>Верных ответов: ${sc.ok} из ${t} (${acc}%)</div></div>
  <a class="btn" href="#/review">Ещё раз</a><a class="btn ghost" href="#/today">На главную</a>`;
}

/* ---------- Мои слова и настройки ---------- */
function my(){
  title.textContent='Мои слова';
  view.innerHTML=`<div class="c stack"><b>Добавить слово</b>
    <div class="field"><label>Написание (кандзи или кана)</label><input class="inp jp" id="mj" autocomplete="off"></div>
    <div class="field"><label>Чтение (кана; можно ромадзи)</label><input class="inp jp" id="mk" autocomplete="off"></div>
    <div class="field"><label>Перевод</label><input class="inp" id="mr" autocomplete="off"></div>
    <div class="field"><label>Английский (необязательно)</label><input class="inp" id="me" autocomplete="off"></div>
    <div class="field"><label>Тип</label><select class="inp" id="mc">${Object.entries(CAT).map(([k,v])=>`<option value="${k}" ${k==='n'?'selected':''}>${v}</option>`).join('')}</select></div>
    <button class="btn" data-act="addMy">Добавить</button></div>
  ${S.my.length?`<div class="sec-title">Свой урок · ${S.my.length} слов</div><div class="c tight">${S.my.map(w=>`<div class="word-row"><div class="grow"><div class="jw jp"><span class="es">${esc(written(w))}</span>${w.j?`<span class="rd">${esc(w.k)}</span>`:''}</div><div class="ru">${esc(w.ru)}</div></div><button class="ic" data-act="delMy" data-id="${w.id}" aria-label="Удалить">✕</button></div>`).join('')}</div>`:''}`;
}

/* ---------- Настройки ---------- */
const STYLES=[['a','Сиеста','#d6372b',''],['b','Тетрадь','#2f5bd3',''],['c','Тёмная','#121212','#8ab4f8'],['d','Чёрно-жёлтая','#0d0d0d','#ffd000'],['e','Чёрно-красная','#0d0d0d','#e53935']];
const THEME_COLOR={a:'#d6372b',b:'#2f5bd3',c:'#121212',d:'#0d0d0d',e:'#0d0d0d'};
function applyStyle(){
  document.documentElement.dataset.style=S.set.style;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content',THEME_COLOR[S.set.style]||'#2f5bd3');
}
function settings(){
  title.textContent='Настройки';
  const vs=listVoices();
  view.innerHTML=`<div class="c stack"><b>Стиль</b><div class="styles">${STYLES.map(([k,t,bg,br])=>`<button data-act="style" data-k="${k}" class="${S.set.style===k?'on':''}"><span class="sw" style="background:${bg};${br?`border:2px solid ${br}`:''}"></span>${t}</button>`).join('')}</div></div>
  <div class="c stack"><b>Обучение</b>
    <div class="field"><label>Новых слов в день</label><select class="inp" id="npd">${[5,10,15,20,30,50].map(n=>`<option ${S.set.newPerDay===n?'selected':''}>${n}</option>`).join('')}</select></div>
    <label class="check"><input type="checkbox" id="spk" ${S.set.speak?'checked':''}><span>Озвучивать слово при показе ответа</span></label></div>
  <div class="c stack"><b>Озвучка</b>
    ${vs.length?`<select class="inp" id="voice"><option value="">Автоматически</option>${vs.map(v=>`<option value="${esc(v.voiceURI)}" ${v.voiceURI===S.set.voice?'selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select><button class="btn ghost" data-act="testVoice">Проверить звук</button>`
    :`<div class="mut small">${canSpeak()?'Японский голос не найден. На Android: Настройки → Специальные возможности → Синтез речи → установить японский язык.':'Озвучка не поддерживается в этом браузере.'}</div>`}</div>
  <div class="c stack"><b>Резервная копия</b><div class="mut small">Прогресс хранится только в этом браузере. Сохраните копию, чтобы перенести его на другое устройство.</div>
    <div class="btns"><button class="btn ghost" data-act="export">Скачать копию</button><label class="btn ghost" style="cursor:pointer">Загрузить копию<input type="file" id="imp" accept="application/json" hidden></label></div>
    <button class="btn line" data-act="reset">Сбросить прогресс</button></div>`;
  $('#npd').onchange=e=>{S.set.newPerDay=+e.target.value;save()};
  $('#spk').onchange=e=>{S.set.speak=e.target.checked;save()};
  const v=$('#voice');if(v)v.onchange=e=>{S.set.voice=e.target.value;setVoice(S.set.voice);save()};
  $('#imp').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    try{const o=JSON.parse(await f.text());if(o.v!==1||typeof o.cards!=='object')throw 0;replaceState(o);invalidate();applyStyle();toast('Копия загружена');settings()}catch(x){toast('Не удалось прочитать файл')}
  };
}

const isKana=t=>/^[\u3040-\u30ffー〜・\s/]+$/.test(t);
// точный дубль: то же чтение и то же написание; похожий: то же чтение, но у одного из слов нет кандзи
function findDup(j,k){
  const rk=k.split('/').map(canon).filter(Boolean);let soft=null;
  for(const w of words()){
    const wk=w.k.split('/').map(canon);
    if(!rk.some(x=>wk.includes(x)))continue;
    if((j||'')===(w.j||''))return {w,exact:true};
    if(!j||!w.j)soft=soft||w;
  }
  return soft?{w:soft,exact:false}:null;
}

/* ---------- действия ---------- */
const ACT={
  say(el){spk(byId(el.dataset.id))},
  toggleLesson(el){const n=+el.dataset.n,i=S.active.indexOf(n);i<0?S.active.push(n):S.active.splice(i,1);save();lesson(n)},
  scopeLesson(el){scope=el.dataset.n==='my'?'my':'l'+el.dataset.n},
  scopeDue(){scope='due'},
  scopeOwn(){scope='mydue'},
  filter(el){lessonFilter=el.dataset.k;lesson(location.hash.split('/')[2])},
  mode(el){mode=el.dataset.k;reviewView()},
  dir(el){S.set.dir=el.dataset.k;save();reviewView()},
  start:startSession,
  g(el){advance(+el.dataset.g)},
  next(){advance(0)},
  opt(el){
    const w=byId(SES.q[SES.i]),pick=byId(el.dataset.id),ok=pick.id===w.id;
    el.classList.add(ok?'ok':'bad');
    if(!ok)document.querySelector(`.opt[data-id="${w.id}"]`)?.classList.add('ok');
    answerChoice(ok,w,ok?'Верно!':`<div><b class="jp">${esc(written(w))}</b>${w.j?` <span class="jp">(${esc(w.k)})</span>`:''}</div><div>${esc(w.ru)}</div><div class="mut">${esc(w.en)}</div>`);
  },
  check(){
    if(!SES||SES.locked)return;const w=byId(SES.q[SES.i]),v=$('#ans').value;if(!v.trim())return;
    const ok=matches(v,w);
    answerChoice(ok,w,ok?`Верно! <span class="jp">${esc(written(w))}${w.j?' · '+esc(w.k):''}</span>`:`<div>Правильно: <b class="jp">${esc(w.k)}</b>${w.j?` <span class="jp">(${esc(w.j)})</span>`:''}</div><div class="mut">Вы ввели: ${esc(v)}</div>`);
  },
  addMy(){
    const j=$('#mj').value.trim(),kIn=$('#mk').value.trim(),ru=$('#mr').value.trim();
    if(!ru||!(j||kIn)){toast('Нужны слово и перевод');return}
    let k=(kIn||j).trim();if(/[a-z]/i.test(k))k=romajiToHira(k);
    let jj=j;if(!j||(isKana(j)&&(!kIn||canon(kIn)===canon(j)))){if(j&&isKana(j))k=j;jj=''}
    const d=findDup(jj,k);
    if(d){
      const w=d.w,where=w.n?`урок ${w.n}`:'Свой урок',what=`${written(w)}${w.j?` (${w.k})`:''} — ${w.ru}`;
      if(d.exact){toast(`Такое слово уже есть: ${what} · ${where}`);return}
      if(!confirm(`Похожее слово уже есть: ${what} · ${where}.\nВсё равно добавить?`))return;
    }
    S.my.push({id:'my-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),j:jj,k,ru,en:$('#me').value.trim(),c:$('#mc').value});
    save();invalidate();toast('Добавлено в «Свой урок»');my();
  },
  delMy(el){if(!confirm('Удалить слово?'))return;S.my=S.my.filter(w=>w.id!==el.dataset.id);delete S.cards[el.dataset.id];save();invalidate();my()},
  export(){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S)],{type:'application/json'}));
    a.download='genki-uchit-'+dayKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  },
  style(el){S.set.style=el.dataset.k;save();applyStyle();settings()},
  testVoice(){spk('こんにちは')},
  reset(){if(confirm('Сбросить весь прогресс повторений? Ваши слова сохранятся.')){resetProgress();toast('Прогресс сброшен');settings()}}
};
view.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');
  if(el){ACT[el.dataset.act]?.(el,e);return}
  if(SES&&SES.mode==='cards'&&e.target.closest('.flash')){reveal();return}
  const r=e.target.closest('.word-row');if(r&&hideTr)r.classList.toggle('open');
});

/* ---------- старт ---------- */
setVoice(S.set.voice);applyStyle();
loadBase().then(()=>{route()}).catch(e=>{view.innerHTML=`<div class="c">Не удалось загрузить словарь: ${esc(e.message)}</div>`});
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
