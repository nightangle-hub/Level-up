(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BloomInvoice=factory()})(typeof window==='object'?window:this,()=>{
 function lines(items){const rows=[];for(const it of items.filter(i=>i.str?.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){const y=it.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<2);if(!row)rows.push(row={y,items:[]});row.items.push(it)}return rows.map(r=>r.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str.trim()).join(' ').replace(/\s+/g,' ').trim()).join('\n')}
 function parse(text){
  const rows=String(text).split(/\r?\n/),items=[],warnings=['Check all PDF items before saving. Quantities are packs purchased; pantry amounts remain unknown.'];
  if(!/coles/i.test(text)||!/Ordered\s+Picked\s+Unit Price\s+Total charged/i.test(text))throw Error('This PDF layout is not supported yet. Use a clear receipt photo or enter items manually.');
  let active=false;for(const row of rows){if(/Product\s+Ordered\s+Picked\s+Unit Price\s+Total charged/i.test(row)){active=true;continue}if(/Invoice date:|Payment summary|Tax Invoice/i.test(row)){active=false;continue}if(!active)continue;
   const m=row.match(/^(.+?)\s+(\d+)\s+(\d+)\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})$/);if(!m)continue;
   const packs=Number(m[3]),unitPrice=Number(m[4].replace(/,/g,'')),price=Number(m[5].replace(/,/g,''));if(!packs)continue;if(packs>1000||items.length>=150)throw Error('Too many invoice items. Split this invoice before importing.');
   const name=m[1].replace(/^[%#]+/,'').trim();if(name.length>100)throw Error('An invoice name is too long. Enter this shop manually.');
   if(Math.abs(packs*unitPrice-price)>.011)warnings.push('Check the quantity and price for '+name+'.');
   items.push({name,price,packs,amount:null,unit:'unknown',precision:'unknown',descriptor:'',uncertain:true,nameConfidence:null,priceConfidence:null,packSize:null,packUnit:'unknown',promotion:''});
  }
  if(!items.length)throw Error('No readable product rows found. This may be a scanned PDF; try clear page photos instead.');
  const totals=[...text.matchAll(/Your trolley\s*\(\d+ items\)\s*\$([\d,]+\.\d{2})/gi)].map(m=>Number(m[1].replace(/,/g,''))),payments=[...text.matchAll(/Payment total\s*\(with GST\)\s*\$([\d,]+\.\d{2})/gi)].map(m=>Number(m[1].replace(/,/g,'')));
  const unique=xs=>new Set(xs).size===1?xs[0]:null,total=unique(totals),paymentTotal=unique(payments),sum=Math.round(items.reduce((s,r)=>s+r.price,0)*100)/100;
  const dates=[...text.matchAll(/Invoice date:\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi)].map(m=>`${m[3]}-${String(['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(m[2].toLowerCase())+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`),date=unique(dates)||'';
  if(!date)warnings.push('Invoice date is missing or conflicting. Choose the purchase date.');
  if(paymentTotal!==null&&total!==null&&paymentTotal!==total)warnings.push(`Products total $${total.toFixed(2)}; payment total $${paymentTotal.toFixed(2)}. Fees of $${(paymentTotal-total).toFixed(2)} are excluded from product purchases.`);
  const totalMatches=total!==null&&Math.abs(sum-total)<.011;if(!totalMatches)warnings.push('Product prices do not reconcile to a unique printed product total. Check for missing rows.');
  return {store:'Coles',date,total,paymentTotal,items,warnings,adjustments:false,omitted:0,sum,totalMatches};
 }
 return {lines,parse};
});
