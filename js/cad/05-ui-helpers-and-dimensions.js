// EvenUCan 3D drawing app - 05-ui-helpers-and-dimensions.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- UI helpers
const markerEl=$cad('marker'),vcbEl=$cad('vcb');
let markerInfo=null;
const MARK={through:['#e01b1b','Cuts Through ✓ click to cut the hole'],complete:['#9b30d9','Completes Shape'],guide:['#e07b00','Guide Point'],endpoint:['#17a317','Endpoint'],midpoint:['#13b5c4','Midpoint'],edge:['#d22','On Edge'],face:['#2a5bd7','On Face']};
const setMarker=function setMarker(inf){markerInfo=inf&&(MARK[inf.type]||inf.type==='axis')?inf:null;placeMarker();};
const placeMarker=function placeMarker(){
  if(!markerInfo){markerEl.style.display='none';return;}
  const s=toScreen(markerInfo.p);if(!s){markerEl.style.display='none';return;}
  let col,lbl;
  if(markerInfo.type==='axis'){col='#'+AXCOL[markerInfo.axis].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
    lbl=(markerInfo.locked?'Locked to ':'On ')+{x:'Red',y:'Green',z:'Blue'}[markerInfo.axis]+' Axis';}
  else[col,lbl]=MARK[markerInfo.type];
  if(markerInfo.label)lbl=markerInfo.label;
  markerEl.style.display='block';markerEl.style.transform=`translate(${s[0]}px,${s[1]}px)`;
  markerEl.firstChild.style.background=col;markerEl.lastChild.textContent=lbl;
};
// ---- Sizes on the shape: a rectangle shows its two sides, a circle or polygon its diameter, a box its width, depth
// and height. They show on the shape just drawn (or the one selected); click one and type a new size to change it.
const dimsEl=document.createElement('div');dimsEl.id='dims';$cad('view').appendChild(dimsEl);
let lastShape=null,dimEdit=null,dimCache={ver:-1,sel:null,items:[]};
// The face that was just drawn (found again after it was fitted in with what's around it).
const rememberShape=function rememberShape(c,n){
  const f=model.faces.find(f=>!f.hidden&&dot(faceNormal(f),n)>0.9999&&Math.abs(dot(sub(c,f.pts[0]),n))<1e-6&&insideFace(f,c,false));
  lastShape=f?f.id:null;
};
const shapeDims=function shapeDims(){
  const selF=model.faces.filter(f=>selection.has(f.id)&&!f.hidden),sk=selF.map(f=>f.id).join(',');
  if(dimCache.ver===geomVer&&dimCache.sel===sk)return dimCache.items;
  const items=[];dimCache={ver:geomVer,sel:sk,items};
  const fid=selF.length?selF[0].id:(lastShape&&model.faces.some(f=>f.id===lastShape)?lastShape:null);
  if(fid===null)return items;
  const comp=componentOf(fid);if(selF.some(f=>!comp.has(f.id)))return items;// more than one object picked
  const F=model.faces.filter(f=>comp.has(f.id));if(F.length>400)return items;
  const keysOf=pts=>new Set(pts.map(key)),by=(vs,v)=>p=>add(p,v);
  // A box standing square to the axes: every corner sits on its bounding box.
  const b=bounds(comp),on=(v,i)=>Math.abs(v-b.mn[i])<1e-7||Math.abs(v-b.mx[i])<1e-7;
  if(F.length>=6&&b.size.every(s=>s>1e-6)&&F.every(f=>!f.holes.length&&f.pts.every(p=>on(p[0],0)&&on(p[1],1)&&on(p[2],2)))){
    for(let i=0;i<3;i++){
      const j=(i+1)%3,k=(i+2)%3,edges=[];
      for(const a of [b.mn[j],b.mx[j]])for(const c of [b.mn[k],b.mx[k]]){const p=[0,0,0],q=[0,0,0];p[i]=b.mn[i];q[i]=b.mx[i];p[j]=q[j]=a;p[k]=q[k]=c;edges.push([p,q]);}
      items.push({axis:'xyz'[i],len:b.size[i],edges,centre:mul(add(b.mn,b.mx),0.5),
        apply(L){const d=L-b.size[i],v=[0,0,0];v[i]=d;
          const top=new Set();for(const f of F)for(const p of f.pts)if(Math.abs(p[i]-b.mx[i])<1e-7)top.add(key(p));
          xform(top,by(top,v));}});
    }
    return items;
  }
  // A flat drawing: the picked (or just drawn) rectangle, circle or polygon in it.
  const f=model.faces.find(x=>x.id===fid),n=faceNormal(f);
  if(F.some(g=>dot(faceNormal(g),n)<0.9999||Math.abs(dot(sub(g.pts[0],f.pts[0]),n))>1e-6))return items;
  const P=f.pts,cen=mul(P.reduce((s,p)=>add(s,p),[0,0,0]),1/P.length);
  if(P.length===4&&[0,1,2,3].every(i=>Math.abs(dot(norm(sub(P[(i+1)%4],P[i])),norm(sub(P[(i+2)%4],P[(i+1)%4]))))<1e-6)){
    for(const s of [0,1]){
      const a=P[s],c=P[s+1],u=norm(sub(c,a)),cur=dist(a,c),moving=s===0?[P[1],P[2]]:[P[2],P[3]];
      items.push({axis:'',len:cur,edges:[[a,c]],centre:cen,apply(L){const vs=keysOf(moving);xform(vs,by(vs,mul(u,L-cur)));}});
    }
    return items;
  }
  const r=P.map(p=>dist(p,cen)),rm=r.reduce((s,x)=>s+x,0)/r.length;
  if(P.length>=3&&r.every(x=>Math.abs(x-rm)<rm*2e-3)){
    items.push({axis:'',dia:true,len:rm*2,edges:P.map(p=>[p,p]),centre:cen,apply(L){const s=L/(rm*2),vs=new Set(P.map(key));xform(vs,p=>add(cen,mul(sub(p,cen),s)));}});
  }
  return items;
};
const placeDims=function placeDims(){
  const busy=(tool.busy&&tool.busy())||!!nav;
  const items=busy?[]:shapeDims();
  if(dimEdit&&!items.includes(dimEdit.item)){dimEdit.input.remove();dimEdit=null;}
  const els=[...dimsEl.querySelectorAll('.dim')];
  items.forEach((it,i)=>{
    // the edge that shows best: lowest on screen for widths, leftmost for heights
    let best=null;
    // (a diameter goes by the rightmost point of the circle)
    for(const [p,q] of it.edges){const s=toScreen(mul(add(p,q),0.5));if(!s)continue;const score=it.dia?s[0]:it.axis==='z'?-s[0]:s[1];if(!best||score>best.score)best={s,score};}
    let el=els[i];
    if(!el){el=document.createElement('div');el.className='dim';el.title='Click to type a new size';dimsEl.appendChild(el);
      el.onmousedown=e=>{e.preventDefault();e.stopPropagation();};el.onclick=e=>{e.stopPropagation();startDimEdit(+el.dataset.i);};}
    if(!best){el.style.display='none';return;}
    const c=toScreen(it.centre)||best.s,dx=best.s[0]-c[0],dy=best.s[1]-c[1],dl=Math.hypot(dx,dy)||1,off=it.dia?14:16;
    const x=best.s[0]+dx/dl*off,y=best.s[1]+dy/dl*off;
    el.dataset.i=i;el.className='dim'+(it.axis?' '+it.axis:'');el.textContent=(it.dia?'Ø ':'')+fmt(it.len);
    el.style.display=dimEdit&&dimEdit.i===i?'none':'block';
    // A drawing tool needs every press to reach the drawing: a label under the pointer must not swallow it.
    el.style.pointerEvents=toolNameCad==='select'?'auto':'none';
    el.style.transform=`translate(${Math.round(x-el.offsetWidth/2)}px,${Math.round(y-el.offsetHeight/2)}px)`;it.at=[x,y];
  });
  for(let i=items.length;i<els.length;i++)els[i].remove();
  if(dimEdit){const [x,y]=dimEdit.item.at||[0,0];dimEdit.input.style.transform=`translate(${Math.round(x-42)}px,${Math.round(y-11)}px)`;}
};
const startDimEdit=function startDimEdit(i){
  const item=dimCache.items[i];if(!item)return;
  if(dimEdit)dimEdit.input.remove();
  const inp=document.createElement('input');inp.autocomplete='off';inp.spellcheck=false;
  inp.value=String(+(item.len/UNITS[units]).toFixed(units==='mm'?2:4));inp.title='Type the new size and press Enter (Esc to cancel)';
  dimsEl.appendChild(inp);dimEdit={i,item,input:inp};placeDims();inp.focus();inp.select();
  const end=()=>{if(dimEdit&&dimEdit.input===inp){dimEdit=null;inp.remove();requestDraw();}};
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Escape'){end();return;}
    if(e.key!=='Enter')return;
    const L=parseLen(inp.value);
    if(!(L>0))return flash('Type a size, e.g. 30 or 30mm');
    end();if(Math.abs(L-item.len)<1e-9)return;
    pushUndo(null,'Size changed');item.apply(L);commitChange();flash('Now '+(item.dia?'Ø ':'')+fmt(L));
  });
  inp.addEventListener('blur',()=>setTimeout(end,0));
};
const setHover=function setHover(face){const i=face?model.faces.indexOf(face):-10;if(i!==hoverIdx){hoverIdx=i;requestDraw();}};
const vcbShow=function vcbShow(t){if(document.activeElement!==vcbEl)vcbEl.value=t;};
const setHintCad=function setHintCad(t){$cad('hint').textContent=t;};
let toastT=0;
const flash=function flash(msg,ms){const t=$cad('toast');t.textContent=msg;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',ms||2600);};
// Bounding box of faces/lines (optionally only the given ids): {mn,mx,size} in metres, or null.
const bounds=function bounds(ids){
  const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];let any=false;
  const take=p=>{any=true;for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}};
  for(const f of model.faces)if(!ids||ids.has(f.id))f.pts.forEach(take);
  for(const e of model.edges)if(!ids||ids.has(e.id)){take(e.a);take(e.b);}
  return any?{mn,mx,size:sub(mx,mn)}:null;
};
const sizeText=b=>b.size.map(fmt).join(' × ');
// Catch the classic mistake of drawing in the wrong units before it reaches the slicer.
const bedText=()=>bed.x+' × '+bed.y+' × '+bed.z+' mm';
// Largest footprint first, so a part that fits when turned on the bed isn't flagged.
const fitsBed=function fitsBed(b){
  const [w,d,h]=b.size.map(v=>v*1000),bw=Math.max(bed.x,bed.y),bd=Math.min(bed.x,bed.y);
  return h<=bed.z+1e-6&&Math.max(w,d)<=bw+1e-6&&Math.min(w,d)<=bd+1e-6;
};
// Separate groups (e.g. an enclosure's base and lid) can be printed one at a time, so each is checked on its own.
const fitInfo=function fitInfo(){
  const all=bounds();if(!all||fitsBed(all))return {fits:true,each:false};
  const gs=new Map();for(const f of model.faces){const k=f.g||0;if(!gs.has(k))gs.set(k,new Set());gs.get(k).add(f.id);}
  const each=gs.size>1&&[...gs.values()].every(ids=>fitsBed(bounds(ids)));
  return {fits:each,each};
};
const sizeOK=function sizeOK(){
  const b=bounds();if(!b)return true;
  const big=Math.max(...b.size),mm=b.size.map(v=>+(v*1000).toFixed(2)).join(' × ')+' mm';
  if(big<0.0005)return confirm('Check the size: this model is only '+mm+', smaller than half a millimetre. It may have been drawn with the wrong Units setting.\n\nTip: use the Resize button to set the exact size.\n\nSave it anyway?');
  if(fitsBed(b)||fitInfo().each)return true;
  return confirm('This model is '+mm+'. That does not fit your printer ('+bedText()+').'+(big>2*Math.max(bed.x,bed.y,bed.z)/1000?'\n\nIt may have been drawn with the wrong Units setting (currently '+$cad('units').options[$cad('units').selectedIndex].text+').':'')+'\n\nTip: use Resize to set the exact size, or Printer to change the bed size.\n\nSave it anyway?');
};
// Small in-app text box (the browser's prompt() isn't always available).
const askText=function askText(message,initial){
  return new Promise(res=>{
    const back=document.createElement('div');back.id='askBack';
    back.innerHTML='<div id="askBox"><div class="msg"></div><input autocomplete="off" spellcheck="false"><div class="btns"><button data-ok>OK</button><button data-cancel>Cancel</button></div></div>';
    back.querySelector('.msg').textContent=message;
    const inp=back.querySelector('input');inp.value=initial||'';
    const done=v=>{back.remove();res(v);};
    back.querySelector('[data-ok]').onclick=()=>done(inp.value);
    back.querySelector('[data-cancel]').onclick=()=>done(null);
    inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')done(inp.value);else if(e.key==='Escape')done(null);});
    document.body.appendChild(back);inp.focus();inp.select();
  });
};
const resizeModel=async function resizeModel(){
  const ids=selection.size?new Set(selection):null,b=bounds(ids);
  if(!b)return flash('Nothing to resize');
  const ans=await askText((ids?'Selection':'Whole model')+' size now: '+sizeText(b)+'\n\nType the new width (left to right), e.g. 40mm\nor a scale factor, e.g. 0.5x or 200%:','');
  if(!ans)return;
  const t=ans.trim(),m=t.match(/^([\d.]+)\s*(x|×|%)$/i);
  let f;
  if(m)f=parseFloat(m[1])/(m[2]==='%'?100:1);
  else{const L=parseLen(t),w=b.size[0]>1e-9?b.size[0]:Math.max(...b.size);f=L/w;}
  if(!(f>0)||!isFinite(f))return flash('Could not read that size');
  pushUndo(null,'Resize');
  const o=b.mn,sc=p=>add(o,mul(sub(p,o),f));
  xform(vertsOf(ids||new Set([...model.faces,...model.edges].map(x=>x.id))),sc);
  if(!ids)model.guides.forEach(g=>{g.p=clean(sc(g.p));});
  commitChange();zoomExtents();
  flash('New size: '+sizeText(bounds(ids)),4000);
};
const updateStats=function updateStats(){const b=bounds(),over=b&&!fitsBed(b)&&!fitInfo().each;$cad('stats').style.color=over?'#c0201a':'';$cad('stats').title=over?'Too big for your printer bed ('+bedText()+')':'';$cad('stats').textContent=(b?'Size '+sizeText(b)+(over?' ⚠ too big for bed':'')+' · ':'')+model.faces.length+' faces'+(model.edges.length?' · '+model.edges.length+' lines':'')+(model.guides.length?' · '+model.guides.length+' centre pts':'')+(selection.size?' · '+selection.size+' selected':'')+((n=>n?' · '+n+' hidden':'')(model.faces.filter(f=>f.hidden).length))+((n=>n?' · '+n+(n===1?' group':' groups'):'')(groupCount()));};
const selChanged=function selChanged(){markDirtyCad();scheduleStats();};
const protractor=function protractor(c,A,r){
  const [u,v]=basis(A),out=[],n=36,col=[0.2,0.35,0.9];
  for(let i=0;i<n;i++){const a1=i/n*Math.PI*2,a2=(i+1)/n*Math.PI*2;
    out.push([add(c,add(mul(u,Math.cos(a1)*r),mul(v,Math.sin(a1)*r))),add(c,add(mul(u,Math.cos(a2)*r),mul(v,Math.sin(a2)*r))),col]);}
  return out;
};
// Small curved-arrow chevrons around the rotation circle, showing which way it can turn.
// dir===0 (or omitted): show both directions (nothing chosen yet). dir>0: CCW only. dir<0: CW only.
const protractorArrows=function protractorArrows(c,A,r,dir){
  const [u,v]=basis(A),out=[],col=[1,0.55,0.1],marks=4,sz=r*0.22;
  const pt=a=>add(c,add(mul(u,Math.cos(a)*r),mul(v,Math.sin(a)*r)));
  const tangent=a=>add(mul(u,-Math.sin(a)),mul(v,Math.cos(a))); // +ve = CCW
  for(let k=0;k<marks;k++){
    const a=k/marks*Math.PI*2+Math.PI/marks;
    const p=pt(a),tg=tangent(a),rad=norm(sub(p,c));
    const dirs=dir===undefined||dir===0?[1,-1]:[dir>0?1:-1];
    for(const s of dirs){
      const tip=add(p,mul(tg,sz*s));
      const b1=add(p,mul(rad,sz*0.45)),b2=add(p,mul(rad,-sz*0.45));
      out.push([b1,tip,col],[tip,b2,col]);
    }
  }
  return out;
};
