/* Receipt proposals only: separate printed totals, products and payment metadata. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.BloomReceiptParser=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=s=>String(s||'').trim().replace(/\s+/g,' ');
const sensitive=/\b(?:abn|gst|tax|taxable|cashier|operator|terminal|transaction|authori[sz]|eftpos|visa|mastercard|amex|debit|credit|card|account|payment|tender|cash|change|balance|loyalty|member|flybuys|rewards|receipt\s*(?:no|number|#)|invoice|reference|ref\s*[:#]|phone|tel|fax|www|https?|thank|welcome|served|customer|survey|approved|merch\s*id|term\s*id|promotional\s*price|fresh\s*food\s*people)\b|@\w+\.|\*{3,}|\b\d+\s+.{0,30}\b(?:street|st\b|road|rd\b|avenue|ave\b|highway|hwy\b|parade|drive|lane)\b/i;
const adjustment=/\b(?:discount|coupon|refund|return|void|reversal|rounding|multi[ -]?buy)\b|[-−]\s*\$?\s*\d+[.,]\d{2}/i;
const taxOrSaving=/\b(?:gst|taxable|tax|saving[s]?|saved|promotional\s*price)\b/i;
const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
function priceAtEnd(line){const m=line.match(/\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)[.]\d{2}|\d+[,]\d{2})\s*(?:[A-Z*])?\s*$/i);if(!m)return null;const n=Number(m[1].includes('.')?m[1].replace(/,/g,''):m[1].replace(',','.'));return Number.isFinite(n)&&n>=0&&n<=100000?{price:Math.round(n*100)/100,index:m.index}:null}
const KEEP=new Set(['No','Of','To','In','On','Or','An','And','At','As','By','If','It','My','Go','Be','Do','So','We','Up','Mr']);
const noiseToken=t=>/^[^A-Za-z0-9]*\d?[^A-Za-z0-9]*$/.test(t)&&t.length<=3||/^[A-Za-z]$/.test(t)||/^[A-Za-z]{1,2}[^A-Za-z0-9]+$/.test(t)||/^[A-Za-z]{2}$/.test(t)&&t!==t.toUpperCase()&&!KEEP.has(t);
const cleanName=s=>{const w=norm(s).replace(/^[\s^#*“”"'`~|.:;,\-]+/,'').split(' ');while(w.length>2&&noiseToken(w[0])&&!(/^\d{1,3}$/.test(w[0])&&/^[x×]$/i.test(w[1]||'')))w.shift();return w.join(' ').replace(/[\s:;,>|]+$/,'').trim()};
function parse(text,options={}){
 if(typeof text!=='string'||text.length>60000)throw Error('Receipt text must be under 60,000 characters.');
 const typed=!options.lines,cn=s=>typed?norm(s).replace(/^[\s^#*“”"'`~|.:;,\-]+/,'').replace(/[\s:;,>|]+$/,'').trim():cleanName(s);
 const flat=text.split(/\r?\n/).map(norm).filter(Boolean);if(flat.length<=4&&(text.match(/\$?\d+[.,]\d{2}\b/g)||[]).length>=3)text=text.replace(/\s+(?=(?:store|date|time|total|subtotal|check)\s*:)/gi,'\n').replace(/(\d+[.,]\d{2})(?=\s+[A-Za-z])/g,'$1\n');
 const lines=text.split(/\r?\n/).map(norm).filter(Boolean),items=[],totals=[],dates=[],warnings=[];let store='',adjustments=false,omitted=0,started=false,ended=false,pending=null,pendingSrc='',last=null,ambiguous=false;
 const quality=new Map((options.lines||[]).map(l=>[norm(l.text),l]));
 const add=(name,price,source,nameSource=source)=>{name=norm(name).replace(/\s*\?{2,}\s*$/,'');let qty=1;const qa=name.match(/^(\d{1,3})\s*[x×]\s+(?=\D)/i),qb=name.match(/\s+[x×]\s*(\d{1,3})$/i);if(qa){qty=+qa[1];name=name.slice(qa[0].length)}else if(qb){qty=+qb[1];name=name.slice(0,qb.index)}if(qty<1||qty>1000)qty=1;name=cn(name);if(!name||items.length>=150)return;const q=quality.get(source),nq=quality.get(nameSource),words=q?.words||[],pricePattern=/^\$?\d+[.,]\d{2}[A-Z*]?$/,priceWords=words.filter(w=>pricePattern.test(w.text)),nameWords=(nq?.words||[]).filter(w=>!pricePattern.test(w.text));const minimum=a=>a.length?Math.round(Math.min(...a.map(w=>Number(w.confidence)||0))):null;const pack=name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i),unit=pack?pack[2].toLowerCase():null,mult=unit==='kg'||unit==='l'?1000:1;const it={name,price,amount:null,unit:'unknown',precision:'unknown',descriptor:'',uncertain:true,nameConfidence:minimum(nameWords),priceConfidence:minimum(priceWords),packSize:pack?Number(pack[1].replace(',','.'))*mult:null,packUnit:pack?(unit==='kg'?'g':unit==='l'?'ml':unit):'unknown',packs:qty,promotion:/^[^A-Za-z0-9]*\^/.test(source)?'Promotional price indicated on receipt':''};items.push(it);return it};
 const box=l=>quality.get(l)?.bbox||null,overlaps=(a,b)=>!!(a&&b)&&(b.y0-a.y1)<=-0.15*Math.max(1,b.y1-b.y0);
 for(let i=0;i<lines.length;i++){
  const line=lines[i],p=priceAtEnd(line);
  if(!/expir|valid\s*(?:to|until)|best\s*before|use\s*by/i.test(line)){
   const iso=line.match(/\b(20\d{2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\b/),au=!iso&&line.match(/\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(20\d{2}|\d{2})\b/);let d='';if(iso)d=`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;else if(au){const y=au[3].length===2?'20'+au[3]:au[3],a=+au[1],b=+au[2],dmy=`${y}-${au[2].padStart(2,'0')}-${au[1].padStart(2,'0')}`,mdy=`${y}-${au[1].padStart(2,'0')}-${au[2].padStart(2,'0')}`;d=dmy;if(a<=12&&b<=12&&a!==b&&dateValid(mdy)){const now=Date.parse(options.today||new Date().toISOString().slice(0,10)),gap=x=>{const t=Date.parse(x);return t>now+864e5?1e12:now-t};if(gap(mdy)<gap(dmy)){d=mdy;ambiguous=true}}}if(d&&dateValid(d))dates.push({date:d,priority:/\bdate\b/i.test(line)?3:/\d{1,2}:\d{2}|approved/i.test(line)?2:1});
  }
  const sl=line.match(/^(?:store|shop)\s*:\s*(.{2,60})$/i);if(sl){store=sl[1].replace(/\?+/g,'').trim();omitted++;continue}
  if(/^(?:date|time|store|shop|check|note|notes)\s*:/i.test(line)){omitted++;continue}
  if(!store&&i<10){const m=line.match(/\b(woolworths|coles|aldi|iga|costco|harris farm|foodworks)\b/i);if(m)store=m[1].toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
  if(!store&&i<6&&!p&&/\b(?:supermarket|market|mart|grocer(?:y|s)?|foods?|bakery|butcher)\b/i.test(line)&&!/\d{3,}/.test(line.replace(/^\d+\s/,''))&&line.length<=40)store=line.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  const totalLabel=/^(?:\d+\s+)?(?:[a-z]{0,4}\s*t\s*o\s*t\s*a\s*l|amount\s*(?:due|paid)|you\s*paid)\b/i.test(line)&&!taxOrSaving.test(line)&&/^(?:\d+\s+)?(?:[a-z]{0,4}\s*t\s*o\s*t\s*a\s*l|amount\s*(?:due|paid)|you\s*paid)\s*[:$]?\s*(?:AUD\s*)?(?:\$?\s*[\d.,]+)?\s*[A-Z*]?$/i.test(line);
  if(totalLabel){const val=p||(lines[i+1]&&/^\$?\s*\d+[.,]\d{2}$/.test(lines[i+1])?priceAtEnd(lines[i+1]):null);if(val)totals.push({price:val.price,priority:/^(?:\d+\s+)?(?:t\s*o\s*t\s*a\s*l|amount|you)/i.test(line)?2:1});if(started){if(pending){if(!/\d\s*$/.test(pending))add(pending,null,pending);pending=null}}ended=true;omitted++;continue}
  if(adjustment.test(line)){adjustments=true;pending=null;omitted++;continue}
  if(taxOrSaving.test(line)||sensitive.test(line)||/\b\d{1,2}[/:.-]\d{1,2}[/:.-]\d{2,4}\b/.test(line)||/\b\d{1,2}:\d{2}\b/.test(line)||(!p&&/\b(woolworths|coles|aldi|iga|costco|harris farm|foodworks)\b/i.test(line))){pending=null;omitted++;continue}
  if(ended){omitted++;continue}
  const unk=line.match(/^(.*\S)\s+\?{2,}$/);if(unk&&/[A-Za-z]{2}/.test(unk[1])){if(pending&&started)add(pending,null,pending);const it=add(unk[1],null,line);pending=null;last=it?{item:it,box:null}:last;started=true;continue}
  const qm=!p&&line.match(/^\W*(\d)?\W*@\s*\$?\s*(\d+[.,]\d{2})\s*(?:each|ea)\b/i);
  if(qm){if(last&&last.item&&qm[1]){const q=Number(qm[1]),unit=Number(qm[2].replace(',','.'));if(q>=1&&q<=1000)last.item.packs=q;if(last.item.price===null)last.item.price=Math.round(q*unit*100)/100}omitted++;continue}
  if(/^[^A-Za-z]*\$\s*\d+[.,]\d{2}\s*(?:e[a-z]{2,3}|ea)\W*$/i.test(line)){omitted++;continue}
  let name=cn(p?line.slice(0,p.index):line);if(p&&name.length<=3&&!/[A-Za-z]{3}/.test(name))name='';
  const quantityOnly=/^(?:\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|@)\b|@\s*\$|\d+\s*x\s*\$)/i.test(name);
  if(p&&(quantityOnly||!/[A-Za-z]{2}/.test(name))){if(pending){const it=add(pending,p.price,line,pendingSrc);last={item:it,box:box(line)};pending=null;started=true}else omitted++;continue}
  if(!name||!/[A-Za-z]{2}/.test(name)||quantityOnly||/^[-=*_\s\d.,:/]+$/.test(name)){omitted++;continue}
  if(p){const join=!!pending&&overlaps(box(pendingSrc),box(line));if(pending&&!join&&started)add(pending,null,pending);const it=add(join?pending+' '+name:name,p.price,line);pending=null;last={item:it,box:box(line)};started=true;continue}
  if(name.length>65||name.split(' ').length>8){pending=null;omitted++;continue}
  if(last&&last.item&&overlaps(last.box,box(line))){last.item.name=cn(last.item.name+' '+name);continue}
  if(started&&pending)add(pending,null,pending);pending=name;pendingSrc=line;
 }
 if(pending&&!ended)add(pending,null,pending);
 const bestTotal=Math.max(0,...totals.map(t=>t.priority)),totalValues=[...new Set(totals.filter(t=>t.priority===bestTotal).map(t=>t.price))],total=totalValues.length===1?totalValues[0]:null;
 const bestDate=Math.max(0,...dates.map(d=>d.priority)),dateValues=[...new Set(dates.filter(d=>d.priority===bestDate).map(d=>d.date))],date=dateValues.length===1?dateValues[0]:'';
 let fixed9=0;for(const r of items)if(r.price!==null&&r.price>=90&&r.price<100){r.price=Math.round((r.price-90)*100)/100;fixed9++}
 const sum=items.reduce((s,r)=>s+(r.price===null?0:Math.round(r.price*100)),0)/100,totalMatches=total!==null&&items.length>0&&items.every(r=>r.price!==null)&&Math.abs(sum-total)<.011;
 warnings.push('Check the proposed names and prices. Printed abbreviations are kept as read.');if(!date)warnings.push(dateValues.length>1?'Different possible dates were read. Choose the purchase date.':'Receipt date was not read. Choose the purchase date.');if(fixed9)warnings.push('A $ sign was read as a 9 on '+fixed9+' price'+(fixed9>1?'s':'')+' and was removed. Check them.');if(ambiguous)warnings.push('The receipt date could be day/month or month/day. Check the purchase date.');if(adjustments)warnings.push('Discounts or returns were found. Check the actual amount paid per item; discounts have not been allocated.');if(totalValues.length>1)warnings.push('Conflicting printed totals were read. Check the amount paid.');if(total!==null&&!totalMatches)warnings.push('Item prices do not match the printed total. Check missing items, discounts and OCR errors.');if(!items.length)warnings.push('No clear product lines were found. Correct the text or enter the shop manually.');return {store,date,total,items,warnings,adjustments,omitted,sum,totalMatches};
}
return {parse,priceAtEnd};
});

