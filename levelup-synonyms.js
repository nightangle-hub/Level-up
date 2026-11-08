/* RaiKiba ingredient synonyms. Static table for common AU/UK/US variants, plus plurals and basic prep words.
   Exposes BloomSynonyms.norm(name) and BloomSynonyms.key(name). BloomCore.norm wraps this when loaded. */
(function(root){'use strict';
const PAIRS=[['scallion','spring onion'],['scallions','spring onions'],['cilantro','coriander'],['aubergine','eggplant'],['bean curd','tofu'],['beancurd','tofu'],['capsicum','bell pepper'],['wombok','napa cabbage'],['napa','napa cabbage'],['chinese cabbage','napa cabbage'],['courgette','zucchini'],['rocket','arugula'],['prawns','shrimp'],['garbanzo','chickpea'],['garbanzos','chickpeas'],['ladies finger','okra'],['sultanas','raisins'],['icing sugar','powdered sugar'],['caster sugar','superfine sugar'],['plain flour','all purpose flour'],['self raising flour','self rising flour'],['passata','tomato passata'],['chilli','chili'],['chillies','chilies']];
const MAP=new Map();for(const [a,b] of PAIRS){MAP.set(a,b);MAP.set(b,b)}
const PREP=/(^|\s)(diced|chopped|sliced|minced|grated|crushed|ground|fresh|dried|cooked|raw|frozen|canned|tinned|whole|halved|peeled|seeded|deseeded|roasted|steamed|baked)(\s|$)/g;
function base(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g,' ').replace(PREP,' ').replace(/\b(s|es|ies)\b/g,'').replace(/ies$/,'y').replace(/(es|s)$/,'').replace(/\s+/g,' ').trim()}
function norm(s){const b=base(s);return MAP.get(b)||b}
function key(s){return norm(s)}
const api={norm,key,base,PAIRS:PAIRS.slice()};root.BloomSynonyms=api;
if(root.BloomCore&&typeof root.BloomCore.norm==='function'&&!root.BloomCore.__synonymPatched){const prev=root.BloomCore.norm;root.BloomCore.norm=function(s){try{return norm(s)}catch(e){return prev(s)}};root.BloomCore.__synonymPatched=true}
if(typeof module==='object')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
