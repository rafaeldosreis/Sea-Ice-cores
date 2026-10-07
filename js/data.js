(function(global){
'use strict';
const DEPTH_MAX=163;
const SEGMENTS=[
 {id:'A1',top:0,bottom:20,video:'Core A1 3D view with void analysis.mp4'},
 {id:'A2',top:20,bottom:40,video:'Core A2 3D view with void analysis.mp4'},
 {id:'B1',top:40,bottom:60,video:'Core B1 3D view with void analysis.mp4'},
 {id:'B2',top:60,bottom:80,video:'Core B2 3D view with void analysis v2.mp4'},
 {id:'C1',top:80,bottom:100,video:'Core C1 3D view with void analysis.mp4'},
 {id:'C2',top:100,bottom:120,video:'Core C2 3D view with void analysis v2.mp4'},
 {id:'D1',top:120,bottom:140,video:'Core D 3D view with void analysis.mp4'},
 {id:'E',top:140,bottom:163,video:'Core E 3D view with void analysis.mp4'}
];
const FILES={physical:['./Core16_Density.csv','./data/Core16_Density.csv'],chemistry:['./ICP_data.csv','./data/ICP_data.csv'],models:['./geochemistry_model_data.csv','./data/geochemistry_model_data.csv']};
const normalize=s=>String(s??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).trim().replace(',','.'));return Number.isFinite(n)?n:null};
function parseCSV(text){
 const rows=[];let row=[],cell='',quote=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quote&&n==='"'){cell+='"';i++}else quote=!quote}else if(c===','&&!quote){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);row=[];cell=''}else cell+=c}
 row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);if(!rows.length)return[];
 const headers=rows[0].map((h,i)=>h.trim()||`column_${i+1}`);
 return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()])));
}
async function fetchFirst(paths){let last;for(const p of paths){try{const r=await fetch(p,{cache:'no-store'});if(r.ok)return{path:p,text:await r.text()};last=new Error(`${p}: ${r.status}`)}catch(e){last=e}}throw last||new Error('File unavailable')}
const headers=rows=>rows.length?Object.keys(rows[0]):[];
function findCol(cols,patterns){return cols.find(c=>patterns.some(p=>normalize(c).includes(p)))||null}
function numericColumns(rows,exclude=[]){return headers(rows).filter(c=>!exclude.includes(c)&&rows.some(r=>num(r[c])!==null))}
function makeIntervals(count=32){return Array.from({length:count},(_,i)=>({top:i<31?i*5:155,bottom:i<31?Math.min((i+1)*5,155):163,mid:i<31?i*5+2.5:159,index:i})).filter(x=>x.top<DEPTH_MAX)}
function segmentAt(depth){return SEGMENTS.find(s=>depth>=s.top&&depth<(s.bottom===DEPTH_MAX?s.bottom+.0001:s.bottom))||SEGMENTS.at(-1)}
function chemistryRows(rows){
 const cols=headers(rows),topCol=findCol(cols,['depth_top','top_depth','from_cm','top_cm','depth_from']),bottomCol=findCol(cols,['depth_bottom','bottom_depth','to_cm','bottom_cm','depth_to']),depthCol=findCol(cols,['depth_cm','depth','profundidade']),idCol=findCol(cols,['sample_id','sample','id','amostra']);
 return rows.map((r,i)=>{let top=num(r[topCol]),bottom=num(r[bottomCol]),d=num(r[depthCol]);if(top===null||bottom===null){if(d!==null){top=Math.max(0,d-2.5);bottom=Math.min(DEPTH_MAX,d+2.5)}else{const x=makeIntervals(rows.length)[i]||{top:i*5,bottom:Math.min(i*5+5,DEPTH_MAX)};top=x.top;bottom=x.bottom}}if(i===rows.length-1&&Math.abs(top-155)<3)bottom=163;return{...r,_index:i,_top:top,_bottom:bottom,_mid:(top+bottom)/2,_id:idCol?r[idCol]:`S${String(i+1).padStart(2,'0')}`}})
}
function physicalRows(rows){
 const cols=headers(rows),depthCol=findCol(cols,['depth_cm','depth','profundidade','cm']),brineCol=findCol(cols,['brine']),porosityCol=findCol(cols,['porosity','porosidade','pore','void']),densityCol=findCol(cols,['density','densidade','rho','bulk']);
 const depths=depthCol?rows.map(r=>num(r[depthCol])).filter(v=>v!==null):[];const min=depths.length?Math.min(...depths):null;
 let convention='row-index';if(min!==null){if(min>=.25&&min<.75)convention='center';else if(min>=.75&&min<=1.25)convention='bottom';else convention='top'}
 const mapped=rows.map((r,i)=>{let d=depthCol?num(r[depthCol]):null;if(d===null)d=i;let top,bottom;if(convention==='center'){top=d-.5;bottom=d+.5}else if(convention==='bottom'){top=d-1;bottom=d}else{top=d;bottom=d+1}return{...r,_index:i,_top:Math.max(0,top),_bottom:Math.min(DEPTH_MAX,bottom),_mid:(top+bottom)/2,brine:num(r[brineCol]),porosity:num(r[porosityCol]),density:num(r[densityCol])}}).filter(r=>r._bottom>0&&r._top<DEPTH_MAX);
 return{rows:mapped,columns:{depth:depthCol,brine:brineCol,porosity:porosityCol,density:densityCol},convention}
}
function weighted(rows,top,bottom,key){let sum=0,w=0,values=[];for(const r of rows){const overlap=Math.max(0,Math.min(bottom,r._bottom)-Math.max(top,r._top)),v=r[key];if(overlap>0&&v!==null&&Number.isFinite(v)){sum+=v*overlap;w+=overlap;values.push(v)}}const mean=w?sum/w:null;let sd=null;if(values.length>1&&mean!==null)sd=Math.sqrt(values.reduce((a,v)=>a+(v-mean)**2,0)/(values.length-1));return{mean,sd,coverage:(bottom-top)?w/(bottom-top):0,n:values.length}}
function modelMap(rows,chem){
 const cols=headers(rows),topCol=findCol(cols,['depth_top','top_depth','from_cm','top_cm']),depthCol=findCol(cols,['depth_cm','depth','profundidade']),idCol=findCol(cols,['sample_id','sample','id','amostra']);const chemId=new Map(chem.map((r,i)=>[String(r._id),i]));
 const out=new Map();rows.forEach((r,i)=>{let idx=idCol&&chemId.has(String(r[idCol]))?chemId.get(String(r[idCol])):i;if(topCol){const t=num(r[topCol]);if(t!==null)idx=chem.findIndex(c=>t>=c._top&&t<c._bottom)}else if(depthCol){const d=num(r[depthCol]);if(d!==null)idx=chem.findIndex(c=>d>=c._top&&d<c._bottom)}if(idx>=0)out.set(idx,r)});return out
}
function createAligned(physical,chem,models){const modelByIndex=modelMap(models,chem);return chem.map((c,i)=>{const b=weighted(physical.rows,c._top,c._bottom,'brine'),p=weighted(physical.rows,c._top,c._bottom,'porosity'),d=weighted(physical.rows,c._top,c._bottom,'density'),m=modelByIndex.get(i)||{};return{index:i,sample_id:c._id,depth_top_cm:c._top,depth_bottom_cm:c._bottom,depth_mid_cm:c._mid,interval_cm:c._bottom-c._top,segment:segmentAt(c._mid).id,brine_mean:b.mean,brine_sd:b.sd,porosity_mean:p.mean,porosity_sd:p.sd,density_mean:d.mean,density_sd:d.sd,coverage_fraction:Math.min(b.coverage,p.coverage,d.coverage),_chem:c,_model:m}})}
async function load(){
 const results=await Promise.allSettled(Object.values(FILES).map(fetchFirst));const names=Object.keys(FILES),raw={},errors=[];results.forEach((r,i)=>{if(r.status==='fulfilled')raw[names[i]]={...r.value,rows:parseCSV(r.value.text)};else{raw[names[i]]={rows:[]};errors.push(`${names[i]}: ${r.reason?.message||'unavailable'}`)}});
 const physical=physicalRows(raw.physical.rows),chem=chemistryRows(raw.chemistry.rows.length?raw.chemistry.rows:makeIntervals().map(x=>({depth_top_cm:x.top,depth_bottom_cm:x.bottom}))),models=raw.models.rows,aligned=createAligned(physical,chem,models);
 const chemExclude=headers(raw.chemistry.rows).filter(c=>['depth','sample','id','top','bottom','from','to'].some(k=>normalize(c).includes(k)));const modelExclude=headers(models).filter(c=>['depth','sample','id','top','bottom','from','to'].some(k=>normalize(c).includes(k)));
 return{segments:SEGMENTS,physical,chem,models,aligned,chemVariables:numericColumns(raw.chemistry.rows,chemExclude),modelVariables:numericColumns(models,modelExclude),errors,files:Object.fromEntries(names.map(n=>[n,raw[n].path||null]))}
}
function toCSV(data){if(!data.length)return'';const chemKeys=[...new Set(data.flatMap(r=>Object.keys(r._chem||{})))].filter(k=>!k.startsWith('_'));const modelKeys=[...new Set(data.flatMap(r=>Object.keys(r._model||{})))].filter(k=>!k.startsWith('_'));const base=['sample_id','depth_top_cm','depth_bottom_cm','depth_mid_cm','interval_cm','segment','brine_mean','brine_sd','porosity_mean','porosity_sd','density_mean','density_sd','coverage_fraction'];const hs=[...base,...chemKeys.map(k=>`chem_${k}`),...modelKeys.map(k=>`model_${k}`)];const esc=v=>{if(v===null||v===undefined)return'';const s=String(v);return/[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};return[hs.join(','),...data.map(r=>hs.map(h=>h.startsWith('chem_')?esc(r._chem[h.slice(5)]):h.startsWith('model_')?esc(r._model[h.slice(6)]):esc(r[h])).join(','))].join('\n')}
global.CoreData={DEPTH_MAX,SEGMENTS,FILES,normalize,num,segmentAt,load,toCSV};
})(window);
