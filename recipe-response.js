(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BloomRecipeResponse=factory()})(typeof window==='object'?window:this,()=>{
 function parse(input,core){if(typeof input!=='string'||input.length>100000)throw Error('Recipe response is too long. Paste one recipe at a time.');let text=input.trim().replace(/^```(?:json|text|markdown)?\s*\n/i,'').replace(/\n```\s*$/,'').trim();if(/^[{[]/.test(text))return core.recipe(text);
 const rows=text.split(/\r?\n/),ingredients=[],steps=[],notes=[];let recipeMoods, title='',servings='',section='',ingredientHeadings=0,methodHeadings=0;
 const clean=s=>s.replace(/^\s*#{1,6}\s*/,'').replace(/\*\*/g,'').trim();
 for(const raw of rows){const line=clean(raw).replace(/^(\d+)\\([.)])\s*/, '$1$2 ');if(!line||/^[-_*]{3,}$/.test(line))continue;if(/^moods?\s*:/i.test(line)){recipeMoods=line.replace(/^moods?\s*:\s*/i,'').split(',').map(x=>x.trim().toLowerCase().replace(/high protein/g,'high-protein')).filter(Boolean);continue}if(/^ingredients(?:\s*\([^)]*\))?\s*:?$/i.test(line)){section='ingredients';ingredientHeadings++;continue}if(/^(?:method|instructions|directions|steps)(?:\s*\([^)]*\))?\s*:?$/i.test(line)){section='steps';methodHeadings++;continue}if(/^(?:notes|tips|cooking notes)\s*:?$/i.test(line)){section='notes';continue}if(!section&&/^(?:serves?|servings?|yield)\s*:?\s*\S+/i.test(line)){const value=line.replace(/^(?:serves?|servings?|yield)\s*:?\s*/i,'');const timing=value.search(/\s+(?:prep|cook|total|active)\s+time\s*:/i);servings=timing<0?value:value.slice(0,timing).trim();if(timing>=0)notes.push(value.slice(timing).trim());continue}
  if(!section&&/^(?:total|prep|cook|active)\s+time\s*:/i.test(line)){notes.push(line);continue}if(!section){if(!title)title=line.replace(/^title\s*:\s*/i,'');continue}
  if(section==='ingredients'){if(/^for\s+(?:the\s+)?[^:]+:?$/i.test(line)&&!/^\s*[-*•]\s+/.test(raw))continue;ingredients.push(line.replace(/^[-*•]\s+/,''));}
  if(section==='steps'){const numbered=/^(?:\d+[.)]|[-*•])\s+/.test(line);const value=line.replace(/^(?:\d+[.)]|[-*•])\s+/,'');if(numbered||!steps.length)steps.push(value);else steps[steps.length-1]+=' '+value}
  if(section==='notes')notes.push(line.replace(/^[-*•]\s+/,''));
 }
 if(ingredientHeadings!==1||methodHeadings!==1||!title||!ingredients.length||!steps.length)throw Error('Paste one complete recipe with its title, an Ingredients heading and a Method or Instructions heading. You can also add it manually in Recipes.');
 return core.recipe(JSON.stringify({schemaVersion:1,...(recipeMoods!==undefined?{moods:recipeMoods}:{}),title,servings,ingredients,steps,notes:notes.join('\n')}));
 }
 return {parse};
});
