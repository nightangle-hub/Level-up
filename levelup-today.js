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
const TIERS={1:{name:'First steps',add:'Move and Cook quests'},2:{name:'Building the week',add:'the Plan quest, the Clear bonus and your weekly streak'},3:{name:'Getting stronger',add:'your stats and personal bests'},4:{name:'Checking in',add:'the monthly photo check'},5:{name:'Boss month',add:'the monthly boss'},6:{name:'Top tier',add:'everything'}};
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
function bossRow(st){const b=st.boss;if(!b)return '';return '<li class="lut-row'+(b.done?' done':'')+'"><span class="lut-name"><b>Monthly boss</b><small>Train on '+b.target+' days this month'+(b.target<M_BOSS()?' (shortened for your pause)':'')+'</small></span><span class="lut-prog">'+(b.done?'':'<small>'+b.have+'/'+b.target+'</small>')+'</span><span class="lut-xp">'+(b.done?'Defeated':'+'+window.LevelUpMissions.XP.boss+' XP')+'</span></li>'}
function M_BOSS(){return window.LevelUpMissions.BOSS_TARGET}
function modePill(st){const M=window.LevelUpMissions,m=M.MODES[st.mode]||M.MODES.normal;return '<p class="lut-sys"><button type="button" class="lut-mode" data-action="open" data-view="pace" aria-label="Weekly pace: '+esc(m.label)+'. Change">Pace: '+esc(m.label)+' ›</button>'+(st.pendingMode?' <small>'+esc(M.MODES[st.pendingMode].label)+' starts Monday</small>':'')+'</p>'}
function tierBanner(tier){const M=window.LevelUpMissions;let seen=0;try{seen=M.getSeenTier()}catch(e){}if(!seen){try{M.setSeenTier(tier)}catch(e){}return ''}if(tier<=seen)return '';const c=TIERS[tier];return '<div class="lut-up" role="status"><b>Tier '+tier+' unlocked: '+esc(c.name)+'</b><small>New: '+esc(c.add)+'.</small><button type="button" class="lut-mode" data-lu-tier="'+tier+'">Got it</button></div>'}
function reward(){let n=[];try{n=(window.LevelUpPrizes&&window.LevelUpPrizes.pending)||[]}catch(e){}return n.length?'<p class="lut-sys"><button type="button" class="lut-mode" data-action="open" data-view="companion-rewards">'+(n.length===1?'New reward: '+esc(n[0]):n.length+' new rewards')+' ›</button></p>':''}
function milestone(xp){const n=nextTier(xp.level,xp.total);if(!n)return '<p class="lut-sys">Top tier reached. Keep going for the next reward.</p>';const pct=Math.min(100,Math.round(n.have/n.need*100));return '<div class="lut-mile" role="img" aria-label="'+n.left+' XP to Tier '+n.tier+'"><small>Next milestone: Tier '+n.tier+' · '+n.left+' XP to go</small><span class="lut-track"><i style="width:'+pct+'%"></i></span></div>'}
function html(){
  const M=window.LevelUpMissions;if(!M)return '';
  const state=read('bloom-zen-v1')||{},t=today(),st=M.status(state);
  const look=lookInfo(t),train=trainingInfo(state,t),meal=mealInfo(state,t),plan=planInfo(t);
  let xp={level:1,total:0};try{xp=window.BloomCore.trainingXP(state)}catch(e){}
  const tier=rankFor(xp.level),shown=st.rows.filter(r=>r.id==='clear'?tier>=2:r.id==='plan'?tier>=2:true);
  const cleared=shown.filter(r=>r.done&&r.id!=='clear').map(r=>r.label),gate=tier>=2&&st.rows.find(r=>r.id==='clear').done;
  const rows=shown.map(r=>'<li class="lut-row'+(r.done?' done':'')+'"><span class="lut-name"><b>'+esc(r.id==='clear'?'Clear':r.label)+'</b><small>'+esc(r.detail)+'</small></span><span class="lut-prog">'+(r.id==='clear'?'':bar(Math.min(r.have,r.target),r.target))+'</span><span class="lut-xp">'+(r.done?'Done':'+'+r.xp+' XP')+'</span></li>').join('');
  const btn=(label,view)=>'<button type="button" class="lut-go" data-action="open" data-view="'+view+'">'+esc(label)+'</button>';
  const planBtn=label=>'<button type="button" class="lut-go" data-plan-open="0">'+esc(label)+'</button>';
  const item=(k,title,detail,ok,go)=>'<li class="lut-item'+(ok?' done':'')+'"><span class="lut-k">'+k+'</span><span class="lut-t"><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></span>'+go+'</li>';
  let dinner;
  if(meal.cooked)dinner=item('Dinner','Cooked: '+meal.cooked,'Counts toward Cook.',true,btn('Meals','dinner'));
  else if(plan.tonight)dinner=item('Dinner','Tonight: '+plan.tonight.title,'Planned. Cook it and mark it cooked.',false,btn('Open recipe','user-recipe-'+plan.tonight.id));
  else if(plan.week)dinner=item('Dinner','Nothing planned tonight',plan.week+' of '+(window.LevelUpPlan?window.LevelUpPlan.MAX:5)+' dinners planned this week.',false,planBtn('Edit plan'));
  else dinner=item('Dinner','Plan the week','Pick up to 5 dinners and shop once.',false,planBtn('Plan'));
  return '<section id="luToday" class="lut"><style>'+
  '#luToday{margin:18px 0}#luToday h2{font:400 22px/1.2 Georgia,serif;margin:0 0 4px}#luToday .micro{margin:0 0 8px}#luToday .lut-card{border:1px solid var(--border);background:var(--card);border-radius:18px;padding:18px 18px 10px;margin:0 0 14px}#luToday ul{list-style:none;margin:0;padding:0}'+
  '#luToday li{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border)}#luToday li:first-child{border-top:0}#luToday .lut-name,#luToday .lut-t{flex:1;min-width:0;display:flex;flex-direction:column}#luToday small{color:var(--muted);font-size:12px;line-height:1.35}'+
  '#luToday .lut-prog{display:flex;gap:4px}#luToday .lut-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid var(--accent);display:block}#luToday .lut-dot.on{background:var(--accent)}#luToday .lut-xp{font-size:12px;color:var(--muted);min-width:52px;text-align:right}#luToday .done .lut-xp{color:var(--accent)}'+
  '#luToday .lut-k{font-size:10px;letter-spacing:1px;color:var(--muted);width:58px;text-transform:uppercase}#luToday .lut-go{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer}#luToday .done .lut-t b::after{content:" \\2713";color:var(--accent)}'+
  '#luToday .lut-rank{display:flex;align-items:center;gap:10px;margin:2px 0 10px}#luToday .lut-badge{width:34px;height:34px;border-radius:10px;border:1.5px solid var(--accent);display:flex;align-items:center;justify-content:center;font:400 20px Georgia,serif;color:var(--accent)}#luToday .lut-sys{margin:0 0 6px;font-size:12px;color:var(--accent);letter-spacing:.3px}'+
  '#luToday .lut-stats{display:flex;gap:16px;margin:0 0 10px;flex-wrap:wrap}#luToday .lut-stats span{font-size:11px;color:var(--muted);display:flex;flex-direction:column;letter-spacing:.3px}#luToday .lut-stats b{font:400 20px Georgia,serif;color:var(--text)}#luToday .lut-bonus summary{cursor:pointer;font-size:13px;color:var(--muted);padding:6px 0 10px}#luToday .lut-pause{margin:8px 0 12px;font-size:13px}#luToday .lut-pause label{display:flex;gap:8px;align-items:center;margin:8px 0}#luToday .lut-pause input,#luToday .lut-pause select{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px}'+
  '#luToday .lut-mode{font:inherit;font-size:12px;letter-spacing:.3px;color:var(--accent);background:transparent;border:1px solid var(--border);border-radius:999px;padding:9px 14px;min-height:36px;cursor:pointer}#luToday .lut-mile{margin:0 0 10px}#luToday .lut-mile small{display:block;font-size:12px;color:var(--muted);margin-bottom:5px}#luToday .lut-track{display:block;height:6px;border-radius:3px;background:var(--border);overflow:hidden}#luToday .lut-track i{display:block;height:100%;background:var(--accent)}'+
  '#luToday .lut-up{display:grid;gap:4px;background:var(--mist);border-radius:12px;padding:12px;margin:0 0 10px;justify-items:start}#luToday .lut-up small{color:var(--muted);font-size:12px}'+
  '</style>'+
  '<div class="lut-card"><p class="micro">WEEKLY QUESTS</p><div class="lut-rank"><span class="lut-badge" aria-label="Tier '+rankFor(xp.level)+'">'+rankFor(xp.level)+'</span><div><h2>This week</h2><small>Tier '+rankFor(xp.level)+', '+esc(TIERS[rankFor(xp.level)].name)+' · resets Monday, no penalties</small></div></div>'+modePill(st)+milestone(xp)+reward()+tierBanner(tier)+systemExtras(st,t,tier)+
  (gate?'<p class="lut-sys">Clear. All quests complete.</p>':cleared.length?'<p class="lut-sys">Quest cleared: '+esc(cleared.join(', '))+'.</p>':'')+
  '<ul>'+rows+'</ul>'+
  (tier>=4?'<details class="lut-bonus"><summary>Bonus quests</summary><ul><li class="lut-row'+(st.photoDone?' done':'')+'"><span class="lut-name"><b>Monthly photo check</b><small>Save this month\'s baseline photo in Appearance</small></span><span class="lut-xp">'+(st.photoDone?'Done':'+10 XP')+'</span></li>'+(tier>=5?bossRow(st):'')+'</ul></details>':'')+'</div>'+
  '<div class="lut-card"><p class="micro">TONIGHT</p><ul>'+
  dinner+
  '</ul></div></section>'}
