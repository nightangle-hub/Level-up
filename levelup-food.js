/* Pure review and price-book helpers. No network or storage writes. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.LevelUpFood=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
function stockList(text){
 if(typeof text!=='string'||text.length>20000)throw Error('Paste a list under 20,000 characters.');
 const result=[],seen=new Set();
 for(let line of text.split(/\r?\n/)){
  line=line.trim().replace(/^[-*•]\s*/,'').replace(/^\d+[.)]\s*/,'').replace(/^\[[ xX]\]\s*/,'').replace(/\*\*/g,'');
  if(!line||/^```/.test(line)||/^(?:item|name)\s*\|/i.test(line)||/^[-| :]+$/.test(line))continue;
  const m=line.match(/^(.*?)\s*(?:\||:|[–—]| - )\s*(plenty|some|low|unknown|unsure)\s*(?:\|\s*(.*))?$/i);
  const name=(m?m[1]:line).trim(),level=m&&/^(plenty|some|low)$/i.test(m[2])?m[2].toLowerCase():'';
  if(!name||name.length>100)throw Error('Use one item per line, with names under 100 characters.');
  const key=norm(name);if(seen.has(key))continue;seen.add(key);
  const uncertain=/\?|uncertain|maybe|possibly|unsure|unknown/i.test(name+' '+(m?.[3]||''))||!level;
  result.push({name,level,selected:!uncertain,uncertain});
 }
 if(!result.length||result.length>100)throw Error('Paste 1–100 items, one per line.');
 return result;
}
function priceSummary(records,name,productId){
 const rows=records.filter(r=>!r.voided&&typeof r.price==='number'&&Number.isFinite(r.price)&&r.price>=0&&(productId?r.productId===productId:norm(r.item)===norm(name))).slice().reverse().sort((a,b)=>b.date.localeCompare(a.date));
 if(!rows.length)return {rows,last:null,best:null,above:false};
 const last=rows[0],base=r=>r.packSize>0&&['g','ml','pieces'].includes(r.packUnit)?r.packUnit+':unit':r.packSize===null||r.packSize===undefined?'unknown:line':r.packUnit+':'+r.packSize;
 const trusted=r=>!r.identityUncertain&&!r.unallocatedDiscount;
 const value=r=>base(r).endsWith(':unit')?r.price/(r.packSize*(r.packs||1)):r.price/(r.packs||1);
 const eligible=rows.filter(r=>trusted(r)&&base(r)===base(last)&&(!last.productId||r.productId===last.productId));
 const best=eligible.reduce((b,r)=>!b||value(r)<value(b)?r:b,null),comparable=trusted(last)&&base(last)!=='unknown:line';
 return {rows,last,best,comparable,above:!!best&&trusted(last)&&value(last)>value(best)+0.000001,unit:base(last).endsWith(':unit')?last.packUnit:null,lastValue:value(last),bestValue:best?value(best):null};
}
return {norm,stockList,priceSummary};
});
