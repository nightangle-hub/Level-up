/* RaiKiba picture prompt. Adds "Copy picture prompt" next to Add picture on the recipe form.
   It reads the recipe name and ingredients as they are on screen (so it works before saving, including after Fill with AI),
   adds one fixed style line that matches the built-in recipe pictures, and copies it for ChatGPT. Nothing is sent or saved here. */
(function(){
'use strict';
const STYLE='Style: a soft watercolour and ink food illustration, square, three quarter overhead view. The dish sits in a handmade sage green ceramic bowl on a warm cream textured paper background with a soft shadow and gentle natural light. Soft natural colours. No text, no hands, no people, no cutlery, no steam.';
const SKIP=/^(salt|pepper|water|oil|olive oil|sugar|optional)\b/i;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let shown='';
function names(text){
  const P=window.BloomCore&&window.BloomCore.parse,out=[];
  String(text||'').split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>{let n=l;try{if(P)n=P(l).name||l}catch(e){}n=n.replace(/^(a |an )?(handful|pinch|bunch|splash|dash|sprig)( of)?\s+/i,'').replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();if(n&&!SKIP.test(n)&&!out.includes(n.toLowerCase()))out.push(n.toLowerCase())});
  return out.slice(0,8)}
function build(){
  const t=(document.getElementById('recTitle')||{}).value||'',ing=names((document.getElementById('recIngredients')||{}).value);
  if(!t.trim())return null;
  return 'Create one square food illustration for a recipe called "'+t.trim().slice(0,100)+'".'+(ing.length?' It contains: '+ing.join(', ')+'. Show only these.':'')+' '+STYLE+' If I attach a reference picture, match its style, colours and framing exactly.'}
function status(html){const el=document.getElementById('luPicPromptStatus');if(el)el.innerHTML=html}
async function copy(){
  const p=build();
  if(!p){status('Add the recipe name first, then copy the prompt.');return}
  shown=p;
  try{await navigator.clipboard.writeText(p);status('Copied. Paste it into ChatGPT and attach one of your recipe pictures so the style matches. Then choose the finished picture with Add picture.')}
  catch(e){status('Copy this prompt into ChatGPT:<textarea readonly rows="5" style="width:100%;margin-top:6px" aria-label="Picture prompt">'+esc(p)+'</textarea>')}}
function draw(){
  const sec=document.querySelector('.recipe-upload');
  if(!sec){shown='';return}
  if(document.getElementById('luPicPrompt'))return;
  const d=document.createElement('div');d.id='luPicPrompt';
  d.innerHTML='<button type="button" class="subtle-button" id="luPicPromptBtn">Copy picture prompt</button><p id="luPicPromptStatus" class="capture-note" role="status">Makes a prompt in the same style as your built-in recipe pictures.</p>';
  const note=sec.querySelector('.capture-note');
  if(note)note.insertAdjacentElement('afterend',d);else sec.appendChild(d)}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#luPicPromptBtn'):null;if(b){e.preventDefault();copy()}},true);
let q=false;function schedule(){if(q)return;q=true;(window.requestAnimationFrame||setTimeout)(()=>{q=false;try{draw()}catch(e){}})}
function start(){if(window.MutationObserver&&document.body)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule()}
window.LevelUpPicturePrompt={build,names};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
