/* RaiKiba guided food path. Shows one "next step" card on Meals (Plan, Check, Shop, Save) and a
   short Check stock sheet for items that are unknown or older than 14 days.
   Stock changes go through the app's own Plenty / Some / Low control, so undo and sync keep working.
   Only its own key stores "skip for today"; that key is not synced and not part of the main save. */
(function(){
'use strict';
const SK='levelup-path-v1',STALE=14*864e5,MAXLIST=8;
const pad=n=>String(n).padStart(2,'0');
const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readState(){try{return JSON.parse(localStorage.getItem('bloom-zen-v1')||'null')||{}}catch(e){return {}}}
function skippedToday(){try{return (JSON.parse(localStorage.getItem(SK)||'{}')||{}).checkSkip===todayKey()}catch(e){return false}}
function setSkip(){try{localStorage.setItem(SK,JSON.stringify({checkSkip:todayKey()}))}catch(e){}}
function ageText(iso){if(!iso)return 'never confirmed';const d=Math.floor((Date.now()-Date.parse(iso))/864e5);return d<1?'today':d===1?'1 day ago':d+' days ago'}
function doubtful(st){
  const items=Array.isArray(st.stockItems)?st.stockItems:[];
  return items.filter(s=>s&&s.id&&s.name&&(!s.updated||Date.now()-Date.parse(s.updated)>STALE||(!s.level&&s.amount==null)))
    .sort((a,b)=>(Date.parse(a.updated)||0)-(Date.parse(b.updated)||0)).slice(0,MAXLIST)}
function nextStep(){
  const st=readState(),P=window.LevelUpPlan;
  const planned=P&&P.count?P.count(P.monday(todayKey())):0,min=P&&P.MIN?P.MIN:3;
  if(planned<min)return {n:1,label:'Plan dinners',attr:'data-plan-open="0"',why:planned+' of '+min+' dinners planned'};
  const d=doubtful(st);
  if(d.length&&!skippedToday())return {n:2,label:'Check stock ('+d.length+')',attr:'data-path-check="1"',why:d.length+' item'+(d.length===1?'':'s')+' to confirm'};
  const list=Array.isArray(st.shoppingItems)?st.shoppingItems:[],ticked=st.shoppingChecked||{};
  if(!list.length)return {n:3,label:'Shop for this plan',attr:'data-plan-open="0"',why:'Build your shopping list'};
  const left=list.filter((_,i)=>!ticked[i]).length;
  if(left)return {n:3,label:'Open shopping list',attr:'data-action="open" data-view="groceries"',why:left+' item'+(left===1?'':'s')+' to buy'};
  return {n:4,label:'Add a grocery shop',attr:'data-action="open" data-view="receipt-scan"',why:'Save what you bought'}}
function css(){if(document.getElementById('luPathStyle'))return;const s=document.createElement('style');s.id='luPathStyle';s.textContent=
'.lup-path{border:1px solid var(--border);background:var(--card);border-radius:18px;padding:14px 16px;margin:0 0 14px}.lup-path .lpp-steps{display:flex;justify-content:space-between;margin:0 0 12px}'+
'.lup-path .lpp-s{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;font-size:11px;color:var(--muted)}.lup-path .lpp-c{width:26px;height:26px;border-radius:50%;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}'+
'.lup-path .lpp-s.on{color:var(--text);font-weight:700}.lup-path .lpp-s.on .lpp-c{background:var(--accent);color:var(--bg);border-color:var(--accent)}.lup-path .lpp-s.done .lpp-c{color:var(--accent)}'+
'.lup-path .lpp-why{margin:0 0 10px;color:var(--muted);font-size:13px}.lup-path button.lpp-go{width:100%;min-height:48px;font:inherit;font-weight:700;border:0;border-radius:12px;background:var(--accent);color:var(--bg);cursor:pointer}'+
'#luCheck{position:fixed;inset:0;z-index:70;background:var(--bg);color:var(--text);overflow:auto;padding:max(18px,env(safe-area-inset-top)) 16px 40px}#luCheck .lpc-in{max-width:520px;margin:0 auto}#luCheck h1{font:400 26px/1.2 Georgia,serif;margin:6px 0}#luCheck p{color:var(--muted);font-size:14px;line-height:1.5;margin:0 0 14px}'+
'#luCheck .lpc-row{border:1px solid var(--border);background:var(--card);border-radius:14px;padding:12px;margin:0 0 10px}#luCheck .lpc-row b{display:block;font-size:15px}#luCheck .lpc-row small{color:var(--muted)}#luCheck .lpc-chips{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}'+
'#luCheck button{font:inherit;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer}#luCheck button.lpc-primary{background:var(--accent);color:var(--bg);border-color:var(--accent);font-weight:700}#luCheck .lpc-actions{display:flex;gap:10px;margin-top:16px}#luCheck .lpc-actions button{flex:1}';
document.head.appendChild(s)}
function cardHTML(){
  const s=nextStep(),L=['Plan','Check','Shop','Save'];
  return '<section class="lup-path" id="luPathCard" aria-label="Food path"><div class="lpp-steps">'+L.map((l,i)=>'<span class="lpp-s'+(i+1===s.n?' on':i+1<s.n?' done':'')+'"><span class="lpp-c">'+(i+1<s.n?'&#10003;':i+1)+'</span>'+l+'</span>').join('')+'</div><p class="lpp-why">'+esc(s.why)+'</p><button type="button" class="lpp-go" '+s.attr+'>'+esc(s.label)+'</button></section>'}
let lastSig='';
function inject(){
  const page=document.querySelector('.meals-page');if(!page)return;
  css();const nav=page.querySelector('.meal-chips'),have=document.getElementById('luPathCard');
  const html=cardHTML();
  if(have&&have.parentNode===page){if(lastSig!==html){lastSig=html;have.outerHTML=html}return}
  if(have)have.remove();
  lastSig=html;
  const t=document.createElement('template');t.innerHTML=html;
  if(nav&&nav.parentNode===page)nav.insertAdjacentElement('afterend',t.content.firstChild);else page.insertBefore(t.content.firstChild,page.firstChild)}
let sheet=null,lastFocus=null;
function renderSheet(){
  if(!sheet)return;const st=readState(),d=doubtful(st);
  const rows=d.map(s=>{const cur=String(s.level||'');return '<div class="lpc-row"><b>'+esc(s.name)+'</b><small>'+esc(cur?cur.charAt(0).toUpperCase()+cur.slice(1):'Level unknown')+', '+esc(ageText(s.updated))+'</small><div class="lpc-chips" role="group" aria-label="Amount of '+esc(s.name)+'">'+['plenty','some','low'].map(l=>'<button type="button" data-path-level="'+l+'" data-id="'+esc(s.id)+'" aria-pressed="'+(cur===l)+'"'+(cur===l?' class="lpc-primary"':'')+'>'+l.charAt(0).toUpperCase()+l.slice(1)+'</button>').join('')+'</div></div>'}).join('');
  sheet.innerHTML='<div class="lpc-in"><h1>Check your stock</h1><p>Only items that are unknown or 14+ days old. Tap a level to confirm it. Anything you skip stays as is.</p>'+(rows||'<p>All checked. Nothing else needs confirming.</p>')+'<div class="lpc-actions"><button type="button" class="lpc-primary" data-path-close>'+(d.length?'Close':'Done')+'</button>'+(d.length?'<button type="button" data-path-skip>Skip for today</button>':'')+'</div></div>'}
function openSheet(){
  css();lastFocus=document.activeElement;
  if(!sheet){sheet=document.createElement('div');sheet.id='luCheck';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Check your stock')}
  document.body.appendChild(sheet);renderSheet();const c=sheet.querySelector('[data-path-close]');if(c)c.focus()}
function closeSheet(){if(sheet&&sheet.parentNode)sheet.parentNode.removeChild(sheet);if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}setTimeout(inject,0)}
function setLevel(id,level){
  const app=document.getElementById('app');if(!app)return;
  const b=document.createElement('button');b.type='button';b.hidden=true;b.dataset.action='cleanup-stock-level';b.dataset.id=id;b.dataset.level=level;app.appendChild(b);b.click();b.remove();
  setTimeout(renderSheet,0)}
document.addEventListener('click',e=>{
  const t=e.target&&e.target.closest?e.target:null;if(!t)return;
  if(t.closest('[data-path-check]')){e.preventDefault();openSheet();return}
  if(!sheet||!sheet.contains(t))return;
  const lv=t.closest('[data-path-level]');
  if(lv){setLevel(lv.dataset.id,lv.dataset.pathLevel);return}
  if(t.closest('[data-path-skip]')){setSkip();closeSheet();return}
  if(t.closest('[data-path-close]'))closeSheet()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet&&sheet.parentNode)closeSheet()});
let queued=false;
function schedule(){if(queued)return;queued=true;(window.requestAnimationFrame||setTimeout)(()=>{queued=false;try{inject()}catch(err){}})}
function start(){if(window.MutationObserver&&document.body){new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}schedule()}
window.LevelUpPath={nextStep,doubtful:()=>doubtful(readState()),open:openSheet};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
