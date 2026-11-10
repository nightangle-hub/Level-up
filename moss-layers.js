(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MossLayers=factory()})(globalThis,function(){
'use strict';
const KEY='raikiba-wardrobe-v1',DIR='assets/companion/layers/',THUMB='assets/companion/thumbs/';
// slot = where it sits. One item per slot, two items at most, so nothing crowds Moss.
const ITEMS=[
 {id:'glasses_round',name:'Round glasses',slot:'face',xp:100,layer:'glasses_round',z:'front'},
 {id:'crown',name:'Flower crown',slot:'hat',xp:200,layer:'crown',z:'front'},
 {id:'scarf',name:'Cosy scarf',slot:'neck',xp:300,layer:'scarf',z:'front'},
 {id:'beanie',name:'Knitted beanie',slot:'hat',xp:500,layer:'beanie',z:'front'},
 {id:'matcha',name:'Iced matcha',slot:'held',xp:700,layer:'matcha',z:'held'},
 {id:'cat_front',name:'Cat ears',slot:'hat',xp:1000,layer:'cat_front',back:'cat_back',z:'front'},
 {id:'glasses_star',name:'Star glasses',slot:'face',xp:1400,layer:'glasses_star',z:'front'},
 {id:'book',name:'Little book',slot:'held',xp:1800,layer:'book',z:'held'},
 {id:'straw',name:'Straw hat',slot:'hat',xp:2400,layer:'straw',z:'front'},
 {id:'bow',name:'Hair bow',slot:'clip',xp:3200,layer:'bow',z:'front'},
 {id:'bowtie',name:'Bow tie',slot:'neck',xp:4200,layer:'bowtie',z:'front'},
 {id:'sunglasses',name:'Sunglasses',slot:'face',xp:5000,layer:'sunglasses',z:'front'}
];
const MAX=2,byId=new Map(ITEMS.map(i=>[i.id,i]));
const unlocked=xp=>ITEMS.filter(i=>Number.isFinite(xp)&&xp>=i.xp);
const next=xp=>ITEMS.find(i=>!(xp>=i.xp))||null;
function clean(ids,xp){const have=new Set(unlocked(xp).map(i=>i.id)),slots=new Set(),out=[];for(const id of Array.isArray(ids)?ids:[]){const it=byId.get(id);if(!it||!have.has(id)||slots.has(it.slot)||out.length>=MAX)continue;slots.add(it.slot);out.push(id)}return out}
function load(storage){try{const o=JSON.parse(storage.getItem(KEY)||'{}');return{equipped:Array.isArray(o.equipped)?o.equipped.filter(x=>typeof x==='string'):[]}}catch{return{equipped:[]}}}
function save(storage,eq){try{storage.setItem(KEY,JSON.stringify({equipped:eq}));return true}catch{return false}}
// Tapping an item: take it off if worn; otherwise put it on, replacing the same slot, and drop the oldest if that would make three.
function toggle(equipped,id,xp){const it=byId.get(id);if(!it||!(xp>=it.xp))return equipped.slice();if(equipped.includes(id))return equipped.filter(x=>x!==id);let out=equipped.filter(x=>byId.get(x)&&byId.get(x).slot!==it.slot);out.push(id);while(out.length>MAX)out.shift();return out}
const img=n=>`<img src="${DIR}${n}.webp" alt="" draggable="false">`;
function html({mood='awake',equipped=[],label='Moss'}={}){
 const items=equipped.map(id=>byId.get(id)).filter(Boolean),has=items.some(i=>i.z==='held');
 const back=items.filter(i=>i.back).map(i=>`<span class="moss-l moss-back">${img(i.back)}</span>`).join('');
 const front=items.filter(i=>i.z==='front').map(i=>`<span class="moss-l moss-acc">${img(i.layer)}</span>`).join('');
 const held=items.filter(i=>i.z==='held').map(i=>`<span class="moss-l moss-acc">${img(i.layer)}</span>`).join('');
 return `<span class="moss" data-mood="${mood}" role="img" aria-label="${label}"><span class="moss-in">${back}<span class="moss-l">${img('body')}</span><span class="moss-l">${img('cheekL')}${img('cheekR')}</span><span class="moss-l moss-eyeL">${img('eyeL')}</span><span class="moss-l moss-eyeR">${img('eyeR')}</span><span class="moss-l">${img('mouth')}</span><span class="moss-l moss-sprout">${img('sprout')}</span>${front}${held}${has?`<span class="moss-l">${img('hands')}</span>`:''}</span></span>`}
const css=`.moss{position:relative;display:block;width:100%;aspect-ratio:1000/1070;pointer-events:none}.moss-in{position:absolute;inset:0;display:block;transform-origin:50% 95%;animation:moss-breathe 4.2s ease-in-out infinite}.moss-l{position:absolute;inset:0;display:block}.moss-l img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;animation:none!important;filter:none!important}.moss-eyeL{transform-origin:36.3% 54.4%;animation:moss-eyeL 16.2s infinite}.moss-eyeR{transform-origin:62.2% 53.2%;animation:moss-eyeR 16.2s infinite}.moss-sprout{transform-origin:50.5% 24.3%;animation:moss-sway 6s ease-in-out infinite}.moss[data-mood=sleep] .moss-eyeL,.moss[data-mood=sleep] .moss-eyeR{animation:none;transform:scaleY(.08)}.moss[data-mood=sleep] .moss-in{animation-duration:6s}.moss[data-mood=happy] .moss-in{animation:moss-hop .9s ease-out 2}.moss[data-mood=happy] .moss-eyeL,.moss[data-mood=happy] .moss-eyeR{animation:none;transform:scaleY(.3)}@keyframes moss-breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.012)}}@keyframes moss-sway{0%,100%{transform:rotate(-3.5deg)}50%{transform:rotate(3.5deg)}}@keyframes moss-hop{0%,100%{transform:translateY(0) scaleY(1)}30%{transform:translateY(-7%) scaleY(1.03)}60%{transform:translateY(0) scaleY(.97)}}@keyframes moss-eyeR{0%,31%,36%,64%,69%,100%{transform:scaleY(1)}33.3%,66.6%{transform:scaleY(.08)}}@keyframes moss-eyeL{0%,31%,36%,64%,69%,93%,100%{transform:scaleY(1)}33.3%,66.6%,96.5%{transform:scaleY(.08)}}@keyframes moss-pop{0%{transform:scale(1)}40%{transform:scale(1.06)}100%{transform:scale(1)}}.moss.moss-pop{animation:moss-pop .45s ease-out}@media(prefers-reduced-motion:reduce){.moss,.moss *{animation:none!important}}.buddy-still .moss *{animation:none!important}`;
return {KEY,ITEMS,MAX,byId,unlocked,next,clean,load,save,toggle,html,css,thumb:id=>THUMB+(byId.get(id)?.layer||id)+'.webp'};
});
