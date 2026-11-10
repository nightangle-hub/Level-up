/* Moss scenes: painted places that unlock with XP and sit softly behind the Today page. */
(function(){
const KEY='raikiba-scene-v1';
const ITEMS=[['s07','Firefly footbridge',150],['s08','Little herb terrace',350],['s09','Seashell inlet',550],['s10','Autumn picnic',800],['s11','Snowdrop path',1100],['s12','Quiet station',1400],['s14','Aurora cove',1800],['m02','Floating tea house',2200],['m03','Maple lantern walk',2700],['m04','Crystal spring',3200],['m06','Festival of little lights',3800],['m07','The waking woodland',4400],['m08','Drifting cloud harbour',5100],['m09','Moonlit paper garden',5800],['r01','Lantern moon creek',6600],['r02','Glowmoss hollow',7500],['r03','Cotton cloud stairs',8500],['r04','Harbour of paper boats',9500],['r05','Tidewind meadow',10500],['r06','Starlit tea garden',12000]].map(([id,name,xp])=>({id,name,xp}));
const byId=id=>ITEMS.find(i=>i.id===id)||null;
function choice(){try{const v=JSON.parse(localStorage.getItem(KEY)||'{}').choice;return v==='none'||byId(v)?v:'auto'}catch(e){return 'auto'}}
function setChoice(v){try{localStorage.setItem(KEY,JSON.stringify({choice:v}))}catch(e){}}
function unlocked(xp){return ITEMS.filter(i=>xp>=i.xp)}
function current(xp){const c=choice(),u=unlocked(xp);if(c==='none')return null;if(c!=='auto'){const i=byId(c);if(i&&xp>=i.xp)return i}return u.length?u[u.length-1]:null}
function next(xp){return ITEMS.find(i=>xp<i.xp)||null}
const bg=id=>'assets/scenes/'+id+'.webp',thumb=id=>'assets/scenes/'+id+'-t.webp';
function apply(app,on,xp){let el=document.getElementById('mossScene');const s=on?current(xp):null;app.classList.toggle('scene-on',!!s);if(!s){if(el)el.remove();return}if(!el){el=document.createElement('div');el.id='mossScene';el.setAttribute('aria-hidden','true');app.insertBefore(el,app.firstChild)}const u=new URL(bg(s.id),document.baseURI).href;if(el.dataset.id!==s.id){el.dataset.id=s.id;el.style.setProperty('--scene-img','url("'+u+'")')}}
function html(xp){const c=choice(),cur=current(xp),nx=next(xp),have=unlocked(xp).length;
const tile=(id,label,img,ok,pressed,extra)=>'<button type="button" class="sc" data-scene-pick="'+id+'" aria-pressed="'+pressed+'" '+(ok?'':'disabled')+'>'+(img?'<img src="'+img+'" alt="" loading="lazy">':'<i class="sc-none"></i>')+'<span>'+label+'</span>'+(extra||'')+'</button>';
return '<h2 class="wd-h">Scenes</h2><p class="capture-note">A place that sits softly behind Today. '+have+' of '+ITEMS.length+' unlocked.'+(nx?' Next: '+nx.name+' at '+nx.xp+' XP.':'')+'</p><div class="scenes">'+tile('auto','Newest',null,true,c==='auto')+tile('none','None',null,true,c==='none')+ITEMS.map(i=>{const ok=xp>=i.xp;return tile(i.id,i.name,ok?thumb(i.id):null,ok,ok&&cur&&c!=='auto'&&c!=='none'&&cur.id===i.id,ok?'':'<small>At '+i.xp+' XP</small>')}).join('')+'</div>'}
window.MossScenes={ITEMS,KEY,choice,setChoice,unlocked,current,next,bg,thumb,apply,html};
})();
