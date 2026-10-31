(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BloomRecipeMoods=factory()})(typeof window==='object'?window:this,()=>{
 const all=['quick','light','spicy','soupy','comforting','high-protein'];
 function get(r){if(Array.isArray(r.moods))return r.moods.filter(x=>all.includes(x));const text=[r.title,r.servings,r.notes].filter(Boolean).join(' '),found=new Set();for(const mood of all){if(new RegExp('\\b'+mood+'\\b','i').test(text)&&!new RegExp('(?:not|no|avoid|without)\\s+'+mood+'\\b','i').test(text))found.add(mood)}const time=text.match(/(?:total time|about|ready in|takes)\s*:?\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:minutes?|mins?)/i);if(time){const minutes=Math.max(Number(time[1]),Number(time[2]||time[1]));if(minutes<10)found.add('quick');else found.delete('quick')}if(/\b(?:soup|stew|broth)\b/i.test(r.title||''))found.add('soupy');return [...found]}
 return {all,get};
});