function inject(){
  const c=document.getElementById('content');if(!c)return;
  const anchor=c.querySelector('.concept-feature');if(!anchor||!c.querySelector('.concept-hero'))return;
  const existing=c.querySelector('#luToday');const next=html();if(!next)return;
  const tmp=document.createElement('div');tmp.innerHTML=next;const node=tmp.firstElementChild;
  if(existing){if(existing.outerHTML!==node.outerHTML)existing.replaceWith(node);return}
  anchor.after(node)}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;try{inject()}catch(e){}})}
document.addEventListener('click',e=>{const tb=e.target.closest&&e.target.closest('[data-lu-tier]');if(tb&&window.LevelUpMissions){window.LevelUpMissions.setSeenTier(Number(tb.dataset.luTier));schedule();return}const b=e.target.closest&&e.target.closest('[data-lu-pause],[data-lu-resume]');if(!b)return;const M=window.LevelUpMissions;if(!M)return;if(b.hasAttribute('data-lu-resume'))M.resume();else{const r=document.getElementById('luPauseReason'),to=document.getElementById('luPauseTo');M.pause(r?r.value:'other',to?to.value:'')}schedule()});
function start(){const c=document.getElementById('content');if(!c)return;new MutationObserver(schedule).observe(c,{childList:true});document.addEventListener('bloom-training-xp',schedule);window.addEventListener('storage',schedule);schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()})();
