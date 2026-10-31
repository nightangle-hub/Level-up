/* Level Up Today panel: this week's missions plus what to do today.
   Read-only: it reads saved data and never writes to the main app state. Looks and daily care earn no XP. */
(function(){
'use strict';
const LOOKS={office:'Office',street:'Street',event:'Event',lazy:'Lazy Day',date:'Date Night',glass:'Glass Skin Girl',cherry:'Cherry Blossom Crush',grunge:'Soft Grunge Seoul',clean:'Clean Girl, Sleek Edition',strawberry:'Strawberry Milk Glow',redbean:'Red Bean Romantic'};
const SESSIONS=['Lower A','Upper A','Lower B','Upper B'];
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch(e){return null}}
function lookInfo(t){
  const s=read('lu-appearance-v2');if(!s||!LOOKS[s.look])return {name:LOOKS.office,done:false};
  const v=s.done&&s.done[s.look];const done=typeof v==='string'?v.slice(0,10)===t:!!(v&&v[t]);
  return {name:LOOKS[s.look],done}}
function trainingInfo(state,t){
  const logs=((state&&state.trainingLogs)||[]).filter(e=>e&&!e.voided);
  const sessions=logs.filter(e=>e.kind==='session').sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const last=sessions[sessions.length-1],next=last&&Number.isInteger(last.session)?(last.session+1)%4:0;
  const movedToday=logs.some(e=>(e.kind==='session'||e.kind==='cardio')&&e.date===t);
  return {next:SESSIONS[next],movedToday}}
function mealInfo(state,t){const m=((state&&state.cookedMeals)||[]).filter(x=>x&&x.date===t).pop();return {cooked:m?m.recipeTitle:''}}
function bar(have,target){let h='';for(let i=0;i<target;i++)h+='<i class="lut-dot'+(i<have?' on':'')+'"></i>';return h}
function html(){
  const M=window.LevelUpMissions;if(!M)return '';
  const state=read('bloom-zen-v1')||{},t=today(),st=M.status(state);
  const look=lookInfo(t),train=trainingInfo(state,t),meal=mealInfo(state,t);
  const rows=st.rows.map(r=>'<li class="lut-row'+(r.done?' done':'')+'"><span class="lut-name"><b>'+esc(r.label)+'</b><small>'+esc(r.detail)+'</small></span><span class="lut-prog">'+(r.id==='clear'?'':bar(Math.min(r.have,r.target),r.target))+'</span><span class="lut-xp">'+(r.done?'Done':'+'+r.xp+' XP')+'</span></li>').join('');
  const btn=(label,view)=>'<button type="button" class="lut-go" data-action="open" data-view="'+view+'">'+esc(label)+'</button>';
  const item=(k,title,detail,ok,go)=>'<li class="lut-item'+(ok?' done':'')+'"><span class="lut-k">'+k+'</span><span class="lut-t"><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></span>'+go+'</li>';
  return '<section id="luToday" class="lut"><style>'+
  '#luToday{margin:18px 0}#luToday h2{font:400 22px/1.2 Georgia,serif;margin:0 0 4px}#luToday .micro{margin:0 0 8px}#luToday .lut-card{border:1px solid var(--border);background:var(--card);border-radius:18px;padding:18px 18px 10px;margin:0 0 14px}#luToday ul{list-style:none;margin:0;padding:0}'+
  '#luToday li{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border)}#luToday li:first-child{border-top:0}#luToday .lut-name,#luToday .lut-t{flex:1;min-width:0;display:flex;flex-direction:column}#luToday small{color:var(--muted);font-size:12px;line-height:1.35}'+
  '#luToday .lut-prog{display:flex;gap:4px}#luToday .lut-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--accent);display:block}#luToday .lut-dot.on{background:var(--accent)}#luToday .lut-xp{font-size:12px;color:var(--muted);min-width:52px;text-align:right}#luToday .done .lut-xp{color:var(--accent)}'+
  '#luToday .lut-k{font-size:10px;letter-spacing:1px;color:var(--muted);width:58px;text-transform:uppercase}#luToday .lut-go{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer}#luToday .done .lut-t b::after{content:" \\2713";color:var(--accent)}'+
  '</style>'+
  '<div class="lut-card"><p class="micro">THIS WEEK · MISSIONS</p><h2>Four small wins</h2><ul>'+rows+'</ul>'+
  '<ul><li class="lut-row'+(st.photoDone?' done':'')+'"><span class="lut-name"><b>Monthly photo check</b><small>Save this month\'s baseline photo in Appearance</small></span><span class="lut-xp">'+(st.photoDone?'Done':'+10 XP')+'</span></li></ul></div>'+
  '<div class="lut-card"><p class="micro">TODAY</p><ul>'+
  item('Move',train.movedToday?'Logged today':'Next: '+train.next,train.movedToday?'Nice, that counts toward Move.':'Your next session in the rotation.',train.movedToday,btn('Open','training'))+
  item('Look',look.name,look.done?'Done for today. Looks earn no XP.':'Your current look. Optional, no XP.',look.done,btn('Open','beauty'))+
  item('Dinner',meal.cooked?'Cooked: '+meal.cooked:'Pick tonight\'s dinner',meal.cooked?'Counts toward Cook.':'Cook 2 meals this week for the bonus.',!!meal.cooked,btn('Meals','dinner'))+
  item('Plan','Shopping and stock','Confirm a plan or update stock once this week.',st.week.done.plan,btn('Open','groceries'))+
  '</ul></div></section>'}
function inject(){
  const c=document.getElementById('content');if(!c)return;
  const anchor=c.querySelector('.concept-feature');if(!anchor||!c.querySelector('.concept-shortcuts'))return;
  const existing=c.querySelector('#luToday');const next=html();if(!next)return;
  const tmp=document.createElement('div');tmp.innerHTML=next;const node=tmp.firstElementChild;
  if(existing){if(existing.outerHTML!==node.outerHTML)existing.replaceWith(node);return}
  anchor.parentNode.insertBefore(node,anchor)}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;try{inject()}catch(e){}})}
function start(){const c=document.getElementById('content');if(!c)return;new MutationObserver(schedule).observe(c,{childList:true});document.addEventListener('bloom-training-xp',schedule);window.addEventListener('storage',schedule);schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()})();
