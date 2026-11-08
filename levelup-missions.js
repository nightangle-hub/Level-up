/* RaiKiba weekly missions. Mission XP is derived from existing records, so nothing here can drift out of sync.
   Move: 3 days with a training session or cardio, 30 XP. Cook: 2 days with a cooked meal, 10 XP.
   Cook from stock: 2 meals this week where every essential ingredient was already in stock, 5 XP.
   Kind to self: 2 days this week with any care act (rest, water, walk, cat time, fresh air, calm minute, gratitude, reach out), 5 XP.
   Clear bonus: Move + Cook + both halves of the third slot in one week, 10 XP.
   Monthly photo check: 10 XP per month. Personal best: 10 XP per exercise per week when you beat every earlier set.
   Monthly boss: train on 12 days in a calendar month, 30 XP. Streak: weeks with 3 move days; one missed week a month is forgiven (shield).
   Pauses (holiday, injury) are stored in levelup-missions-v1 and skip streak weeks and shrink the boss target. Weeks start on Monday. Looks and daily care earn no XP. */
(function(root,factory){const api=factory(root);if(typeof module==='object')module.exports=api;else root.LevelUpMissions=api})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const TARGET={move:3,cook:2,stock:2,care:2},XP={move:30,cook:10,stock:5,care:5,bonus:10,photo:10,pb:10,boss:30},BOSS_TARGET=12,REASONS=['holiday','injury','other'],CARE_KINDS=['rest','water','walk','cat','air','calm','thanks','reach'],
MODES={easy:{label:'Easy',move:2,cook:1,blurb:'A gentler pace, steady progress'},normal:{label:'Normal',move:3,cook:2,blurb:'A balanced weekly challenge'},hard:{label:'Hard',move:4,cook:3,blurb:'Push further with bigger goals'},legendary:{label:'Legendary',move:5,cook:4,blurb:'For those ready to go all in'}},MODE_ORDER=['easy','normal','hard','legendary'];
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const okDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}/.test(s);
const parse=s=>{const[y,m,d]=s.slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
function weekStart(s){const d=parse(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return key(d)}
function localDay(v){if(!okDate(v))return null;if(v.length<=10)return v;const d=new Date(v);return isNaN(d)?v.slice(0,10):key(d)}
function bucket(map,week,kind,day){if(!map[week])map[week]={move:new Set(),cook:new Set(),stock:new Set(),care:new Set()};map[week][kind].add(day)}
function gather(state,extras,today){
  const weeks={};state=state||{};extras=extras||{};
  for(const e of state.trainingLogs||[]){if(!e||e.voided||!okDate(e.date)||e.date>today)continue;if(e.kind==='session'||e.kind==='cardio'||e.kind==='set')bucket(weeks,weekStart(e.date),'move',e.date)}
  const meals=(state.cookedMeals||[]).filter(m=>m&&okDate(m.date)&&m.date<=today);
  for(const m of meals){bucket(weeks,weekStart(m.date),'cook',m.date);if(m.fromStock)bucket(weeks,weekStart(m.date),'stock',m.id||(m.recipeTitle+'|'+m.date))}
  for(const a of extras.careActs||[]){if(!a||!okDate(a.date)||a.date>today)continue;if(!CARE_KINDS.includes(a.kind))continue;bucket(weeks,weekStart(a.date),'care',a.date)}
  return weeks}
function weekResult(w,mode){
  const m=MODES[mode]||MODES.normal;
  const have={move:w?w.move.size:0,cook:w?w.cook.size:0,stock:w?w.stock.size:0,care:w?w.care.size:0};
  const done={move:have.move>=m.move,cook:have.cook>=m.cook,stock:have.stock>=TARGET.stock,care:have.care>=TARGET.care};
  const clear=done.move&&done.cook&&done.stock&&done.care;
  const xp=(done.move?XP.move:0)+(done.cook?XP.cook:0)+(done.stock?XP.stock:0)+(done.care?XP.care:0)+(clear?XP.bonus:0);
  return {have,done,clear,xp}}
function addDays(s,n){const d=parse(s);d.setDate(d.getDate()+n);return key(d)}
/* A week's mode is the most recent saved change on or before that Monday, otherwise Normal. Past weeks keep the mode they were played in. */
function modeFor(modes,ws){let best=null;for(const k in (modes||{})){if(k<=ws&&(best===null||k>best))best=k}return best?modes[best]:'normal'}
function dayPaused(day,pauses,today){for(const p of pauses||[]){if(day>=p.from&&day<=(p.to||today))return true}return false}
function weekPaused(ws,pauses,today){for(let i=0;i<7;i++)if(dayPaused(addDays(ws,i),pauses,today))return true;return false}
function activePause(pauses,today){return (pauses||[]).find(p=>p.from<=today&&(!p.to||p.to>=today))||null}
function pbCalc(state,today){
  const logs=((state&&state.trainingLogs)||[]).filter(e=>e&&!e.voided&&e.kind==='set'&&okDate(e.date)&&e.date<=today&&typeof e.exercise==='string'&&Number.isFinite(e.reps)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const hist=new Map(),found=new Set(),cw=weekStart(today);let cur=0;
  for(const e of logs){const k=e.exercise.trim().toLowerCase(),load=Number.isFinite(e.load)?e.load:0,prev=hist.get(k)||[];
    if(prev.length&&prev.every(p=>load>p.load||(load===p.load&&e.reps>p.reps))){const wk=weekStart(e.date),id=wk+'|'+k;if(!found.has(id)){found.add(id);if(wk===cw)cur++}}
    prev.push({load,reps:e.reps});hist.set(k,prev)}
  return {total:found.size,week:cur}}
function bossTarget(m,pauses,today){const [y,mo]=m.split('-').map(Number),n=new Date(y,mo,0).getDate();let p=0;for(let d=1;d<=n;d++)if(dayPaused(m+'-'+pad(d),pauses,today))p++;return p?Math.max(4,Math.ceil(BOSS_TARGET*(n-p)/n)):BOSS_TARGET}
function bossCalc(weeks,pauses,today){
  const month=today.slice(0,7),days=new Map();
  for(const w of Object.keys(weeks))for(const d of weeks[w].move){const m=d.slice(0,7);if(!days.has(m))days.set(m,new Set());days.get(m).add(d)}
  let xp=0,cur={have:0,target:bossTarget(month,pauses,today),done:false,month};
  for(const m of new Set([...days.keys(),month])){if(m>month)continue;const have=days.has(m)?days.get(m).size:0,target=bossTarget(m,pauses,today),done=have>=target;if(done)xp+=XP.boss;if(m===month)cur={have,target,done,month:m}}
  return {xp,cur}}
function streakCalc(weeks,pauses,today,modes){
  const cw=weekStart(today),first=Object.keys(weeks).filter(w=>weeks[w].move.size>0).sort()[0],used=new Set();let streak=0;
  if(first){for(let ws=first;ws<cw;ws=addDays(ws,7)){if(weekPaused(ws,pauses,today))continue;const done=weeks[ws]&&weeks[ws].move.size>=MODES[modeFor(modes,ws)].move;
    if(done)streak++;else{const m=ws.slice(0,7);if(!used.has(m))used.add(m);else streak=0}}}
  if(weeks[cw]&&weeks[cw].move.size>=MODES[modeFor(modes,cw)].move)streak++;
  const m=today.slice(0,7);return {streak,shieldReady:!used.has(m),shieldUsed:used.has(m)}}
function statsCalc(state){
  state=state||{};const logs=(state.trainingLogs||[]).filter(e=>e&&!e.voided);
  const sets=logs.filter(e=>e.kind==='set').length,minutes=logs.filter(e=>e.kind==='cardio'&&Number.isFinite(e.minutes)).reduce((n,e)=>n+e.minutes,0);
  return {str:sets,sta:minutes,foc:(state.cookedMeals||[]).length+(state.groceryRuns||[]).length}}
function compute(state,extras,now){
  const today=typeof now==='string'?now:key(now||new Date());
  const weeks=gather(state,extras,today),modes=(extras&&extras.modes)||{};let total=0;
  for(const w of Object.keys(weeks))total+=weekResult(weeks[w],modeFor(modes,w)).xp;
  const month=today.slice(0,7),photoMonths=[...new Set(((extras&&extras.photoMonths)||[]).filter(m=>/^\d{4}-\d{2}$/.test(m)&&m<=month))];
  total+=photoMonths.length*XP.photo;
  const pauses=((extras&&extras.pauses)||[]),pb=pbCalc(state,today),boss=bossCalc(weeks,pauses,today),streak=streakCalc(weeks,pauses,today,modes);
  total+=pb.total*XP.pb+boss.xp;
  const cws=weekStart(today),curMode=modeFor(modes,cws),cm=MODES[curMode],nextMon=addDays(cws,7),cur=weekResult(weeks[cws],curMode),pending=modes[nextMon]&&modes[nextMon]!==curMode?modes[nextMon]:null;
  return {total,week:cur,weekStart:cws,mode:curMode,pendingMode:pending,photoDone:photoMonths.includes(month),pb,boss:boss.cur,streak,paused:activePause(pauses,today),stats:statsCalc(state),
    rows:[
      {id:'move',label:'Move',detail:'Train or do cardio on '+cm.move+' days',have:cur.have.move,target:cm.move,xp:XP.move,done:cur.done.move},
      {id:'cook',label:'Cook',detail:'Cook '+cm.cook+(cm.cook===1?' meal':' meals on different days'),have:cur.have.cook,target:cm.cook,xp:XP.cook,done:cur.done.cook},
      {id:'stock',label:'Cook from stock',detail:'Cook 2 meals using only what\'s in stock',have:cur.have.stock,target:TARGET.stock,xp:XP.stock,done:cur.done.stock},
      {id:'care',label:'Kind to self',detail:'Any 2 small acts this week (rest, water, walk, cat time, fresh air, calm, thanks, reach out)',have:cur.have.care,target:TARGET.care,xp:XP.care,done:cur.done.care},
      {id:'clear',label:'Clear bonus',detail:'Finish all three this week',have:cur.clear?1:0,target:1,xp:XP.bonus,done:cur.clear}]}}
const STORE='levelup-missions-v1',MIN_DINNERS=3;
function cleanPauses(a){return (Array.isArray(a)?a:[]).filter(p=>p&&okDate(p.from)&&(p.to===null||p.to===undefined||okDate(p.to)&&p.to>=p.from)).map(p=>({from:p.from.slice(0,10),to:p.to?p.to.slice(0,10):null,reason:REASONS.includes(p.reason)?p.reason:'other'})).slice(-40)}
function cleanTier(t){return Number.isInteger(t)&&t>=1&&t<=6?t:0}
function cleanModes(m){const out={};if(!m||typeof m!=='object'||Array.isArray(m))return out;for(const k of Object.keys(m).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&Object.prototype.hasOwnProperty.call(MODES,m[k])).sort().slice(-120))out[k]=m[k];return out}
function cleanCareActs(a){return (Array.isArray(a)?a:[]).filter(x=>x&&okDate(x.date)&&CARE_KINDS.includes(x.kind)).map(x=>({date:x.date.slice(0,10),kind:x.kind})).slice(-400)}
function load(){try{const o=JSON.parse(root.localStorage.getItem(STORE)||'{}');return {pauses:cleanPauses(o.pauses),modes:cleanModes(o.modes),seenTier:cleanTier(o.seenTier),photoMonths:Array.isArray(o.photoMonths)?o.photoMonths.filter(m=>/^\d{4}-\d{2}$/.test(m)).slice(-120):[],careActs:cleanCareActs(o.careActs)}}catch(e){return {modes:{},seenTier:0,photoMonths:[],careActs:[]}}}
function save(o){try{root.localStorage.setItem(STORE,JSON.stringify({photoMonths:o.photoMonths,pauses:cleanPauses(o.pauses),modes:cleanModes(o.modes),seenTier:cleanTier(o.seenTier),careActs:cleanCareActs(o.careActs)}))}catch(e){}}
function logCare(kind){if(!CARE_KINDS.includes(kind))return false;const o=load(),d=key(new Date()),acts=o.careActs||[];if(acts.some(a=>a.date===d&&a.kind===kind))return false;acts.push({date:d,kind});o.careActs=acts;save(o);notify();return true}
function unlogCare(kind){const o=load(),d=key(new Date());const before=(o.careActs||[]).length;o.careActs=(o.careActs||[]).filter(a=>!(a.date===d&&a.kind===kind));if(o.careActs.length!==before){save(o);notify();return true}return false}
function careToday(){const o=load(),d=key(new Date());return new Set((o.careActs||[]).filter(a=>a.date===d).map(a=>a.kind))}
function recordPhoto(){const o=load(),m=key(new Date()).slice(0,7);if(!o.photoMonths.includes(m)){o.photoMonths.push(m);save(o);notify()}}
function pause(reason,to){const o=load(),t=key(new Date());if(activePause(o.pauses,t))return false;const end=okDate(to)&&to.slice(0,10)>=t?to.slice(0,10):null;o.pauses.push({from:t,to:end,reason:REASONS.includes(reason)?reason:'other'});save(o);notify();return true}
function resume(){const o=load(),t=key(new Date()),y=addDays(t,-1);o.pauses=o.pauses.filter(p=>!(p.from<=t&&(!p.to||p.to>=t)&&p.from>=t)).map(p=>(p.from<=t&&(!p.to||p.to>=t))?Object.assign({},p,{to:y}):p);save(o);notify()}
function getSeenTier(){return load().seenTier}
function setSeenTier(t){const o=load();o.seenTier=cleanTier(t);save(o)}
function getMode(now){const o=load(),t=typeof now==='string'?now:key(now||new Date()),ws=weekStart(t),nm=addDays(ws,7),cur=modeFor(o.modes,ws);return {mode:cur,pending:o.modes[nm]&&o.modes[nm]!==cur?o.modes[nm]:null}}
/* Any change takes effect next Monday, so a week is always judged by the pace it started with. Choosing the current pace cancels a pending change. */
function setMode(mode,now){if(!Object.prototype.hasOwnProperty.call(MODES,mode))return null;const o=load(),t=typeof now==='string'?now:key(now||new Date()),ws=weekStart(t),nm=addDays(ws,7),cur=modeFor(o.modes,ws),modes={};for(const k of Object.keys(o.modes))if(k<=ws)modes[k]=o.modes[k];let when='now';if(mode!==cur){modes[nm]=mode;when='next'}o.modes=modes;save(o);notify();return {mode,when,week:ws}}
function notify(){try{root.document.dispatchEvent(new root.CustomEvent('bloom-training-xp',{detail:{mission:true}}))}catch(e){}}
function bonus(state){return compute(state,load()).total}
function status(state){return compute(state,load())}
const api={TARGET,MODES,MODE_ORDER,setMode,getMode,getSeenTier,setSeenTier,XP,BOSS_TARGET,MIN_DINNERS,CARE_KINDS,weekStart,compute,bonus,status,notify,recordPhoto,load,pause,resume,logCare,unlogCare,careToday};
const C=root.BloomCore;
if(C&&typeof C.trainingXP==='function'&&!C.__missionsPatched){
  const base=C.trainingXP;
  C.trainingXP=function(d){const r=base(d);let b=0;try{b=bonus(d)}catch(e){}const total=r.total+b;return Object.assign({},r,{total,level:1+Math.floor(total/100),towards:total%100,mistUnlocked:total>=100,missionBonus:b})};
  C.__missionsPatched=true}
return api});
