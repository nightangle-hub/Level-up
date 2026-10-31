/* Receipt proposals only: separate printed totals, products and payment metadata. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.BloomReceiptParser=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=s=>String(s||'').trim().replace(/\s+/g,' ');
const sensitive=/\b(?:abn|gst|tax|taxable|cashier|operator|terminal|transaction|authori[sz]|eftpos|visa|mastercard|amex|debit|credit|card|account|payment|tender|cash|change|balance|loyalty|member|flybuys|rewards|receipt\s*(?:no|number|#)|invoice|reference|ref\s*[:#]|phone|tel|fax|www|https?|thank|welcome|served|customer|survey|approved|merch\s*id|term\s*id|promotional\s*price|fresh\s*food\s*people)\b|@\w+\.|\*{3,}|\b\d+\s+.{0,30}\b(?:street|st\b|road|rd\b|avenue|ave\b|highway|hwy\b|parade|drive|lane)\b/i;
const adjustment=/\b(?:discount|coupon|refund|return|void|reversal|rounding|multi[ -]?buy)\b|[-−]\s*\$?\s*\d+[.,]\d{2}/i;
const taxOrSaving=/\b(?:gst|taxable|tax|saving[s]?|saved|promotional\s*price)\b/i;
const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
function priceAtEnd(line){const m=line.match(/\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)[.]\d{2}|\d+[,]\d{2})\s*(?:[A-Z*])?\s*$/i);if(!m)return null;const n=Number(m[1].includes('.')?m[1].replace(/,/g,''):m[1].replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=100000?{price:Math.round(n*100)/100,index:m.index}:null}
const cleanName=s=>norm(s).replace(/^[\s^#*“”"'`~|.:;,\-]+/,'').replace(/[\s:;,]+$/,'').trim();
function parse(text,options={}){
 if(typeof text!=='string'||text.length>60000)throw Error('Receipt text must be under 60,000 characters.');
 const lines=text.split(/\r?\n/).map(norm).filter(Boolean),items=[],totals=[],dates=[],warnings=[];let store='',adjustments=false,omitted=0,started=false,ended=false,pending=null;
 const quality=new Map((options.lines||[]).map(l=>[norm(l.text),l]));
 const add=(name,price,source,nameSource=source)=>{name=cleanName(name);if(!name||items.length>=150)return;const q=quality.get(source),nq=quality.get(nameSource),words=q?.words||[],pricePattern=/^\$?\d+[.,]\d{2}[A-Z*]?$/,priceWords=words.filter(w=>pricePattern.test(w.text)),nameWords=(nq?.words||[]).filter(w=>!pricePattern.test(w.text));const minimum=a=>a.length?Math.round(Math.min(...a.map(w=>Number(w.confidence)||0))):null;const pack=name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i),unit=pack?pack[2].toLowerCase():null,mult=unit==='kg'||unit==='l'?1000:1;items.push({name,price,amount:null,unit:'unknown',precision:'unknown',descriptor:'',uncertain:true,nameConfidence:minimum(nameWords),priceConfidence:minimum(priceWords),packSize:pack?Number(pack[1].replace(',','.'))*mult:null,packUnit:pack?(unit==='kg'?'g':unit==='l'?'ml':unit):'unknown',packs:1,promotion:/^[^A-Za-z0-9]*\^/.test(source)?'Promotional price indicated on receipt':''})};
 for(let i=0;i<lines.length;i++){
  const line=lines[i],p=priceAtEnd(line);
  if(!/expir|valid\s*(?:to|until)|best\s*before|use\s*by/i.test(line)){
   const iso=line.match(/\b(20\d{2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\b/),au=!iso&&line.match(/\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(20\d{2}|\d{2})\b/);let d='';if(iso)d=`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;else if(au)d=`${au[3].length===2?'20'+au[3]:au[3]}-${au[2].padStart(2,'0')}-${au[1].padStart(2,'0')}`;if(d&&dateValid(d))dates.push({date:d,priority:/\bdate\b/i.test(line)?3:/\d{1,2}:\d{2}|approved/i.test(line)?2:1});
  }
  if(!store&&i<10){const m=line.match(/\b(woolworths|coles|aldi|iga|costco|harris farm|foodworks)\b/i);if(m)store=m[1].toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
  const totalLabel=/^(?:\d+\s+)?(?:sub\s*total|total|amount\s*(?:due|paid)|you\s*paid)\b/i.test(line)&&!taxOrSaving.test(line)&&/^(?:\d+\s+)?(?:sub\s*total|total|amount\s*(?:due|paid)|you\s*paid)\s*[:$]?\s*(?:AUD\s*)?(?:\$?\s*[\d.,]+)?\s*[A-Z*]?$/i.test(line);
  if(totalLabel){const val=p||(lines[i+1]&&/^\$?\s*\d+[.,]\d{2}$/.test(lines[i+1])?priceAtEnd(lines[i+1]):null);if(val)totals.push({price:val.price,priority:/sub\s*total/i.test(line)?1:2});if(started){if(pending){add(pending,null,pending);pending=null}}ended=true;omitted++;continue}
  if(adjustment.test(line)){adjustments=true;pending=null;omitted++;continue}
  if(taxOrSaving.test(line)||sensitive.test(line)||/\b\d{1,2}[/:.-]\d{1,2}[/:.-]\d{2,4}\b/.test(line)||/\b\d{1,2}:\d{2}\b/.test(line)||/\b(woolworths|coles|aldi|iga|costco|harris farm|foodworks)\b/i.test(line)){pending=null;omitted++;continue}
  if(ended){omitted++;continue}
  const name=cleanName(p?line.slice(0,p.index):line),quantityOnly=/^(?:\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|x|@)|@\s*\$|\d+\s*x\s*\$)/i.test(name);
  if(p&&(quantityOnly||!/[A-Za-z]{2}/.test(name))){if(pending){add(pending,p.price,line,pending);pending=null;started=true}else omitted++;continue}
  if(!name||!/[A-Za-z]{2}/.test(name)||quantityOnly||/^[-=*_\s\d.,:/]+$/.test(name)){omitted++;continue}
  if(p){if(started&&pending)add(pending,null,pending);pending=null;add(name,p.price,line);started=true;continue}
  if(name.length>65||name.split(' ').length>8){pending=null;omitted++;continue}
  if(started&&pending)add(pending,null,pending);pending=name;
 }
 if(pending&&!ended)add(pending,null,pending);
 const bestTotal=Math.max(0,...totals.map(t=>t.priority)),totalValues=[...new Set(totals.filter(t=>t.priority===bestTotal).map(t=>t.price))],total=totalValues.length===1?totalValues[0]:null;
 const bestDate=Math.max(0,...dates.map(d=>d.priority)),dateValues=[...new Set(dates.filter(d=>d.priority===bestDate).map(d=>d.date))],date=dateValues.length===1?dateValues[0]:'';
 const sum=items.reduce((s,r)=>s+(r.price===null?0:Math.round(r.price*100)),0)/100,totalMatches=total!==null&&items.length>0&&items.every(r=>r.price!==null)&&Math.abs(sum-total)<.011;
 warnings.push('Check the proposed names and prices. Printed abbreviations are kept as read.');if(!date)warnings.push(dateValues.length>1?'Different possible dates were read. Choose the purchase date.':'Receipt date was not read. Choose the purchase date.');if(adjustments)warnings.push('Discounts or returns were found. Check the actual amount paid per item; discounts have not been allocated.');if(totalValues.length>1)warnings.push('Conflicting printed totals were read. Check the amount paid.');if(total!==null&&!totalMatches)warnings.push('Item prices do not match the printed total. Check missing items, discounts and OCR errors.');if(!items.length)warnings.push('No clear product lines were found. Correct the text or enter the shop manually.');return {store,date,total,items,warnings,adjustments,omitted,sum,totalMatches};
}
return {parse,priceAtEnd};
});

