/* Tierlock weekly dinner plan. Plan up to 5 dinners for a week, then build one shopping list from them.
   Stores only its own key and reads recipes from the saved app data. Saving 3 or more dinners clears the weekly Plan quest. */
(function(){
'use strict';
const KEY='levelup-mealplan-v1',MAX=5,MIN=3;
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return key(d)};
const monday=s=>{const d=parse(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return key(d)};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const label=s=>{const d=parse(s);return DAYS[(d.getDay()+6)%7]+' '+d.getDate()+' '+MONTHS[d.getMonth()]};
function read(k){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null}catch(e){return null}}
function readPlan(){const o=read(KEY);return o&&o.weeks&&typeof o.weeks==='object'?o:{weeks:{}}}
function writePlan(o){try{const keys=Object.keys(o.weeks).sort();while(keys.length>16)delete o.weeks[keys.shift()];localStorage.setItem(KEY,JSON.stringify(o));return true}catch(e){return false}}
function recipes(){const s=read('bloom-zen-v1');return ((s&&s.userRecipes)||[]).filter(r=>r&&r.id&&r.title).map(r=>({id:String(r.id),title:String(r.title),text:(String(r.title)+' '+(Array.isArray(r.ingredients)?r.ingredients.join(' '):'')).toLowerCase()}))}
function weekPlan(mon){const w=readPlan().weeks[mon];return (w&&w.days)||{}}
function count(mon){return Object.values(weekPlan(mon)).filter(x=>x&&x.id).length}
function dinnerFor(day){const x=weekPlan(monday(day))[day];return x&&x.id?x:null}
function notify(){try{if(window.LevelUpMissions)window.LevelUpMissions.notify()}catch(e){}}

let sheet=null,week=null,picked=[],query='',note='',offset=0,lastFocus=null;
function css(){if(document.getElementById('luPlanStyle'))return;const s=document.createElement('style');s.id='luPlanStyle';s.textContent=
'#luPlan{position:fixed;inset:0;z-index:60;background:var(--bg);color:var(--text);overflow:auto;padding:max(18px,env(safe-area-inset-top)) 16px 40px}#luPlan .lup-in{max-width:520px;margin:0 auto}'+
'#luPlan h1{font:400 28px/1.2 Georgia,serif;margin:6px 0 6px}#luPlan .micro{margin:0;color:var(--muted)}#luPlan p{color:var(--muted);font-size:14px;line-height:1.5;margin:0 0 14px}'+
'#luPlan .lup-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}#luPlan .lup-tabs{display:flex;gap:8px;margin:12px 0}#luPlan .lup-tab{flex:1}'+
'#luPlan button{font:inherit;border:1px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:10px 14px;cursor:pointer}#luPlan button.on{background:var(--accent);color:var(--bg);border-color:var(--accent)}'+
'#luPlan .lup-day{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border)}#luPlan .lup-day b{width:88px;font-size:14px}#luPlan select{flex:1;min-width:0;font:inherit;font-size:14px;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text)}'+
'#luPlan .lup-card{border:1px solid var(--border);background:var(--card);border-radius:18px;padding:6px 16px;margin:0 0 14px}#luPlan .lup-actions{display:flex;gap:10px;flex-wrap:wrap}#luPlan .lup-actions button{flex:1}#luPlan .lup-note{min-height:20px;color:var(--accent);font-size:13px;margin:0 0 10px}'+
'#luPlan .lup-search{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);margin:0 0 12px}'+'#luPlan .lup-pick{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:0;border-top:1px solid var(--border);border-radius:0;padding:12px 4px;background:transparent}'+'#luPlan .lup-pick:first-child{border-top:0}#luPlan .lup-pick .tick{width:22px;height:22px;flex:none;border:1.5px solid var(--accent);border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:13px}'+'#luPlan .lup-pick.is-picked .tick{background:var(--accent);color:var(--bg)}#luPlan .lup-pick.is-picked{color:var(--accent)}#luPlan .lup-preview{font-size:13px;color:var(--muted);line-height:1.6;margin:0 0 12px}'+'#luPlan button[disabled]{opacity:.5;cursor:default}';document.head.appendChild(s)}
function build(){
  const head='<div class="lup-in"><div class="lup-top"><p class="micro">DINNER QUESTS</p><button type="button" data-plan-close aria-label="Close planner">Close</button></div>'+
  '<h1>Plan the week</h1><p>Pick up to '+MAX+' dinners. Saving '+MIN+' or more clears the weekly Plan quest (+10 XP). Dinners fill the week from Monday in the order you tap them. No penalties.</p>'+
  '<div class="lup-tabs" role="group" aria-label="Choose week"><button type="button" class="lup-tab'+(offset===0?' on':'')+'" data-plan-week="0" aria-pressed="'+(offset===0)+'">This week</button><button type="button" class="lup-tab'+(offset===1?' on':'')+'" data-plan-week="1" aria-pressed="'+(offset===1)+'">Next week</button></div>'+
  (offset===1?'<p>Plans for next week count toward Plan once that week begins on Monday.</p>':'')+
  '<input type="search" id="luPlanSearch" class="lup-search" placeholder="Search your recipes or ingredients" aria-label="Search your recipes" value="'+esc(query)+'" autocomplete="off">'+
  '<div id="luPlanList" class="lup-card"></div><div id="luPlanPreview" class="lup-preview"></div><p class="lup-note" id="luPlanNote" role="status"></p>'+
  '<div class="lup-actions"><button type="button" class="on" data-plan-save>Save plan</button><button type="button" id="luPlanShop" data-plan-shop>Shop for this plan</button></div></div>';
  sheet.innerHTML=head;renderList()}
function renderList(){
  if(!sheet)return;
  const all=recipes(),q=query.trim().toLowerCase(),list=all.filter(r=>!q||r.text.includes(q));
  const box=sheet.querySelector('#luPlanList');
  if(!all.length)box.innerHTML='<p>You have no saved recipes yet. Add or paste a recipe in Meals first, then plan around it.</p>';
  else if(!list.length)box.innerHTML='<p>No recipes match “'+esc(query)+'”.</p>';
  else box.innerHTML=list.map(r=>{const on=picked.includes(r.id);return '<button type="button" class="lup-pick'+(on?' is-picked':'')+'" data-plan-pick="'+esc(r.id)+'" aria-pressed="'+on+'"><span class="tick" aria-hidden="true">'+(on?'✓':'')+'</span><span>'+esc(r.title)+'</span></button>'}).join('');
  const titles=Object.fromEntries(all.map(r=>[r.id,r.title]));
  sheet.querySelector('#luPlanPreview').textContent=picked.length?picked.map((id,i)=>label(addDays(week,i))+': '+(titles[id]||'Removed recipe')).join('  ·  '):'';
  sheet.querySelector('#luPlanNote').textContent=note||(picked.length+' of '+MAX+' dinners chosen');
  const shop=sheet.querySelector('#luPlanShop');if(shop)shop.disabled=!picked.length}
function togglePick(id){
  if(picked.includes(id)){picked=picked.filter(x=>x!==id);note=''}
  else if(picked.length>=MAX){note='Five dinners is plenty. Leave a night free.'}
  else{picked=[...picked,id];note=''}
  renderList()}
function load(){week=addDays(monday(key(new Date())),offset*7);const saved=weekPlan(week);picked=Object.keys(saved).sort().map(d=>saved[d]&&saved[d].id).filter(Boolean).slice(0,MAX)}
function openSheet(off){
  css();offset=off||0;note='';query='';load();lastFocus=document.activeElement;
  if(!sheet){sheet=document.createElement('div');sheet.id='luPlan';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Weekly dinner plan')}
  (document.getElementById('app')||document.body).appendChild(sheet);build();const c=sheet.querySelector('[data-plan-close]');if(c)c.focus()}
function closeSheet(){if(sheet&&sheet.parentNode)sheet.parentNode.removeChild(sheet);if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}document.dispatchEvent(new CustomEvent('bloom-training-xp',{detail:{plan:true}}))}
function save(){
  const list=recipes(),ids=new Set(list.map(r=>r.id)),title=Object.fromEntries(list.map(r=>[r.id,r.title]));
  const chosen=picked.filter(id=>ids.has(id)).slice(0,MAX);
  const days={};chosen.forEach((id,i)=>{days[addDays(week,i)]={id,title:title[id]}});
  const n=chosen.length;
  const o=readPlan();if(n)o.weeks[week]={days,savedAt:new Date().toISOString()};else delete o.weeks[week];
  if(!writePlan(o)){note='Not saved. Storage is unavailable on this device.';renderList();return false}
  picked=chosen;notify();note=n?('Saved. '+n+' dinner'+(n===1?'':'s')+' planned'+(n>=MIN?(offset===0?'. Plan quest cleared.':'. It will count when the week begins.'):'. Plan '+(MIN-n)+' more for the quest.')):'Plan cleared.';renderList();return true}
function shop(){
  if(!save())return;const ids=[...new Set(picked)];if(!ids.length)return;
  const app=document.getElementById('app');if(!app)return;
  const b=document.createElement('button');b.type='button';b.hidden=true;b.dataset.action='plan-shopping';b.dataset.ids=ids.join(',');app.appendChild(b);closeSheet();b.click();b.remove()}
document.addEventListener('click',e=>{
  const t=e.target&&e.target.closest?e.target:null;if(!t)return;
  if(t.closest('[data-plan-open]')){e.preventDefault();openSheet(Number(t.closest('[data-plan-open]').dataset.planOpen)||0);return}
  if(!sheet||!sheet.contains(t))return;
  if(t.closest('[data-plan-close]'))closeSheet();
  else if(t.closest('[data-plan-week]')){offset=Number(t.closest('[data-plan-week]').dataset.planWeek)||0;note='';load();build()}
  else if(t.closest('[data-plan-pick]'))togglePick(t.closest('[data-plan-pick]').dataset.planPick);
  else if(t.closest('[data-plan-save]'))save();
  else if(t.closest('[data-plan-shop]'))shop()},true);
document.addEventListener('input',e=>{if(e.target&&e.target.id==='luPlanSearch'&&sheet&&sheet.contains(e.target)){query=e.target.value;renderList()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet&&sheet.parentNode)closeSheet()});
window.LevelUpPlan={open:openSheet,count,dinnerFor,monday,MAX,MIN};
})();
