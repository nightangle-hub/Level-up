/* RaiKiba Today panel: this week's missions plus what to do today.
   It reads saved data and never writes to the main app state. The only thing it saves is the pause setting, in levelup-missions-v1. Looks and daily care earn no XP. */
(function(){
'use strict';
const LOOKS={office:'Office',street:'Street',event:'Event',lazy:'Lazy Day',date:'Date Night',glass:'Glass Skin Girl',cherry:'Cherry Blossom Crush',grunge:'Soft Grunge Seoul',clean:'Clean Girl, Sleek Edition',strawberry:'Strawberry Milk Glow',redbean:'Red Bean Romantic'};
const SESSIONS=['Foundation A','Foundation B'];
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
  const sessions=logs.filter(e=>e.kind==='session'&&e.planId==='foundation-v1').sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const last=sessions[sessions.length-1],next=last&&Number.isInteger(last.session)?(last.session+1)%2:0;
  const movedToday=logs.some(e=>(e.kind==='session'||e.kind==='cardio'||e.kind==='set')&&e.date===t);
  return {next:SESSIONS[next],movedToday}}
function mealInfo(state,t){const m=((state&&state.cookedMeals)||[]).filter(x=>x&&x.date===t).pop();return {cooked:m?m.recipeTitle:''}}
const RANKS=[[18,6],[12,5],[8,4],[5,3],[3,2],[1,1]];
function rankFor(level){for(const [min,r] of RANKS)if(level>=min)return r;return 1}
function planInfo(t){const P=window.LevelUpPlan;if(!P)return {week:0,tonight:null};return {week:P.count(P.monday(t)),tonight:P.dinnerFor(t)}}
const TIERS={1:{name:'First steps',add:'Move, Cook, Cook from stock and Kind to self'},2:{name:'Building the week',add:'the weekly Clear bonus and your streak'},3:{name:'Getting stronger',add:'your stats and personal bests'},4:{name:'Checking in',add:'the monthly photo check'},5:{name:'Steady rhythm',add:'a steady rhythm, nothing new to learn'},6:{name:'Top tier',add:'everything'}};
function nextTier(level,total){const r=rankFor(level);if(r>=6)return null;const m=RANKS.find(x=>x[1]===r+1)[0],from=(RANKS.find(x=>x[1]===r)[0]-1)*100,to=(m-1)*100;return {tier:r+1,from,to,have:Math.max(0,total-from),need:to-from,left:Math.max(0,to-total)}}
function bar(have,target){let h='';for(let i=0;i<target;i++)h+='<i class="lut-dot'+(i<have?' on':'')+'"></i>';return h}
function systemExtras(st,t,tier){
  const M=window.LevelUpMissions,p=st.paused,sk=st.streak,stats=st.stats||{str:0,sta:0,foc:0};
  const tiles='<div class="lut-stats"><span><b>'+stats.str+'</b>STR sets</span><span><b>'+stats.sta+'</b>STAMINA min</span><span><b>'+stats.foc+'</b>FOCUS meals and shops</span></div>';
  let line;
  if(p)line='<p class="lut-sys">Offline mode ('+esc(p.reason)+') since '+esc(p.from)+(p.to?', until '+esc(p.to):'')+'. Your streak is safe.</p>';
  else line='<p class="lut-sys">Streak: '+sk.streak+' week'+(sk.streak===1?'':'s')+' · Checkpoint '+(sk.shieldReady?'ready (forgives a missed week)':'used this month')+'.</p>';
  const pb=st.pb&&st.pb.week?'<p class="lut-sys">Personal best'+(st.pb.week===1?'':'s')+' this week: '+st.pb.week+' (+'+(st.pb.week*M.XP.pb)+' XP).</p>':'';
  const ctl=p?'<button type="button" class="lut-go" data-lu-resume="1">Resume</button>':'<details class="lut-pause"><summary>Go offline for holiday or injury</summary><label>Reason<select id="luPauseReason"><option value="holiday">Holiday</option><option value="injury">Injury</option><option value="other">Other</option></select></label><label>Back on (optional)<input type="date" id="luPauseTo" min="'+esc(t)+'"></label><button type="button" class="lut-go" data-lu-pause="1">Start offline mode</button></details>';
  return (tier>=3?tiles:'')+(tier>=2?line:'')+(tier>=3?pb:'')+ctl}
function tierBanner(tier,level){const M=window.LevelUpMissions;let seen=0;try{seen=M.getSeenTier()}catch(e){}if(!seen){try{M.setSeenTier(tier)}catch(e){}return false}if(tier<=seen)return false;showLevelUp(tier,level);return true}
function showLevelUp(tier,level){if(document.querySelector('.lu-lvl'))return;const c=TIERS[tier];if(!c)return;const o=document.createElement('div');o.className='lu-lvl';o.setAttribute('role','dialog');o.setAttribute('aria-label','Level '+level+' reached');
  o.innerHTML='<div class="box"><div class="glow"></div><img src="assets/companion/happy.webp" alt=""><p class="sys">[ LEVEL UP ]</p><div class="num" aria-hidden="true"><div>'+Math.max(0,level-1)+'<br>'+level+'</div></div><p class="lv">Level '+level+'</p><p class="new">New: '+esc(c.add)+'.</p><p class="tap">tap to continue</p></div>'+Array.from({length:12},(_,i)=>'<i class="p" style="left:'+(8+i*7.5)+'%;animation-delay:'+(0.5+i*0.17).toFixed(2)+'s"></i>').join('');
  o.addEventListener('click',()=>{try{window.LevelUpMissions.setSeenTier(tier)}catch(e){}o.remove();schedule()});document.body.appendChild(o)}
const XPSEEN='levelup-xpseen-v1';
function xpFire(delta,label,pct){if(document.querySelector('.lu-xpbar'))return;const bar=document.createElement('div');bar.className='lu-xpbar';bar.setAttribute('role','status');bar.innerHTML='<span>'+esc(label)+' · +'+delta+' XP</span><div class="t"><i style="width:'+pct+'%"></i></div>';document.body.appendChild(bar);setTimeout(()=>bar.remove(),3000);
  const f=document.createElement('span');f.className='lu-xpfloat';f.textContent='+'+delta+' XP';document.body.appendChild(f);setTimeout(()=>f.remove(),1800);
  const W=window.innerWidth,H=window.innerHeight;[[-40,-60],[30,-80],[-70,-20],[60,-40],[10,-100],[-20,-90]].forEach(([x,y],i)=>{const k=document.createElement('i');k.className='lu-spark';k.style.cssText='--x:'+x+'px;--y:'+y+'px;left:'+(W-60+i*4)+'px;top:'+(H*0.46+14)+'px;animation-delay:'+(0.15+i*0.05)+'s';document.body.appendChild(k);setTimeout(()=>k.remove(),1500)});
  const pet=document.querySelector('.header img');if(pet){pet.classList.add('lu-hop');setTimeout(()=>pet.classList.remove('lu-hop'),1300)}}
function checkXp(xp,rows,leveled){let seen=null;try{seen=JSON.parse(localStorage.getItem(XPSEEN))}catch(e){}
  const done=rows.filter(r=>r.done&&r.id!=='clear').map(r=>r.id),save=()=>{try{localStorage.setItem(XPSEEN,JSON.stringify({total:xp.total,done,v:2}))}catch(e){}};
  /* v2: XP formula gained a 60 minute tier (Step 3). Re-baseline once, silently, so old long sessions never fire a surprise toast. Local only, so offline is fine. */
  if(!seen||typeof seen.total!=='number'||seen.v!==2){save();return}
  if(xp.total>seen.total&&!leveled){const d=xp.total-seen.total,fresh=rows.filter(r=>r.done&&r.id!=='clear'&&!(seen.done||[]).includes(r.id));const n=nextTier(xp.level,xp.total);
    xpFire(d,fresh.length?fresh[0].label+' cleared':'Nice one',n?Math.max(4,Math.min(100,Math.round(n.have/n.need*100))):100)}
  if(xp.total!==seen.total||done.join()!==(seen.done||[]).join())save()}
/* Cold open never toasts: XP is baselined once when the app loads, so only XP earned while the app is open animates (sync from another device or a formula change cannot surprise her). */
(function(){try{const M=window.LevelUpMissions,st=read('bloom-zen-v1');if(!M||!window.BloomCore||!st)return;const xp=window.BloomCore.trainingXP(st),rows=M.status(st).rows;localStorage.setItem(XPSEEN,JSON.stringify({total:xp.total,done:rows.filter(r=>r.done&&r.id!=='clear').map(r=>r.id),v:2}))}catch(e){}})();
let qOpen=false;document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.classList&&d.classList.contains('lut-quests'))qOpen=d.open},true);
function reward(){let n=[];try{n=(window.LevelUpPrizes&&window.LevelUpPrizes.pending)||[]}catch(e){}return n.length?'<p class="lut-sys"><button type="button" class="lut-mode" data-action="open" data-view="companion-rewards">'+(n.length===1?'New reward: '+esc(n[0]):n.length+' new rewards')+' ›</button></p>':''}
function milestone(xp){const n=nextTier(xp.level,xp.total);if(!n)return '<p class="lut-sys">Top tier reached. Keep going for the next reward.</p>';const pct=Math.min(100,Math.round(n.have/n.need*100));return '<div class="lut-mile" role="img" aria-label="'+n.left+' XP to Tier '+n.tier+'"><small>Next milestone: Tier '+n.tier+' · '+n.left+' XP to go</small><span class="lut-track"><i style="width:'+pct+'%"></i></span></div>'}
function html(){
  const M=window.LevelUpMissions;if(!M)return '';
  const state=read('bloom-zen-v1')||{},t=today(),st=M.status(state);
  const look=lookInfo(t),train=trainingInfo(state,t),meal=mealInfo(state,t),plan=planInfo(t);
  let xp={level:1,total:0};try{xp=window.BloomCore.trainingXP(state)}catch(e){}
  const tier=rankFor(xp.level),shown=st.rows.filter(r=>r.id==='clear'?tier>=2:(r.id==='stock'||r.id==='care')?tier>=1:true);
  const cleared=shown.filter(r=>r.done&&r.id!=='clear').map(r=>r.label),gate=tier>=2&&st.rows.find(r=>r.id==='clear').done;
  const rows=shown.map(r=>'<li class="lut-row'+(r.done?' done':'')+'"><span class="lut-name"><b>'+esc(r.id==='clear'?'Clear':r.label)+'</b><small>'+esc(r.detail)+'</small></span><span class="lut-prog">'+(r.id==='clear'?'':bar(Math.min(r.have,r.target),r.target))+'</span><span class="lut-xp">'+(r.done?'Done':'+'+r.xp+' XP')+'</span></li>').join('');
  const btn=(label,view)=>'<button type="button" class="lut-go" data-action="open" data-view="'+view+'">'+esc(label)+'</button>';
  const item=(k,title,detail,ok,go)=>'<li class="lut-item'+(ok?' done':'')+'"><span class="lut-k">'+k+'</span><span class="lut-t"><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></span>'+go+'</li>';
  const dinner=meal.cooked?item('Dinner','Cooked: '+meal.cooked,'Counts toward Cook.',true,btn('Meals','dinner')):'';
  const leveled=tierBanner(tier,xp.level);checkXp(xp,st.rows,leveled);
  const qrows=shown.filter(r=>r.id!=='clear'),doneN=qrows.filter(r=>r.done).length;
  return '<section id="luToday" class="lut"><style>'+
  '#luToday ul{list-style:none;margin:0;padding:0}#luToday li{display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--border)}#luToday .lut-name,#luToday .lut-t{flex:1;min-width:0;display:flex;flex-direction:column}#luToday small{color:var(--muted);font-size:12px;line-height:1.35}'+
  '#luToday .lut-prog{display:flex;gap:5px}#luToday .lut-dot{width:11px;height:11px;border-radius:50%;border:1.5px solid var(--xp,var(--accent));display:block}#luToday .lut-dot.on{background:var(--xp,var(--accent))}#luToday .lut-xp{font-size:12px;color:var(--muted);min-width:52px;text-align:right}#luToday .done .lut-xp{color:var(--xp,var(--accent))}'+
  '#luToday .lut-k{font-size:10px;letter-spacing:1px;color:var(--muted);width:58px;text-transform:uppercase}#luToday .lut-go,#luToday .lut-mode{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:8px 14px;font:inherit;font-size:12px;cursor:pointer;min-height:36px}#luToday .done .lut-t b::after{content:" \\2713";color:var(--accent)}#luToday .lut-bonus summary{cursor:pointer;font-size:13px;color:var(--muted);padding:8px 0 12px}'+
  '</style>'+
  '<div class="lut-card"><details class="lut-quests"'+(qOpen?' open':'')+'><summary><span class="lut-sum"><b>This week</b><small>'+doneN+' of '+qrows.length+' done'+(gate?' · all clear':'')+'</small></span><span class="lut-prog">'+qrows.map(r=>'<i class="lut-dot'+(r.done?' on':'')+'"></i>').join('')+'</span></summary>'+
  '<ul>'+rows+'</ul>'+
  (tier>=4?'<details class="lut-bonus"><summary>Bonus</summary><ul><li class="lut-row'+(st.photoDone?' done':'')+'"><span class="lut-name"><b>Monthly photo check</b><small>Save this month\'s baseline photo in Appearance</small></span><span class="lut-xp">'+(st.photoDone?'Done':'+10 XP')+'</span></li></ul></details>':'')+'</details></div>'+reward()+
  (dinner?'<div class="lut-card"><p class="micro">TONIGHT</p><ul>'+dinner+'</ul></div>':'')+'</section>'}
