/* Level Up weekly missions. Mission XP is derived from existing records, so nothing here can drift out of sync.
   Move: 3 days with a training session or cardio, 30 XP. Cook: 2 days with a cooked meal, 10 XP.
   Plan: save a weekly dinner plan of 3 or more dinners, 10 XP. Clear bonus: all three in one week, 10 XP.
   Monthly photo check: 10 XP per month. Weeks start on Monday. Looks and daily care earn no XP. */
(function(root,factory){const api=factory(root);if(typeof module==='object')module.exports=api;else root.LevelUpMissions=api})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const TARGET={move:3,cook:2,plan:1},XP={move:30,cook:10,plan:10,bonus:10,photo:10};
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const okDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}/.test(s);
const parse=s=>{const[y,m,d]=s.slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
function weekStart(s){const d=parse(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return key(d)}
function localDay(v){if(!okDate(v))return null;if(v.length<=10)return v;const d=new Date(v);return isNaN(d)?v.slice(0,10):key(d)}
function bucket(map,week,kind,day){if(!map[week])map[week]={move:new Set(),cook:new Set(),plan:new Set()};map[week][kind].add(day)}
function gather(state,extras,today){
  const weeks={};state=state||{};extras=extras||{};
  for(const e of state.trainingLogs||[]){if(!e||e.voided||!okDate(e.date)||e.date>today)continue;if(e.kind==='session'||e.kind==='cardio')bucket(weeks,weekStart(e.date),'move',e.date)}
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
function compute(state,extras,now){
  const today=typeof now==='string'?now:key(now||new Date());
  const weeks=gather(state,extras,today);let total=0;
  for(const w of Object.keys(weeks))total+=weekResult(weeks[w]).xp;
  const month=today.slice(0,7),photoMonths=[...new Set(((extras&&extras.photoMonths)||[]).filter(m=>/^\d{4}-\d{2}$/.test(m)&&m<=month))];
  total+=photoMonths.length*XP.photo;
  const cur=weekResult(weeks[weekStart(today)]);
  return {total,week:cur,weekStart:weekStart(today),photoDone:photoMonths.includes(month),
    rows:[
      {id:'move',label:'Move',detail:'Train or do cardio on 3 days',have:cur.have.move,target:TARGET.move,xp:XP.move,done:cur.done.move},
      {id:'cook',label:'Cook',detail:'Cook 2 meals on different days',have:cur.have.cook,target:TARGET.cook,xp:XP.cook,done:cur.done.cook},
      {id:'plan',label:'Plan',detail:'Save a plan of 3 or more dinners',have:cur.have.plan,target:TARGET.plan,xp:XP.plan,done:cur.done.plan},
      {id:'clear',label:'Clear bonus',detail:'Finish all three this week',have:cur.clear?1:0,target:1,xp:XP.bonus,done:cur.clear}]}}
const STORE='levelup-missions-v1',PLAN_STORE='levelup-mealplan-v1',MIN_DINNERS=3;
function planWeeks(){try{const o=JSON.parse(root.localStorage.getItem(PLAN_STORE)||'{}'),w=o.weeks||{};return Object.keys(w).filter(k=>okDate(k)&&w[k]&&w[k].days&&Object.keys(w[k].days).filter(d=>w[k].days[d]&&w[k].days[d].id).length>=MIN_DINNERS)}catch(e){return []}}
function load(){try{const o=JSON.parse(root.localStorage.getItem(STORE)||'{}');return {planWeeks:planWeeks(),photoMonths:Array.isArray(o.photoMonths)?o.photoMonths.filter(m=>/^\d{4}-\d{2}$/.test(m)).slice(-120):[]}}catch(e){return {planWeeks:[],photoMonths:[]}}}
function save(o){try{root.localStorage.setItem(STORE,JSON.stringify({photoMonths:o.photoMonths}))}catch(e){}}
function recordPhoto(){const o=load(),m=key(new Date()).slice(0,7);if(!o.photoMonths.includes(m)){o.photoMonths.push(m);save(o);notify()}}
function notify(){try{root.document.dispatchEvent(new root.CustomEvent('bloom-training-xp',{detail:{mission:true}}))}catch(e){}}
function bonus(state){return compute(state,load()).total}
function status(state){return compute(state,load())}
const api={TARGET,XP,MIN_DINNERS,weekStart,compute,bonus,status,notify,recordPhoto,load};
const C=root.BloomCore;
if(C&&typeof C.trainingXP==='function'&&!C.__missionsPatched){
  const base=C.trainingXP;
  C.trainingXP=function(d){const r=base(d);let b=0;try{b=bonus(d)}catch(e){}const total=r.total+b;return Object.assign({},r,{total,level:1+Math.floor(total/100),towards:total%100,mistUnlocked:total>=100,missionBonus:b})};
  C.__missionsPatched=true}
return api});
