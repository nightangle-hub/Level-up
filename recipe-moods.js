(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BloomRecipeMoods=factory()})(typeof window==='object'?window:this,()=>{
 const all=['quick','light','spicy','soupy','comforting','high-protein'];
 /* Moods are worked out when a recipe is read, so new recipes are sorted the moment they are saved and nothing extra is stored.
    A moods array on the recipe (set by hand) always wins. */
 const TITLE={soupy:/\b(soup|stew|broth|congee|porridge|laksa|ramen|pho|hotpot|chowder|tom yum|dal)\b/i,comforting:/\b(soup|stew|congee|porridge|curry|bake|baked|roast|risotto|mac|pie|dumplings?|hotpot|braise|braised|dal|lasagne|gratin)\b/i,light:/\b(salad|poke|sashimi|sushi|cold|rice paper|summer rolls?|cucumber|gazpacho|lettuce|steamed|ceviche|slaw|smoothie)\b/i};
 const SPICY=/\b(chilli|chili|chillies|sambal|gochujang|laksa|kimchi|sriracha|cayenne|jalapeno|tom yum|curry paste)\b/i;
 const PROTEIN=/\b(salmon|tuna|fish|prawns?|shrimp|tofu|tempeh|eggs?|edamame|lentils?|chickpeas?|beans?|cod|barramundi|sardines?|mussels?|squid|scallops?)\b/i;
 function lines(r){return Array.isArray(r.ingredients)?r.ingredients.map(String):[]}
 function get(r){
  if(Array.isArray(r.moods))return r.moods.filter(x=>all.includes(x));
  const text=[r.title,r.servings,r.notes].filter(Boolean).join(' '),found=new Set(),ing=lines(r),title=String(r.title||'');
  for(const mood of all){if(new RegExp('\\b'+mood+'\\b','i').test(text)&&!new RegExp('(?:not|no|avoid|without)\\s+'+mood+'\\b','i').test(text))found.add(mood)}
  for(const m of ['soupy','comforting','light'])if(TITLE[m].test(title))found.add(m);
  if(SPICY.test(title+' '+ing.join(' ')))found.add('spicy');
  if(PROTEIN.test(title)||ing.filter(l=>PROTEIN.test(l)).length>=2)found.add('high-protein');
  const time=text.match(/(?:total time|about|ready in|takes)\s*:?\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:minutes?|mins?)/i);
  if(time){const minutes=Math.max(Number(time[1]),Number(time[2]||time[1]));if(minutes<10)found.add('quick');else found.delete('quick')}
  else if(ing.length&&ing.length<=5)found.add('quick');
  return [...found]}
 return {all,get};
});
