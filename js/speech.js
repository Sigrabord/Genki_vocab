let voice=null;
const ok=()=>'speechSynthesis' in window;
function pick(){if(!ok())return;const vs=speechSynthesis.getVoices().filter(v=>/^ja/i.test(v.lang));voice=vs.find(v=>/kyoko|siri|google|haruka|nanami/i.test(v.name))||vs[0]||null}
if(ok()){pick();speechSynthesis.onvoiceschanged=pick}
export const canSpeak=ok;
export function say(w){
  if(!ok())return false;
  const t=(typeof w==='string'?w:w.k.split('/')[0]).replace(/[〜~…]/g,'').trim();
  const u=new SpeechSynthesisUtterance(t);u.lang='ja-JP';u.rate=.85;if(voice)u.voice=voice;
  speechSynthesis.cancel();speechSynthesis.speak(u);return true;
}
