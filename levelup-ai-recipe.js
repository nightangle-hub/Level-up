/* RaiKiba AI recipe import. Adds "Fill with AI" above the New recipe form.
   Paste recipe text or choose a photo; the AI fills the existing form fields. Nothing is saved until you tap Save recipe.
   The text or photo goes to your own Supabase function and is not kept. */
(function(){
'use strict';
const URL_='https://rogzuvlaoqjqhwnqoipk.supabase.co',KEY='sb_publishable_y0DB7IhtAvpHSGxtI3YKUA_MGAW0gTD';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const st={busy:false,msg:'',text:''};
const num=n=>typeof n==='number'&&isFinite(n);
function session(){try{const m=JSON.parse(localStorage.getItem('raikiba-sync-meta-v1')||'null');return m&&m.session||null}catch(e){return null}}
function shrink(file){return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const s=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res({mime:'image/jpeg',data:c.toDataURL('image/jpeg',0.82).split(',')[1]})};img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('Could not open that photo.'))};img.src=u})}
async function freshSession(){
  let s=session();
  if(!s)throw new Error('Sign in first: Settings, then Sync across devices.');
  if(s.expires_at-Date.now()/1000<60&&window.RaiKibaSync&&window.RaiKibaSync.sync){try{await window.RaiKibaSync.sync('ai')}catch(e){}s=session()}
  if(!s||s.expires_at-Date.now()/1000<20)throw new Error('Your sign in expired. Open Settings, tap Sync now, then try again.');
  return s}
// One ingredient line in the form the app already understands ("200 g firm tofu", "2 eggs", or the original wording).
function line(i){
  const name=String(i&&i.name||'').trim(),orig=String(i&&i.original||'').trim();
  if(!name&&!orig)return '';
  if(num(i.amount)&&i.amount>0){
    if(i.unit==='g'||i.unit==='ml')return (Math.round(i.amount*100)/100)+' '+i.unit+' '+name;
    if(i.unit==='pieces')return (Math.round(i.amount*100)/100)+' '+name}
  return orig||name}
function toForm(r){
  const ing=(Array.isArray(r.ingredients)?r.ingredients:[]).map(line).filter(Boolean);
  const steps=(Array.isArray(r.steps)?r.steps:[]).map(s=>String(s).trim()).filter(Boolean);
  if(!r.title||!ing.length||!steps.length)throw new Error('The AI could not find a full recipe (name, ingredients and method). Try more text or a clearer photo.');
  const notes=[];
  if(r.pescatarian===false)notes.push('Heads up: this recipe is not pescatarian.');
  if(Array.isArray(r.questions)&&r.questions.length)notes.push('Check: '+r.questions.slice(0,3).map(String).join(' '));
  return {title:String(r.title).slice(0,120),servings:num(r.serves)?String(r.serves):'',ingredients:ing.join('\n'),steps:steps.join('\n'),notes:notes.join(' '),warn:notes.join(' ')}}
function setField(id,v){const el=document.getElementById(id);if(!el)return false;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));return true}
async function run(file){
  if(st.busy)return;
  const text=(st.text||'').trim();
  if(!file&&text.length<20){st.msg='Paste a recipe first (at least a few lines), or choose a photo.';draw();return}
  st.busy=true;st.msg='Reading the recipe with AI. This takes about 5 to 20 seconds.';draw();
  try{
    const s=await freshSession(),images=file?[await shrink(file)]:[];
    const r=await fetch(URL_+'/functions/v1/ai-assist',{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+s.access_token},body:JSON.stringify({task:'recipe',text:text||'Read this recipe.',images}),signal:AbortSignal.timeout(120000)});
    const j=await r.json().catch(()=>({}));
    if(r.status===429)throw new Error('AI limit reached for now. Try again in a minute, or use the ChatGPT buttons above.');
    if(!r.ok||!j.parsed)throw new Error('The AI did not return a readable answer. Try again, or use the ChatGPT buttons above.');
    const f=toForm(j.parsed);
    if(!setField('recTitle',f.title)||!setField('recIngredients',f.ingredients)||!setField('recSteps',f.steps))throw new Error('Open New recipe and try again.');
    setField('recServings',f.servings);setField('recNotes',f.notes);
    st.busy=false;st.text='';st.msg='Done. Check the name, amounts and method below, then tap Save recipe. Nothing is saved yet.'+(f.warn?' '+f.warn:'');draw()
  }catch(e){st.busy=false;st.msg=(e&&e.name==='TimeoutError')?'The AI took too long. Try again, or use the ChatGPT buttons above.':(e&&(e.name==='TypeError'||/failed to fetch|network|load failed/i.test(e.message||'')))?'Could not reach the AI. Check your connection, or use the ChatGPT buttons above.':(e&&e.message)||'Something went wrong. Use the ChatGPT buttons above.';draw()}}
function html(){
  const dis=st.busy?' disabled':'';
  return '<div class="detail" id="luAiRecipe"><h2 style="margin:0 0 6px">Fill with AI</h2><p class="capture-note">Paste a recipe or choose a photo. The AI fills the form below. Nothing is saved until you tap Save recipe.</p><textarea id="luAiRecipeText" rows="4" maxlength="20000" placeholder="Paste a recipe here" aria-label="Recipe text"'+dis+'>'+esc(st.text)+'</textarea><div class="action-row"><button type="button" class="subtle-button" id="luAiRecipeGo"'+dis+'>'+(st.busy?'Reading...':'Fill from text')+'</button><label class="subtle-button" for="luAiRecipeFile" style="display:inline-flex"'+dis+'>Use a photo</label><input id="luAiRecipeFile" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only"'+dis+'></div>'+(st.msg?'<p class="capture-note" role="status">'+esc(st.msg)+'</p>':'')+'</div>'}
let lastSig='';
function draw(){
  const form=document.getElementById('recipeForm'),have=document.getElementById('luAiRecipe');
  const t=form&&document.getElementById('recTitle');
  if(!form||!t||(t.value&&!have&&!st.msg)){if(have)have.remove();return}
  const h=html();if(have&&have.parentNode===form.parentNode&&lastSig===h)return;
  lastSig=h;const tpl=document.createElement('template');tpl.innerHTML=h;
  if(have)have.remove();
  form.parentNode.insertBefore(tpl.content.firstChild,form)}
document.addEventListener('input',e=>{if(e.target&&e.target.id==='luAiRecipeText')st.text=e.target.value},true);
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#luAiRecipeGo'):null;if(b){e.preventDefault();run(null)}},true);
document.addEventListener('change',e=>{const t=e.target;if(!t||t.id!=='luAiRecipeFile')return;const f=t.files&&t.files[0];if(f)run(f);t.value=''},true);
let q=false;function schedule(){if(q)return;q=true;(window.requestAnimationFrame||setTimeout)(()=>{q=false;try{draw()}catch(e){}})}
function start(){if(window.MutationObserver&&document.body)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule()}
window.LevelUpAiRecipe={toForm,line};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
