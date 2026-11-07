/* RaiKiba AI receipt reading. Adds a "Read with AI" button to Add a grocery shop.
   The AI answer is turned into the same plain text the app already accepts from ChatGPT
   (Store / Date / NAME xQTY TOTAL / Total), then handed to the existing review screens.
   Nothing is saved to stock here. The photo is sent to your own Supabase function and is not kept. */
(function(){
'use strict';
const URL_='https://rogzuvlaoqjqhwnqoipk.supabase.co',KEY='sb_publishable_y0DB7IhtAvpHSGxtI3YKUA_MGAW0gTD';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const st={busy:false,msg:''};
function session(){try{const m=JSON.parse(localStorage.getItem('raikiba-sync-meta-v1')||'null');return m&&m.session||null}catch(e){return null}}
function shrink(file){return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const s=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res({mime:'image/jpeg',data:c.toDataURL('image/jpeg',0.82).split(',')[1]})};img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('Could not open that photo.'))};img.src=u})}
const num=n=>typeof n==='number'&&isFinite(n);
function sizeText(l){
  if(!num(l.packAmount)||!l.packUnit||l.packUnit==='pieces')return '';
  const a=l.packAmount;
  if(l.packUnit==='g')return a>=1000?(Math.round(a)/1000)+'KG':Math.round(a)+'G';
  if(l.packUnit==='ml')return a>=1000?(Math.round(a)/1000)+'L':Math.round(a)+'ML';
  return ''}
// Turn the AI answer into the plain receipt text the app already understands.
function toText(r){
  const lines=Array.isArray(r.lines)?r.lines:[];
  if(!lines.length)throw new Error('The AI could not find any items. Try a clearer photo.');
  const out=[];
  if(r.store)out.push('Store: '+String(r.store).slice(0,90));
  if(/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))out.push('Date: '+r.date);
  const unclear=[];
  for(const l of lines){
    const base=[l.brand,l.name].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
    const size=sizeText(l);
    const hasSize=size&&new RegExp(size.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(base);
    const name=(base+(size&&!hasSize?' '+size:'')).trim();
    const qty=Number.isInteger(l.count)&&l.count>0?l.count:1;
    out.push(name+' x'+qty+'  '+(num(l.price)?l.price.toFixed(2):'???'));
    if(l.confidence==='low')unclear.push(base||l.receiptText||'unknown line')}
  if(num(r.total))out.push('Total: '+r.total.toFixed(2));
  const notes=[];
  if(unclear.length)notes.push('AI was unsure about: '+unclear.join(', '));
  if(Array.isArray(r.questions))r.questions.slice(0,3).forEach(q=>notes.push(String(q)));
  if(notes.length)out.push('Check: '+notes.join('. ').replace(/\s+/g,' '));
  return out.join('\n')}
async function freshSession(){
  let s=session();
  if(!s)throw new Error('Sign in first: Settings, then Sync across devices.');
  if(s.expires_at-Date.now()/1000<60&&window.RaiKibaSync&&window.RaiKibaSync.sync){try{await window.RaiKibaSync.sync('ai')}catch(e){}s=session()}
  if(!s||s.expires_at-Date.now()/1000<20)throw new Error('Your sign in expired. Open Settings, tap Sync now, then try again.');
  return s}
async function readWithAI(file){
  if(st.busy)return;st.busy=true;st.msg='Reading your receipt with AI. This takes about 5 to 20 seconds.';draw();
  try{
    const s=await freshSession(),img=await shrink(file);
    const r=await fetch(URL_+'/functions/v1/ai-assist',{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+s.access_token},body:JSON.stringify({task:'receipt',text:'Read this receipt.',images:[img]}),signal:AbortSignal.timeout(120000)});
    const j=await r.json().catch(()=>({}));
    if(r.status===429)throw new Error('AI limit reached for now. Try again in a minute, or use ChatGPT below.');
    if(!r.ok||!j.parsed)throw new Error('The AI did not return a readable answer. Try again, or use ChatGPT below.');
    const text=toText(j.parsed);
    const ta=document.getElementById('receiptPasteText'),go=document.querySelector('[data-action="v1-scan-paste"]');
    if(!ta||!go)throw new Error('Open Add a grocery shop and try again.');
    ta.value=text;ta.dispatchEvent(new Event('input',{bubbles:true}));
    st.msg='Done. Check every line below before saving. Nothing is saved yet.';st.busy=false;draw();
    go.click()
  }catch(e){st.busy=false;st.msg=(e&&e.name==='TimeoutError')?'The AI took too long. Try again, or use ChatGPT below.':(e&&e.message)||'Something went wrong. Use ChatGPT below.';draw()}}
function html(){
  const dis=st.busy?' disabled':'';
  return '<div class="detail" id="luAiReceipt"><h2 style="margin:0 0 6px">Read with AI</h2><p class="capture-note">Choose a receipt photo. The AI reads it and fills the review for you. Nothing is saved until you confirm.</p><label class="subtle-button" for="luAiFile" style="display:inline-block"'+dis+'>'+(st.busy?'Reading...':'Read with AI')+'</label><input id="luAiFile" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only"'+dis+'>'+(st.msg?'<p class="capture-note" role="status">'+esc(st.msg)+'</p>':'')+'</div>'}
let lastSig='';
function draw(){
  const host=document.querySelector('.receipt-scanner');if(!host)return;
  const h=html(),have=document.getElementById('luAiReceipt');
  if(have&&have.parentNode===host&&lastSig===h)return;
  lastSig=h;
  const t=document.createElement('template');t.innerHTML=h;
  if(have)have.remove();
  const first=host.querySelector('.detail');
  if(first)host.insertBefore(t.content.firstChild,first);else host.appendChild(t.content.firstChild)}
document.addEventListener('change',e=>{
  const t=e.target;if(!t||t.id!=='luAiFile')return;
  const f=t.files&&t.files[0];if(f)readWithAI(f);t.value=''},true);
let q=false;function schedule(){if(q)return;q=true;(window.requestAnimationFrame||setTimeout)(()=>{q=false;try{draw()}catch(e){}})}
function start(){if(window.MutationObserver&&document.body)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule()}
window.LevelUpAiReceipt={toText};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
