/* RaiKiba weekly missions. Mission XP is derived from existing records, so nothing here can drift out of sync.
   Move: 3 days with a training session or cardio, 30 XP. Cook: 2 days with a cooked meal, 10 XP.
   Plan: save a weekly dinner plan of 3 or more dinners, 10 XP. Clear bonus: all three in one week, 10 XP.
   Monthly photo check: 10 XP per month. Personal best: 10 XP per exercise per week when you beat every earlier set.
   Monthly boss: train on 12 days in a calendar month, 30 XP. Streak: weeks with 3 move days; one missed week a month is forgiven (shield).
   Pauses (holiday, injury) are stored in levelup-missions-v1 and skip streak weeks and shrink the boss target. Weeks start on Monday. Looks and daily care earn no XP. */
(function(root,factory){const api=factory(root);if(typeof module==='object')module.exports=api;else root.LevelUpMissions=api})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const TARGET={move:3,cook:2,plan:1},XP={move:30,cook:10,plan:10,bonus:10,photo:10,pb:10,boss:30},BOSS_TARGET=12,REASONS=['holiday','injury','other'];
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const okDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}/.test(s);
const parse=s=>{const[y,m,d]=s.slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
function weekStart(s){const d=parse(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return key(d)}
function localDay(v){if(!okDate(v))return null;if(v.length<=10)return v;const d=new Date(v);return isNaN(d)?v.slice(0,10):key(d)}
function bucket(map,week,kind,day){if(!map[week])map[week]={move:new Set(),cook:new Set(),plan:new Set()};map[week][kind].add(day)}
function gather(state,extras,today){
  const weeks={};state=state||{};extras=extras||{};
  for(const e of state.trainingLogs||[]){if(!e||e.voided||!okDate(e.date)||e.date>today)continue;if(e.kind==='session'||e.kind==='cardio'||e.kind==='set')bucket(weeks,weekStart(e.date),'move',e.date)}
  for(const m of state.cookedMeals||[]){if(!m||!okDate(m.date)||m.date>today)continue;bucket(weeks,weekStart(m.date),'cook',m.date)}
  const thisWeek=weekStart(today);
  for(const w of extras.planWeeks||[]){if(!okDate(w)||w>thisWeek)continue;bucket(weeks,weekStart(w),'plan',w.slice(0,10))}
  return weeks}
function weekResult(w){
  const have={move:w?w.move.size:0,cook:w?w.cook.size:0,plan:w?w.plan.size:0};
  const done={move:have.move>=TARGET.move,cook:have.cook>=TARGET.cook,plan:have.plan>=TARGET.plan};
  const clear=done.move&&done.cook&&done.plan;
  const xp=(done.move?XP.move:0)+(done.cook?XP.cook:0)+(done.plan?XP.plan:0)+(clear?XP.bonus:0);
  return {have,done,clear,xp}}
function addDays(s,n){const d=parse(s);d.setDate(d.getDate()+n);return key(d)}
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
function streakCalc(weeks,pauses,today){
  const cw=weekStart(today),first=Object.keys(weeks).filter(w=>weeks[w].move.size>0).sort()[0],used=new Set();let streak=0;
  if(first){for(let ws=first;ws<cw;ws=addDays(ws,7)){if(weekPaused(ws,pauses,today))continue;const done=weeks[ws]&&weeks[ws].move.size>=TARGET.move;
    if(done)streak++;else{const m=ws.slice(0,7);if(!used.has(m))used.add(m);else streak=0}}}
  if(weeks[cw]&&weeks[cw].move.size>=TARGET.move)streak++;
  const m=today.slice(0,7);return {streak,shieldReady:!used.has(m),shieldUsed:used.has(m)}}
function statsCalc(state){
  state=state||{};const logs=(state.trainingLogs||[]).filter(e=>e&&!e.voided);
  const sets=logs.filter(e=>e.kind==='set').length,minutes=logs.filter(e=>e.kind==='cardio'&&Number.isFinite(e.minutes)).reduce((n,e)=>n+e.minutes,0);
  return {str:sets,sta:minutes,foc:(state.cookedMeals||[]).length+(state.groceryRuns||[]).length}}
function compute(state,extras,now){
  const today=typeof now==='string'?now:key(now||new Date());
  const weeks=gather(state,extras,today);let total=0;
  for(const w of Object.keys(weeks))total+=weekResult(weeks[w]).xp;
  const month=today.slice(0,7),photoMonths=[...new Set(((extras&&extras.photoMonths)||[]).filter(m=>/^\d{4}-\d{2}$/.test(m)&&m<=month))];
  total+=photoMonths.length*XP.photo;
  const pauses=((extras&&extras.pauses)||[]),pb=pbCalc(state,today),boss=bossCalc(weeks,pauses,today),streak=streakCalc(weeks,pauses,today);
  total+=pb.total*XP.pb+boss.xp;
  const cur=weekResult(weeks[weekStart(today)]);
  return {total,week:cur,weekStart:weekStart(today),photoDone:photoMonths.includes(month),pb,boss:boss.cur,streak,paused:activePause(pauses,today),stats:statsCalc(state),
    rows:[
      {id:'move',label:'Move',detail:'Train or do cardio on 3 days',have:cur.have.move,target:TARGET.move,xp:XP.move,done:cur.done.move},
      {id:'cook',label:'Cook',detail:'Cook 2 meals on different days',have:cur.have.cook,target:TARGET.cook,xp:XP.cook,done:cur.done.cook},
      {id:'plan',label:'Plan',detail:'Save a plan of 3 or more dinners',have:cur.have.plan,target:TARGET.plan,xp:XP.plan,done:cur.done.plan},
      {id:'clear',label:'Clear bonus',detail:'Finish all three this week',have:cur.clear?1:0,target:1,xp:XP.bonus,done:cur.clear}]}}
const STORE='levelup-missions-v1',PLAN_STORE='levelup-mealplan-v1',MIN_DINNERS=3;
function planWeeks(){try{const o=JSON.parse(root.localStorage.getItem(PLAN_STORE)||'{}'),w=o.weeks||{};return Object.keys(w).filter(k=>okDate(k)&&w[k]&&w[k].days&&Object.keys(w[k].days).filter(d=>w[k].days[d]&&w[k].days[d].id).length>=MIN_DINNERS)}catch(e){return []}}
function cleanPauses(a){return (Array.isArray(a)?a:[]).filter(p=>p&&okDate(p.from)&&(p.to===null||p.to===undefined||okDate(p.to)&&p.to>=p.from)).map(p=>({from:p.from.slice(0,10),to:p.to?p.to.slice(0,10):null,reason:REASONS.includes(p.reason)?p.reason:'other'})).slice(-40)}
function load(){try{const o=JSON.parse(root.localStorage.getItem(STORE)||'{}');return {planWeeks:planWeeks(),pauses:cleanPauses(o.pauses),photoMonths:Array.isArray(o.photoMonths)?o.photoMonths.filter(m=>/^\d{4}-\d{2}$/.test(m)).slice(-120):[]}}catch(e){return {planWeeks:[],photoMonths:[]}}}
function save(o){try{root.localStorage.setItem(STORE,JSON.stringify({photoMonths:o.photoMonths,pauses:cleanPauses(o.pauses)}))}catch(e){}}
function recordPhoto(){const o=load(),m=key(new Date()).slice(0,7);if(!o.photoMonths.includes(m)){o.photoMonths.push(m);save(o);notify()}}
function pause(reason,to){const o=load(),t=key(new Date());if(activePause(o.pauses,t))return false;const end=okDate(to)&&to.slice(0,10)>=t?to.slice(0,10):null;o.pauses.push({from:t,to:end,reason:REASONS.includes(reason)?reason:'other'});save(o);notify();return true}
function resume(){const o=load(),t=key(new Date()),y=addDays(t,-1);o.pauses=o.pauses.filter(p=>!(p.from<=t&&(!p.to||p.to>=t)&&p.from>=t)).map(p=>(p.from<=t&&(!p.to||p.to>=t))?Object.assign({},p,{to:y}):p);save(o);notify()}
function notify(){try{root.document.dispatchEvent(new root.CustomEvent('bloom-training-xp',{detail:{mission:true}}))}catch(e){}}
function bonus(state){return compute(state,load()).total}
function status(state){return compute(state,load())}
const api={TARGET,XP,BOSS_TARGET,MIN_DINNERS,weekStart,compute,bonus,status,notify,recordPhoto,load,pause,resume};
const C=root.BloomCore;
if(C&&typeof C.trainingXP==='function'&&!C.__missionsPatched){
  const base=C.trainingXP;
  C.trainingXP=function(d){const r=base(d);let b=0;try{b=bonus(d)}catch(e){}const total=r.total+b;return Object.assign({},r,{total,level:1+Math.floor(total/100),towards:total%100,mistUnlocked:total>=100,missionBonus:b})};
  C.__missionsPatched=true}
return api});