function inject(){
  const c=document.getElementById('content');if(!c)return;
  const trainingHead=c.querySelector('.today-sub-standalone'),anchor=trainingHead||c.querySelector('.concept-feature');
  if(!anchor)return;
  const app=document.getElementById('app');if(!app||!app.classList.contains('home-screen'))return;
  const existing=c.querySelector('#luToday');const next=html();if(!next)return;
  const tmp=document.createElement('div');tmp.innerHTML=next;const node=tmp.firstElementChild;
  if(existing){if(existing.outerHTML!==node.outerHTML)existing.replaceWith(node);return}
  if(trainingHead)anchor.before(node);else anchor.after(node)}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;try{inject()}catch(e){}})}
document.addEventListener('click',e=>{const tb=e.target.closest&&e.target.closest('[data-lu-tier]');if(tb&&window.LevelUpMissions){window.LevelUpMissions.setSeenTier(Number(tb.dataset.luTier));schedule();return}const b=e.target.closest&&e.target.closest('[data-lu-pause],[data-lu-resume]');if(!b)return;const M=window.LevelUpMissions;if(!M)return;if(b.hasAttribute('data-lu-resume'))M.resume();else{const r=document.getElementById('luPauseReason'),to=document.getElementById('luPauseTo');M.pause(r?r.value:'other',to?to.value:'')}schedule()});
function start(){const c=document.getElementById('content');if(!c)return;new MutationObserver(schedule).observe(c,{childList:true});document.addEventListener('bloom-training-xp',schedule);window.addEventListener('storage',schedule);schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()})();
