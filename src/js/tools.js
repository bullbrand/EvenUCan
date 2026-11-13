// ---------------------------------------------------------------- UI helpers
const markerEl=$('marker'),vcbEl=$('vcb');
let markerInfo=null;
const MARK={through:['#e01b1b','Cuts Through ✓ click to cut the hole'],complete:['#9b30d9','Completes Shape'],guide:['#e07b00','Guide Point'],endpoint:['#17a317','Endpoint'],midpoint:['#13b5c4','Midpoint'],edge:['#d22','On Edge'],face:['#2a5bd7','On Face']};
function setMarker(inf){markerInfo=inf&&(MARK[inf.type]||inf.type==='axis')?inf:null;placeMarker();}
function placeMarker(){
  if(!markerInfo){markerEl.style.display='none';return;}
  const s=toScreen(markerInfo.p);if(!s){markerEl.style.display='none';return;}
  let col,lbl;
  if(markerInfo.type==='axis'){col='#'+AXCOL[markerInfo.axis].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
    lbl=(markerInfo.locked?'Locked to ':'On ')+{x:'Red',y:'Green',z:'Blue'}[markerInfo.axis]+' Axis';}
  else[col,lbl]=MARK[markerInfo.type];
  if(markerInfo.label)lbl=markerInfo.label;
  markerEl.style.display='block';markerEl.style.transform=`translate(${s[0]}px,${s[1]}px)`;
  markerEl.firstChild.style.background=col;markerEl.lastChild.textContent=lbl;
}
// ---- Sizes on the shape: a rectangle shows its two sides, a circle or polygon its diameter, a box its width, depth
// and height. They show on the shape just drawn (or the one selected); click one and type a new size to change it.
const dimsEl=document.createElement('div');dimsEl.id='dims';$('view').appendChild(dimsEl);
let lastShape=null,dimEdit=null,dimCache={ver:-1,sel:null,items:[]};
// The face that was just drawn (found again after it was fitted in with what's around it).
function rememberShape(c,n){
  const f=model.faces.find(f=>!f.hidden&&dot(faceNormal(f),n)>0.9999&&Math.abs(dot(sub(c,f.pts[0]),n))<1e-6&&insideFace(f,c,false));
  lastShape=f?f.id:null;
}
function shapeDims(){
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
}
function placeDims(){
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
    el.style.transform=`translate(${Math.round(x-el.offsetWidth/2)}px,${Math.round(y-el.offsetHeight/2)}px)`;it.at=[x,y];
  });
  for(let i=items.length;i<els.length;i++)els[i].remove();
  if(dimEdit){const [x,y]=dimEdit.item.at||[0,0];dimEdit.input.style.transform=`translate(${Math.round(x-42)}px,${Math.round(y-11)}px)`;}
}
function startDimEdit(i){
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
}
function setHover(face){const i=face?model.faces.indexOf(face):-10;if(i!==hoverIdx){hoverIdx=i;requestDraw();}}
function vcbShow(t){if(document.activeElement!==vcbEl)vcbEl.value=t;}
function setHint(t){$('hint').textContent=t;}
let toastT=0;
function flash(msg,ms){const t=$('toast');t.textContent=msg;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',ms||2600);}
// Bounding box of faces/lines (optionally only the given ids): {mn,mx,size} in metres, or null.
function bounds(ids){
  const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];let any=false;
  const take=p=>{any=true;for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}};
  for(const f of model.faces)if(!ids||ids.has(f.id))f.pts.forEach(take);
  for(const e of model.edges)if(!ids||ids.has(e.id)){take(e.a);take(e.b);}
  return any?{mn,mx,size:sub(mx,mn)}:null;
}
const sizeText=b=>b.size.map(fmt).join(' × ');
// Catch the classic mistake of drawing in the wrong units before it reaches the slicer.
const bedText=()=>bed.x+' × '+bed.y+' × '+bed.z+' mm';
// Largest footprint first, so a part that fits when turned on the bed isn't flagged.
function fitsBed(b){
  const [w,d,h]=b.size.map(v=>v*1000),bw=Math.max(bed.x,bed.y),bd=Math.min(bed.x,bed.y);
  return h<=bed.z+1e-6&&Math.max(w,d)<=bw+1e-6&&Math.min(w,d)<=bd+1e-6;
}
// Separate groups (e.g. an enclosure's base and lid) can be printed one at a time, so each is checked on its own.
function fitInfo(){
  const all=bounds();if(!all||fitsBed(all))return {fits:true,each:false};
  const gs=new Map();for(const f of model.faces){const k=f.g||0;if(!gs.has(k))gs.set(k,new Set());gs.get(k).add(f.id);}
  const each=gs.size>1&&[...gs.values()].every(ids=>fitsBed(bounds(ids)));
  return {fits:each,each};
}
function sizeOK(){
  const b=bounds();if(!b)return true;
  const big=Math.max(...b.size),mm=b.size.map(v=>+(v*1000).toFixed(2)).join(' × ')+' mm';
  if(big<0.0005)return confirm('Check the size: this model is only '+mm+', smaller than half a millimetre. It may have been drawn with the wrong Units setting.\n\nTip: use the Resize button to set the exact size.\n\nSave it anyway?');
  if(fitsBed(b)||fitInfo().each)return true;
  return confirm('This model is '+mm+'. That does not fit your printer ('+bedText()+').'+(big>2*Math.max(bed.x,bed.y,bed.z)/1000?'\n\nIt may have been drawn with the wrong Units setting (currently '+$('units').options[$('units').selectedIndex].text+').':'')+'\n\nTip: use Resize to set the exact size, or Printer to change the bed size.\n\nSave it anyway?');
}
// Small in-app text box (the browser's prompt() isn't available when running as a desktop app).
function askText(message,initial){
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
}
async function resizeModel(){
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
}
function updateStats(){const b=bounds(),over=b&&!fitsBed(b)&&!fitInfo().each;$('stats').style.color=over?'#c0201a':'';$('stats').title=over?'Too big for your printer bed ('+bedText()+')':'';$('stats').textContent=(b?'Size '+sizeText(b)+(over?' ⚠ too big for bed':'')+' · ':'')+model.faces.length+' faces'+(model.edges.length?' · '+model.edges.length+' lines':'')+(model.guides.length?' · '+model.guides.length+' centre pts':'')+(selection.size?' · '+selection.size+' selected':'')+((n=>n?' · '+n+' hidden':'')(model.faces.filter(f=>f.hidden).length))+((n=>n?' · '+n+(n===1?' group':' groups'):'')(groupCount()));}
function selChanged(){markDirty();scheduleStats();}
function protractor(c,A,r){
  const [u,v]=basis(A),out=[],n=36,col=[0.2,0.35,0.9];
  for(let i=0;i<n;i++){const a1=i/n*Math.PI*2,a2=(i+1)/n*Math.PI*2;
    out.push([add(c,add(mul(u,Math.cos(a1)*r),mul(v,Math.sin(a1)*r))),add(c,add(mul(u,Math.cos(a2)*r),mul(v,Math.sin(a2)*r))),col]);}
  return out;
}
// Small curved-arrow chevrons around the rotation circle, showing which way it can turn.
// dir===0 (or omitted): show both directions (nothing chosen yet). dir>0: CCW only. dir<0: CW only.
function protractorArrows(c,A,r,dir){
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
}

// ---------------------------------------------------------------- tools
const tools={};
let tool={},toolName='';
function endOp(){preview.lines=[];lockAxis=null;setMarker(null);requestDraw();}

// What a selection box from d0 to m picks. Left→right (window): only things completely inside.
// Right→left (crossing): anything the box touches.
// Which points can be seen (not hidden behind a face). Window selection only judges what you can see,
// so a slot cut through a part can be boxed from above without its hidden lower corners spoiling it.
function visibleMap(){
  const vis=new Map();
  const check=p=>{
    const k=key(p);if(vis.has(k))return;
    const s=toScreen(p);if(!s){vis.set(k,false);return;}
    const ray=screenRay(s[0],s[1]),tp=dot(sub(p,ray.o),ray.d),h=pickFace(ray);
    vis.set(k,!(h&&h.t<tp-Math.max(1e-6,tp*2e-4)));
  };
  for(const f of model.faces)f.pts.forEach(check);
  for(const e of model.edges){check(e.a);check(e.b);}
  for(const g of model.guides)check(g.p);
  return vis;
}
function boxPick(d0,m,vis){
  const x0=Math.min(d0.x,m.x),x1=Math.max(d0.x,m.x),y0=Math.min(d0.y,m.y),y1=Math.max(d0.y,m.y),crossing=m.x<d0.x;
  const inb=s=>s[0]>=x0&&s[0]<=x1&&s[1]>=y0&&s[1]<=y1;
  const R=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const test=(ps,closed)=>{
    const S=ps.map(toScreen);
    if(!crossing){
      const seen=vis?S.filter((s,i)=>vis.get(key(ps[i]))):S;
      return seen.length>0&&seen.every(s=>s&&inb(s));
    }
    const onScreen=S.filter(Boolean);if(!onScreen.length)return false;
    if(onScreen.some(inb))return true;
    const n=closed?S.length:S.length-1;
    for(let i=0;i<n;i++){const a=S[i],b=S[(i+1)%S.length];if(!a||!b)continue;for(let j=0;j<4;j++)if(segX(a,b,R[j],R[(j+1)%4]))return true;}
    return !!closed&&S.every(Boolean)&&pip(R[0],S);// box entirely inside the shape
  };
  const out=new Set();
  for(const f of model.faces)if(!f.hidden&&test(f.pts,true))out.add(f.id);
  for(const ed of model.edges)if(test([ed.a,ed.b],false))out.add(ed.id);
  for(const g of model.guides)if(test([g.p],false))out.add(g.id);
  return out;
}
tools.select=()=>{
  let down=null,before=null,vis=null;const box=$('box');
  // While dragging, show the would-be selection live (on top of what was already selected when adding).
  const preview=(m,add_)=>{
    if(!vis)vis=visibleMap();// the camera doesn't move during a drag, so work this out once
    const picked=boxPick(down,m,vis),crossing=m.x<down.x;
    // A group counts as one item: touched (right→left) or wholly inside (left→right) picks all of it.
    const members=new Map();
    for(const x of groupable())if(x.g&&!x.hidden){if(!members.has(x.g))members.set(x.g,[]);members.get(x.g).push(x.id);}
    for(const [g,list] of members){
      const any=list.some(id=>picked.has(id)),all=list.every(id=>picked.has(id));
      if(crossing?any:all)list.forEach(id=>picked.add(id));else list.forEach(id=>picked.delete(id));
    }
    selection=new Set(add_?before:[]);for(const id of picked)selection.add(id);selChanged();
  };
  return {label:'',hint:'Click to select · Shift/Ctrl+click adds · Double-click selects a whole object · Drag left→right to select what is fully inside, right→left for anything touched · Delete removes',
    down(e,m){down=m;before=new Set(selection);vis=null;},
    move(e,m){
      if(!down||!(e.buttons&1))return;
      const x0=Math.min(down.x,m.x),y0=Math.min(down.y,m.y);
      if(Math.abs(m.x-down.x)>4||Math.abs(m.y-down.y)>4){
        box.style.display='block';box.className=m.x<down.x?'cross':'';
        Object.assign(box.style,{left:x0+'px',top:y0+'px',width:Math.abs(m.x-down.x)+'px',height:Math.abs(m.y-down.y)+'px'});
        preview(m,e.shiftKey||e.ctrlKey);
      }
    },
    up(e,m){
      if(!down)return;const d0=down;
      const add_=e.shiftKey||e.ctrlKey;
      if(Math.abs(m.x-d0.x)>4||Math.abs(m.y-d0.y)>4){
        preview(m,add_);down=null;box.style.display='none';
        if(!selection.size)flash(m.x>d0.x?'Nothing was completely inside the box. Drag right-to-left to pick anything the box touches.':'Nothing touched the box.',3500);
        return;
      }
      down=null;box.style.display='none';
      const hit=pickEntity(m.x,m.y);
      if(!add_)selection.clear();
      if(hit!==null){
        const all=expandGroups(new Set([hit]));// clicking any part of a group picks the whole group
        if(add_&&selection.has(hit))all.forEach(id=>selection.delete(id));else all.forEach(id=>selection.add(id));
      }
      selChanged();
    },
    dbl(e,m){const h=pickFace(screenRay(m.x,m.y));if(h){for(const id of componentOf(h.face.id))selection.add(id);selChanged();}},
    cancel(){
      if(down&&before){selection=before;selChanged();}// Esc mid-drag restores the old selection
      const busy=!!down;down=null;box.style.display='none';return busy;
    }
  };
};

tools.line=()=>{
  let pts=[],chain=[],cur=null;
  const reset=()=>{pts=[];chain=[];cur=null;endOp();};
  function addPoint(p){
    p=clean(p);
    if(!pts.length){pts=[p];setHint('Click the next point · Click the start point to close a face · Esc to finish');return;}
    const a=pts[pts.length-1];if(dist(a,p)<1e-6)return;
    pushUndo();
    const settle=()=>{planarizeSeg(a,p);commitChange();};
    if(trySplit(a,p)){settle();pts=[p];chain=[];return;}
    // Traced along the rim of a hole: fill it.
    const rim=openEdgeUnder(a,p);
    if(rim){
      if(closeLoop(rim[0],rim[1],null)){settle();flash('Hole closed');reset();setHint(tool.hint);}
      else{dropUndo();flash('That open edge is not part of a flat loop, so it cannot be filled');pts=[p];}
      return;
    }
    const closing=pts.length>=3&&key(p)===key(pts[0]);
    const eid=nid();model.edges.push({id:eid,a,b:p});chain.push(eid);
    if(closing){
      if(isPlanar(pts)){model.edges=model.edges.filter(e=>!chain.includes(e.id));addFace(pts);}
      settle();reset();setHint(tool.hint);return;
    }
    if(closeLoop(a,p,eid)){settle();reset();setHint(tool.hint);return;}
    pts.push(p);settle();
  }
  return {label:'Length',hint:'Click to start a line · Arrow keys lock to an axis · Type a length and press Enter',
    move(e,m){
      cur=inferPoint(m.x,m.y,{base:pts[pts.length-1],extra:pts});setMarker(cur);preview.lines=[];
      if(pts.length&&cur){const a=pts[pts.length-1];preview.lines.push([a,cur.p,axisColor(cur)]);if(cur.from)preview.lines.push([cur.p,cur.from,[0.55,0.55,0.6]]);vcbShow(fmt(dist(a,cur.p)));}
    },
    down(e,m){if(cur)addPoint(cur.p);},
    vcb(t){
      if(!pts.length||!cur)return flash('Start the line first, then type a length');
      const L=parseLen(t);if(!(L>0))return flash('Could not read that length');
      const a=pts[pts.length-1],d=sub(cur.p,a);if(len(d)<1e-9)return;
      addPoint(add(a,mul(norm(d),L)));
    },
    busy:()=>pts.length>0,
    cancel(){const busy=pts.length>0;reset();setHint(tool.hint);return busy;}
  };
};

function planeFor(inf){return {p:inf.p,n:inf.face?faceNormal(inf.face):workPlane.n};}

tools.rect=()=>{
  let p0=null,plane=null,U,V,cur=null,ab=[0,0];
  const reset=()=>{p0=null;endOp();setHint(t.hint);};
  const corners=()=>[p0,add(p0,mul(U,ab[0])),add(add(p0,mul(U,ab[0])),mul(V,ab[1])),add(p0,mul(V,ab[1]))];
  function finish(){if(Math.abs(ab[0])<1e-6||Math.abs(ab[1])<1e-6)return;pushUndo();const c=corners(),f=addFace(c,plane.n);if(f)planarize(faceNormal(f),f.pts[0]);rememberShape(mul(add(c[0],c[2]),0.5),plane.n);commitChange();reset();}
  const t={label:'Dimensions',hint:'Click the first corner (on the ground or on a face)',
    move(e,m){
      if(!p0){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:true});if(!q)return;cur=q;setMarker(q);
      const d=sub(q.p,p0);ab=[dot(d,U),dot(d,V)];
      const c=corners(),col=[0.1,0.1,0.1];preview.lines=c.map((p,i)=>[p,c[(i+1)%4],col]);
      vcbShow(fmt(Math.abs(ab[0]))+', '+fmt(Math.abs(ab[1])));
    },
    down(e,m){
      if(!p0){if(!cur)return;p0=cur.p;plane=planeFor(cur);[U,V]=basis(plane.n);ab=[0,0];setHint('Click the opposite corner · or type width, length and press Enter (e.g. 3, 4)');return;}
      finish();
    },
    vcb(s){
      if(!p0)return flash('Click the first corner, then type the size');
      const parts=s.split(/[,;x]/i).map(parseLen);
      if(parts.length!==2||parts.some(v=>!(Math.abs(v)>0)))return flash('Type two sizes separated by a comma, e.g. 3, 4');
      ab=[parts[0]*(ab[0]<0?-1:1),parts[1]*(ab[1]<0?-1:1)];finish();
    },
    busy:()=>!!p0,
    cancel(){const busy=!!p0;reset();return busy;}
  };
  return t;
};

tools.circle=()=>{
  let c=null,plane=null,U,V,r=0,cur=null,segs=24;
  const reset=()=>{c=null;endOp();setHint(t.hint);};
  const ring=()=>{const out=[];for(let i=0;i<segs;i++){const a=i/segs*Math.PI*2;out.push(add(c,add(mul(U,Math.cos(a)*r),mul(V,Math.sin(a)*r))));}return out;};
  function finish(){if(r<1e-6)return;pushUndo();const f=addFace(ring(),plane.n);if(f)planarize(faceNormal(f),f.pts[0]);rememberShape(c,plane.n);commitChange();reset();}
  const t={label:'Radius',hint:'Click the centre of the circle · type e.g. 36s to change the number of sides',
    move(e,m){
      if(!c){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:true});if(!q)return;cur=q;setMarker(q);
      r=dist(q.p,c);const ps=ring(),col=[0.1,0.1,0.1];
      preview.lines=ps.map((p,i)=>[p,ps[(i+1)%ps.length],col]);preview.lines.push([c,q.p,[0.4,0.4,0.4]]);
      vcbShow(fmt(r));
    },
    down(e,m){
      if(!c){if(!cur)return;c=cur.p;plane=planeFor(cur);[U,V]=basis(plane.n);r=0;setHint('Click to set the radius, or type it and press Enter');return;}
      finish();
    },
    vcb(s){
      const m=s.match(/^(\d+)\s*s$/i);
      if(m){segs=clamp(parseInt(m[1]),3,360);return flash(segs+' sides');}
      if(!c)return flash('Click the centre first');
      const L=parseLen(s);if(!(L>0))return flash('Could not read that radius');r=L;finish();
    },
    busy:()=>!!c,
    cancel(){const busy=!!c;reset();return busy;}
  };
  return t;
};

// Two-point arc, as in SketchUp: click both ends, then pull out the bulge. It is drawn as short lines, so it
// cuts a face it crosses and closes loops like any other line.
tools.arc=()=>{
  let A=null,B=null,plane=null,cur=null,h=0,segs=0;
  const reset=()=>{A=B=null;h=0;endOp();setHint(t.hint);};
  function points(){
    const c=dist(A,B),s=Math.abs(h);if(c<1e-9)return [A,B];
    const u=norm(sub(B,A)),w0=norm(cross(plane.n,u)),w=h<0?mul(w0,-1):w0,M=mul(add(A,B),0.5);
    if(s<1e-9)return [A,B];
    const R=(c*c/4+s*s)/(2*s),O=add(M,mul(w,s-R)),th=4*Math.atan(2*s/c);
    const n=segs||Math.max(2,Math.round(th/(Math.PI*2)*24));
    const out=[];for(let i=0;i<=n;i++){const f=-th/2+th*i/n;out.push(clean(add(O,add(mul(u,R*Math.sin(f)),mul(w,R*Math.cos(f))))));}
    out[0]=A;out[n]=B;return out;
  }
  function finish(){
    const P=points();if(P.length<3)return flash('Pull the arc out from the line first');
    pushUndo();let last=null;
    for(let i=1;i<P.length;i++){last={id:nid(),a:P[i-1],b:P[i]};model.edges.push(last);}
    // join up with what is there: fill a closed loop, or cut the face it was drawn across
    if(!closeLoop(last.a,last.b,last.id)){
      const f=model.faces.find(f=>!f.g&&!f.hidden&&P.every(p=>Math.abs(dot(sub(p,f.pts[0]),faceNormal(f)))<1e-6));
      if(f)planarize(faceNormal(f),f.pts[0]);else if(P.every(p=>Math.abs(p[2]-P[0][2])<1e-9))planarize(Z,[0,0,P[0][2]]);
    }
    commitChange();reset();
  }
  const t={label:'Bulge',hint:'Click the start of the arc · type e.g. 12s to set the number of pieces',
    move(e,m){
      if(!A){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:!!B,base:B?null:A});if(!q)return;cur=q;setMarker(q);
      if(!B){preview.lines=[[A,q.p,axisColor(q)]];vcbShow(fmt(dist(A,q.p)));return;}
      const u=norm(sub(B,A)),w=norm(cross(plane.n,u)),c=dist(A,B);
      h=dot(sub(q.p,mul(add(A,B),0.5)),w);
      if(Math.abs(Math.abs(h)-c/2)<c*0.04)h=Math.sign(h)*c/2;// snaps to a half circle
      const P=points(),col=[0.1,0.1,0.1];preview.lines=P.slice(1).map((p,i)=>[P[i],p,col]);
      vcbShow(fmt(Math.abs(h)));setHint(Math.abs(Math.abs(h)-c/2)<1e-9?'Half circle · click to finish':'Click to set the bulge, or type it and press Enter');
    },
    down(e,m){
      if(!cur)return;
      if(!A){A=clean(cur.p);plane=planeFor(cur);setHint('Click the end of the arc · or type the distance between the ends');return;}
      if(!B){if(dist(cur.p,A)<1e-6)return;B=clean(cur.p);h=0;setHint('Move to pull out the bulge, then click');return;}
      finish();
    },
    vcb(s){
      const m=s.match(/^(\d+)\s*s$/i);
      if(m){segs=clamp(parseInt(m[1]),2,180);flash(segs+' pieces');return;}
      const L=parseLen(s);if(!(L>0))return flash('Could not read that');
      if(A&&!B&&cur){const d=sub(cur.p,A);if(len(d)<1e-9)return;B=clean(add(A,mul(norm(d),L)));h=0;setHint('Move to pull out the bulge, then click');return;}
      if(B){h=(h<0?-1:1)*L;finish();return;}
      flash('Click the start of the arc first');
    },
    busy:()=>!!A,
    cancel(){const busy=!!A;reset();return busy;}
  };
  return t;
};

// Polygon: like the circle, but with few straight sides (6 = hexagon, 3 = triangle). The mouse sets a corner.
let polySides=6;
tools.polygon=()=>{
  let c=null,plane=null,U,V,r=0,ang=0,cur=null;
  const reset=()=>{c=null;endOp();setHint(t.hint);};
  const ring=()=>{const out=[];for(let i=0;i<polySides;i++){const a=ang+i/polySides*Math.PI*2;out.push(add(c,add(mul(U,Math.cos(a)*r),mul(V,Math.sin(a)*r))));}return out;};
  function finish(){if(r<1e-6)return;pushUndo();const f=addFace(ring(),plane.n);if(f)planarize(faceNormal(f),f.pts[0]);rememberShape(c,plane.n);commitChange();reset();}
  const t={label:'Radius',hint:'Click the centre · '+polySides+' sides now: type e.g. 6s (hexagon), 3s (triangle), 8s (octagon) and Enter to change',
    move(e,m){
      if(!c){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:true});if(!q)return;cur=q;setMarker(q);
      const d=sub(q.p,c);r=len(d);if(r>1e-9)ang=Math.atan2(dot(d,V),dot(d,U));
      const ps=ring(),col=[0.1,0.1,0.1];
      preview.lines=ps.map((p,i)=>[p,ps[(i+1)%ps.length],col]);preview.lines.push([c,q.p,[0.4,0.4,0.4]]);
      vcbShow(fmt(r));
    },
    down(e,m){
      if(!c){if(!cur)return;c=cur.p;plane=planeFor(cur);[U,V]=basis(plane.n);r=0;ang=0;setHint('Click to set the size (centre to corner), or type it and press Enter');return;}
      finish();
    },
    vcb(s){
      const mm=s.match(/^(\d+)\s*s$/i);
      if(mm){polySides=clamp(parseInt(mm[1]),3,100);t.hint='Click the centre · '+polySides+' sides now: type e.g. 6s (hexagon), 3s (triangle), 8s (octagon) and Enter to change';if(!c)setHint(t.hint);return flash(polySides+' sides');}
      if(!c)return flash('Click the centre first');
      const L=parseLen(s);if(!(L>0))return flash('Could not read that size');r=L;finish();
    },
    busy:()=>!!c,
    cancel(){const busy=!!c;reset();return busy;}
  };
  return t;
};

// ---- 3D Shapes: a ball, cone, cylinder or pyramid in one go. Click the centre, then the radius,
// then the height (a ball needs only its radius). Each is made as its own solid group, ready to print.
let solidKind='ball';
const SOLIDS={ball:'Ball',cone:'Cone',cylinder:'Cylinder',pyramid:'Pyramid'};
function solidFaces(kind,c,N,U,V,r,h,col){
  const g=nid(),F=[],n=kind==='pyramid'?4:kind==='ball'?32:32,a0=kind==='pyramid'?Math.PI/4:0;
  const P=(rad,z,i,nn)=>{const a=a0+i/nn*Math.PI*2;return clean(add(c,add(add(mul(U,Math.cos(a)*rad),mul(V,Math.sin(a)*rad)),mul(N,z))));};
  const add_=(pts,soft)=>F.push({id:nid(),pts,holes:[],color:col,g,soft:soft||undefined});
  if(kind==='ball'){
    const rings=16,top=clean(add(c,mul(N,2*r))),bot=clean(c);
    const row=k=>{const th=Math.PI*k/rings,z=r-r*Math.cos(th),rad=r*Math.sin(th);return Array.from({length:n},(_,i)=>P(rad,z,i,n));};
    let prev=row(1);for(let i=0;i<n;i++)add_([bot,prev[(i+1)%n],prev[i]],true);
    for(let k=2;k<rings;k++){const cur=row(k);for(let i=0;i<n;i++)add_([prev[i],prev[(i+1)%n],cur[(i+1)%n],cur[i]],true);prev=cur;}
    for(let i=0;i<n;i++)add_([top,prev[i],prev[(i+1)%n]],true);
  }else{
    const base=Array.from({length:n},(_,i)=>P(r,0,i,n)),smooth=kind!=='pyramid';
    add_(base.slice());
    if(kind==='cylinder'){const topR=Array.from({length:n},(_,i)=>P(r,h,i,n));add_(topR.slice());for(let i=0;i<n;i++)add_([base[i],base[(i+1)%n],topR[(i+1)%n],topR[i]],true);}
    else{const apex=clean(add(c,mul(N,h)));for(let i=0;i<n;i++)add_([base[i],base[(i+1)%n],apex],smooth);}
  }
  // every face points outwards (all these shapes are convex: away from the middle)
  const mid=add(c,mul(N,kind==='ball'?r:h/2));
  for(const f of F){const m=mul(f.pts.reduce((s,p)=>add(s,p),[0,0,0]),1/f.pts.length);if(dot(loopNormal(f.pts),sub(m,mid))<0)f.pts.reverse();}
  return F;
}
tools.solid=()=>{
  let c=null,plane=null,U,V,r=0,h=0,st=0,cur=null,hp=null;
  const bar=$('shapes');
  const showBar=()=>{bar.innerHTML='<div class="name">Shape</div>'+Object.entries(SOLIDS).map(([k,v])=>`<button data-k="${k}" class="${k===solidKind?'on':''}">${v}</button>`).join('');bar.style.display='block';
    bar.querySelectorAll('button').forEach(b=>b.onclick=()=>{solidKind=b.dataset.k;showBar();reset();});};
  const hintNow=()=>'Pick a shape on the right, then click its centre (on the ground or a face) · now: '+SOLIDS[solidKind];
  const reset=()=>{c=null;st=0;r=h=0;endOp();t.hint=hintNow();setHint(t.hint);};
  const lines=()=>{
    if(r<1e-6)return [];const F=solidFaces(solidKind,c,plane.n,U,V,r,solidKind==='ball'?r:Math.max(h,1e-6),null),out=[],seen=new Set(),col=[0.1,0.33,0.95];
    for(const f of F){if(f.soft&&solidKind==='ball')continue;for(let i=0;i<f.pts.length;i++){const a=f.pts[i],b=f.pts[(i+1)%f.pts.length],k=edgeKey(a,b);if(!seen.has(k)){seen.add(k);out.push([a,b,col]);}}}
    if(solidKind==='ball'){for(const f of F)for(let i=0;i<f.pts.length;i++){const a=f.pts[i],b=f.pts[(i+1)%f.pts.length];if(Math.abs(dot(sub(a,c),plane.n)-r)<1e-9&&Math.abs(dot(sub(b,c),plane.n)-r)<1e-9)out.push([a,b,col]);}}
    return out;
  };
  function finish(){
    if(r<1e-6||(solidKind!=='ball'&&h<1e-6))return;
    pushUndo();const F=solidFaces(solidKind,c,plane.n,U,V,r,h,null);
    model.faces.push(...F);commitChange();flash(SOLIDS[solidKind]+' made: it is a group (Ungroup to join it to other shapes)',4000);reset();
  }
  const t={label:'Radius',hint:'Pick a shape on the right, then click its centre (on the ground or a face) · now: '+SOLIDS[solidKind],
    move(e,m){
      if(st===0){cur=inferPoint(m.x,m.y);setMarker(cur);return;}
      if(st===1){const q=inferPoint(m.x,m.y,{plane,noAxes:true});if(!q)return;cur=q;setMarker(q);r=dist(q.p,c);preview.lines=[...lines(),[c,q.p,[0.4,0.4,0.4]]];vcbShow(fmt(r));return;}
      // height: along the face's normal, under the mouse
      const ray=screenRay(m.x,m.y);h=Math.max(0,rayLineClosest(ray.o,ray.d,c,plane.n));
      preview.lines=lines();vcbShow(fmt(h));
    },
    down(e,m){
      if(st===0){if(!cur)return;c=cur.p;plane=planeFor(cur);[U,V]=basis(plane.n);st=1;r=0;setHint('Click to set the radius, or type it and press Enter');return;}
      if(st===1){if(r<1e-6)return;if(solidKind==='ball')return finish();st=2;h=0;$('vcbLabel').textContent='Height';setHint('Move up to set the height and click, or type it and press Enter');return;}
      finish();
    },
    vcb(s){
      if(st===0)return flash('Click the centre first');
      const L=parseLen(s);if(!(L>0))return flash('Could not read that size');
      if(st===1){r=L;if(solidKind==='ball')return finish();st=2;h=0;$('vcbLabel').textContent='Height';setHint('Move up to set the height and click, or type it and press Enter');preview.lines=lines();return;}
      h=L;finish();
    },
    busy:()=>st>0,
    cancel(){const busy=st>0;reset();$('vcbLabel').textContent='Radius';return busy;}
  };
  setTimeout(showBar,0);
  return t;
};

let lastPush=0;
tools.push=()=>{
  let fid=null,fids=[],snap=null,start=null,N=null,d=0;
  const apply=()=>{model.faces=clone(snap);pushPullMany(fids,d);markDirty();};
  // The faces to push with face F: every selected face facing the same way, when F is one of them (Shift+click picks them).
  const together=F=>{
    if(!selection.has(F.id))return [F.id];
    const n=faceNormal(F),S=model.faces.filter(f=>selection.has(f.id)&&!f.hidden&&dot(faceNormal(f),n)>0.9999);
    return S.length>1?S.map(f=>f.id):[F.id];
  };
  const reset=()=>{fid=null;snap=null;endOp();setHint(t.hint);};
  function finish(){
    if(Math.abs(d)>1e-6){
      pushUndo(snapshot(snap));lastPush=d;commitChange();
      if(!model.faces.some(f=>f.id===fid))flash('Cut right through');
    }
    else{model.faces=snap;markDirty();}
    reset();
  }
  // Depths where the pushed face would land exactly on another parallel face it overlaps.
  // Landing on an opposite-facing face that fully contains it cuts a hole right through.
  function faceStops(){
    const F0=snap.find(f=>f.id===fid),cen=mul(F0.pts.reduce((s,p)=>add(s,p),[0,0,0]),1/F0.pts.length),out=[];
    for(const B of snap){
      if(B.id===fid)continue;
      const dp=dot(faceNormal(B),N);if(Math.abs(Math.abs(dp)-1)>1e-6)continue;
      const dB=dot(sub(B.pts[0],start),N);if(Math.abs(dB)<1e-7)continue;
      const c=add(cen,mul(N,dB));if(!insideFace(B,c,false))continue;
      const through=dp<0&&!F0.holes.length&&F0.pts.every(p=>insideFace(B,add(p,mul(N,dB)),true));
      out.push({d:dB,p:c,through});
    }
    return out;
  }
  let stops=[];
  const t={label:'Distance',hint:'Click a face to push or pull it · Shift+click several faces first to push them all together · it snaps to other faces and shows "Cuts Through" at the far side · Double-click repeats the last distance',
    move(e,m){
      if(fid===null){const h=pickFace(screenRay(m.x,m.y));setHover(h?h.face:null);return;}
      const r=screenRay(m.x,m.y),dr=rayLineClosest(r.o,r.d,start,N);
      let fs=null,bd=14;
      const sr=toScreen(add(start,mul(N,dr)));
      if(sr)for(const s of stops){
        const ss=toScreen(add(start,mul(N,s.d)));if(!ss)continue;
        const dd=Math.hypot(sr[0]-ss[0],sr[1]-ss[1]);if(dd<bd){bd=dd;fs=s;}
      }
      const v=fs?null:inferPoint(m.x,m.y,{faces:snap,exclude:new Set([fid]),vertexOnly:true});
      if(fs){d=fs.d;setMarker(fs.through?{p:fs.p,type:'through'}:{p:fs.p,type:'face',label:'On Face (level with it)'});}
      else if(v){d=dot(sub(v.p,start),N);setMarker(v);}
      else{d=dr;setMarker(null);}
      d=Math.round(d*1e6)/1e6;
      apply();vcbShow(fmt(d));
    },
    down(e,m){
      if(fid===null){
        const h=pickFace(screenRay(m.x,m.y));if(!h)return;
        if(e.shiftKey){// pick several faces, then click one of them to push them all
          if(selection.has(h.face.id))selection.delete(h.face.id);else selection.add(h.face.id);selChanged();
          const n=model.faces.filter(f=>selection.has(f.id)).length;
          setHint(n>1?n+' faces picked: click one of them (without Shift) to push or pull them all together':'Shift+click more faces to push them together, or click a face to push it on its own');
          return;
        }
        fid=h.face.id;fids=together(h.face);snap=clone(model.faces);start=h.p;N=faceNormal(h.face);d=0;setHover(null);stops=faceStops();
        setHint((fids.length>1?'Pushing '+fids.length+' faces together · ':'')+'Move the mouse to set the distance, click to finish · or type a distance and press Enter');return;
      }
      finish();
    },
    dbl(e,m){
      if(fid!==null||!lastPush)return;
      const h=pickFace(screenRay(m.x,m.y));if(!h)return;
      pushUndo();pushPullMany(together(h.face),lastPush);commitChange();
    },
    vcb(s){
      const L=parseLen(s);if(isNaN(L))return flash('Could not read that distance');
      if(fid===null)return flash('Click a face first');
      d=L*(d<0?-1:1);apply();finish();
    },
    busy:()=>fid!==null,
    cancel(){if(fid===null)return false;model.faces=snap;markDirty();reset();return true;}
  };
  return t;
};

let lastCopy=null;
tools.move=()=>{
  let base=null,ids=null,vset=null,moving=null,snapF=null,snapE=null,delta=[0,0,0],copy=false,cur=null,rigid=false;
  function apply(){
    model.faces=clone(snapF);model.edges=clone(snapE);
    if(copy)copyEntities(snapF,snapE,ids,p=>add(p,delta));
    else if(rigid)xformIds(ids,p=>add(p,delta));
    else xform(vset,p=>add(p,delta));
    markDirty();
  }
  const reset=()=>{base=null;snapF=null;endOp();setHint(t.hint);};
  function finish(){
    if(len(delta)<1e-9){model.faces=snapF;model.edges=snapE;markDirty();return reset();}
    const before=snapshot(snapF,snapE);pushUndo(before);
    lastCopy=copy?{before,snapF,snapE,ids,delta}:null;
    commitChange();reset();
    if(lastCopy)setHint('Copied. Type e.g. 5x and Enter for 5 copies, or /5 to spread copies evenly');
  }
  const t={label:'Distance',hint:'Click a point on an object (or on the selection) to pick it up · hold Ctrl to copy · arrow keys lock to an axis',
    move(e,m){
      if(!base){cur=inferPoint(m.x,m.y);setMarker(cur);if(!selection.size)setHover(cur&&cur.face?cur.face:null);return;}
      const c=e.ctrlKey;
      const q=inferPoint(m.x,m.y,{base,faces:snapF,exclude:moving});if(!q)return;
      cur=q;setMarker(q);copy=c;delta=sub(q.p,base);apply();
      preview.lines=[[base,q.p,axisColor(q)]];vcbShow(fmt(len(delta)));
    },
    down(e,m){
      if(!base){
        if(!cur)return;
        ids=selection.size?new Set(selection):(cur.face?componentOf(cur.face.id):null);
        if(!ids||!ids.size)return flash('Click on an object, or select something first');
        ids=expandGroups(ids);rigid=hasGroup(ids);
        vset=vertsOf(ids);moving=rigid?ids:touching(vset);snapF=clone(model.faces);snapE=clone(model.edges);
        base=cur.p;delta=[0,0,0];setHover(null);
        setHint('Click where to put it · type a distance, or x,y,z offset · hold Ctrl to copy');return;
      }
      copy=e.ctrlKey;apply();finish();
    },
    vcb(s){
      const arr=s.match(/^(\d+)\s*[x*]$/i),div=s.match(/^\/\s*(\d+)$/);
      if(!base&&lastCopy&&(arr||div)){
        const n=clamp(parseInt((arr||div)[1]),1,500),L=lastCopy;
        restore(L.before);
        for(let k=1;k<=n;k++){const dd=mul(L.delta,arr?k:k/n);copyEntities(L.snapF,L.snapE,L.ids,p=>add(p,dd));}
        commitChange();return flash(n+' copies');
      }
      if(!base)return flash('Pick up an object first');
      const parts=s.split(/[,;]/);
      if(parts.length===3){const v=parts.map(parseLen);if(v.some(isNaN))return flash('Could not read that offset');delta=v;}
      else{const L=parseLen(s);if(isNaN(L))return flash('Could not read that distance');if(len(delta)<1e-9)return flash('Move the mouse to show the direction first');delta=mul(norm(delta),L);}
      apply();finish();
    },
    busy:()=>!!base,
    cancel(){if(!base)return false;model.faces=snapF;model.edges=snapE;markDirty();reset();return true;}
  };
  return t;
};

tools.rotate=()=>{
  let st=0,c=null,A=Z,plane=null,r0=null,refLen=1,ids=null,vset=null,moving=null,snapF=null,snapE=null,ang=0,cur=null,rigid=false;
  function apply(){
    model.faces=clone(snapF);model.edges=clone(snapE);
    const fn=p=>rotateAbout(p,c,A,ang);if(rigid)xformIds(ids,fn);else xform(vset,fn);
    markDirty();
  }
  const reset=()=>{st=0;snapF=null;endOp();setHint(t.hint);};
  function finish(){
    if(Math.abs(ang)<1e-9){if(snapF){model.faces=snapF;model.edges=snapE;markDirty();}return reset();}
    pushUndo(snapshot(snapF,snapE));commitChange();reset();
  }
  const t={label:'Angle',hint:selection.size?'Type degrees and press Enter to spin the selection round its own centre · or click a centre of rotation':'Click the centre of rotation on an object (or on the selection)',
    move(e,m){
      if(st===0){cur=inferPoint(m.x,m.y);setMarker(cur);if(!selection.size)setHover(cur&&cur.face?cur.face:null);
        if(cur){const rr=cam.dist*0.05,nrm=cur.face?faceNormal(cur.face):Z;preview.lines=[...protractor(cur.p,nrm,rr),...protractorArrows(cur.p,nrm,rr,0)];}return;}
      const q=inferPoint(m.x,m.y,{plane,noAxes:true,faces:snapF||model.faces,exclude:st===2?moving:null});if(!q)return;cur=q;setMarker(q);
      const pr=protractor(c,A,cam.dist*0.05);
      if(st===1){preview.lines=[...pr,...protractorArrows(c,A,cam.dist*0.05,0),[c,q.p,[0.1,0.1,0.1]]];return;}
      const v=sub(q.p,c),vp=sub(v,mul(A,dot(v,A)));if(len(vp)<1e-9)return;
      const vn=norm(vp);ang=Math.atan2(dot(cross(r0,vn),A),dot(r0,vn));
      // Snap hard to the cardinal angles (0/90/180/270/360) with a wide catch, otherwise to every 15°.
      const quart=Math.PI/2,kq=Math.round(ang/quart);
      if(Math.abs(ang-kq*quart)<0.09)ang=kq*quart;
      else{const step=Math.PI/12,k=Math.round(ang/step);if(Math.abs(ang-k*step)<0.04)ang=k*step;}
      apply();preview.lines=[...pr,...protractorArrows(c,A,cam.dist*0.05,ang>=0?1:-1),[c,add(c,mul(r0,refLen)),[0.4,0.4,0.4]],[c,add(c,mul(vn,refLen)),[0.1,0.1,0.1]]];
      vcbShow((Math.round(ang*180/Math.PI*100)/100)+'°');
    },
    down(e,m){
      if(!cur)return;
      if(st===0){
        ids=selection.size?new Set(selection):(cur.face?componentOf(cur.face.id):null);
        if(!ids||!ids.size)return flash('Click on an object, or select something first');
        ids=expandGroups(ids);rigid=hasGroup(ids);
        c=cur.p;A=cur.face?faceNormal(cur.face):Z;plane={p:c,n:A};st=1;setHover(null);
        setHint('Click a point to set the starting angle');return;
      }
      if(st===1){
        const v=sub(cur.p,c),vp=sub(v,mul(A,dot(v,A)));if(len(vp)<1e-6)return;
        r0=norm(vp);refLen=len(vp);snapF=clone(model.faces);snapE=clone(model.edges);vset=vertsOf(ids);moving=rigid?ids:touching(vset);ang=0;st=2;
        setHint('Click to set the angle (snaps hard to 90/180/270/360°, else every 15°) · or type degrees and press Enter');return;
      }
      finish();
    },
    vcb(s){
      const a=parseFloat(s);if(isNaN(a))return flash('Type an angle in degrees');
      // Nothing clicked yet: with something already selected, just spin it that many degrees around its
      // own centre (vertical axis) - no need to click a centre and a starting angle first.
      if(st===0){
        if(!selection.size)return flash('Select something to rotate, or click a centre of rotation first');
        ids=expandGroups(new Set(selection));rigid=hasGroup(ids);
        const b=bounds(ids);if(!b)return;
        c=mul(add(b.mn,b.mx),0.5);A=Z;
        snapF=clone(model.faces);snapE=clone(model.edges);vset=vertsOf(ids);moving=rigid?ids:touching(vset);
        ang=a*Math.PI/180;apply();finish();return;
      }
      if(st!==2)return flash('Pick the centre and starting angle first');
      ang=a*Math.PI/180*(ang<0?-1:1);apply();finish();
    },
    busy:()=>st>0,
    cancel(){if(!st)return false;if(snapF){model.faces=snapF;model.edges=snapE;markDirty();}reset();return true;}
  };
  return t;
};

const edgeKey=(a,b)=>{const ka=key(a),kb=key(b);return ka<kb?ka+'|'+kb:kb+'|'+ka;};
// Nearest visible line under the mouse: a face's side or a loose line.
function lineAt(mx,my){
  const ray=screenRay(mx,my),fh=pickFace(ray);
  let best=null,bd=6;
  const tryEdge=(a,b,id)=>{
    const sa=toScreen(a),sb=toScreen(b);if(!sa||!sb)return;
    const d=dSeg2([mx,my],sa,sb);if(d>=bd)return;
    const D=sub(b,a),q=add(a,mul(D,clamp(rayLineClosest(ray.o,ray.d,a,D),0,1))),te=dot(sub(q,ray.o),ray.d);
    if(fh&&fh.t<te*0.995)return;// hidden behind a face
    bd=d;best={a,b,id};
  };
  for(const f of model.faces)if(!f.hidden)for(const L of loops(f))for(let i=0;i<L.length;i++)tryEdge(L[i],L[(i+1)%L.length],null);
  for(const e of model.edges)tryEdge(e.a,e.b,e.id);
  return best;
}
// Remove faces; their sides not shared with any remaining face stay behind as loose lines.
function dropFaces(gone,skipKey){
  model.faces=model.faces.filter(f=>!gone.includes(f));
  const covered=new Set();
  for(const f of model.faces)for(const L of loops(f))for(let i=0;i<L.length;i++)covered.add(edgeKey(L[i],L[(i+1)%L.length]));
  for(const e of model.edges)covered.add(edgeKey(e.a,e.b));
  for(const f of gone)for(const L of loops(f))for(let i=0;i<L.length;i++){
    const a=L[i],b=L[(i+1)%L.length],k=edgeKey(a,b);
    if(k===skipKey||covered.has(k))continue;
    covered.add(k);model.edges.push({id:nid(),a,b,g:f.g});
  }
}
function eraseLine(a,b){
  const k=edgeKey(a,b);
  const hit=model.faces.filter(f=>loops(f).some(L=>L.some((p,i)=>edgeKey(p,L[(i+1)%L.length])===k)));
  // A line between two faces on the same flat surface: erasing it joins them into one face.
  if(!(hit.length===2&&hit[0].g===hit[1].g&&dot(faceNormal(hit[0]),faceNormal(hit[1]))>0.9999&&mergeFaces(hit[0],hit[1])))dropFaces(hit,k);
  model.edges=model.edges.filter(e=>edgeKey(e.a,e.b)!==k);
}
tools.erase=()=>({label:'',hint:'Click a line to erase just that piece (red = what will go). A line between two faces joins them into one. Click inside a face to erase only the face.',
  move(e,m){
    const g=pickGuide(m.x,m.y),l=g?null:lineAt(m.x,m.y);
    preview.lines=l?[[l.a,l.b,[0.9,0.1,0.1]],[add(l.a,[0,0,1e-5]),add(l.b,[0,0,1e-5]),[0.9,0.1,0.1]]]:[];
    const h=g||l?null:pickFace(screenRay(m.x,m.y));setHover(h?h.face:null);
  },
  down(e,m){
    const g=pickGuide(m.x,m.y);
    if(g){pushUndo();model.guides=model.guides.filter(x=>x!==g);selection.delete(g.id);return commitChange();}
    const l=lineAt(m.x,m.y);
    if(l){pushUndo();eraseLine(l.a,l.b);preview.lines=[];setHover(null);return commitChange();}
    const h=pickFace(screenRay(m.x,m.y));if(!h)return;
    pushUndo();dropFaces([h.face]);selection.delete(h.face.id);setHover(null);commitChange();
  }});

// ---- Round or chamfer the edge where two flat faces meet (a fillet). Both faces are trimmed back, a curved
// (or flat) strip fills the gap, and the face at each end of the edge gets the matching rounded corner.
function filletPlan(a,b,r,chamfer){
  const k=edgeKey(a,b);
  const onEdge=f=>{for(const L of loops(f))for(let i=0;i<L.length;i++)if(edgeKey(L[i],L[(i+1)%L.length])===k)return {L,i};return null;};
  const hasEdge=(f,p,q)=>{const kk=edgeKey(p,q);return loops(f).some(L=>L.some((x,i)=>edgeKey(x,L[(i+1)%L.length])===kk));};
  const hit=model.faces.filter(f=>!f.hidden&&onEdge(f));
  if(hit.length!==2||hit[0].g!==hit[1].g)return {err:'Pick a line where two faces meet'};
  const [A,B]=hit,nA=faceNormal(A),nB=faceNormal(B);
  if(A.soft&&B.soft)return {err:'That line is part of a curve that is already round'};
  if(dot(nA,nB)>0.985)return {err:'Those two faces are (nearly) flat to each other: there is no corner to round'};
  // into each face from the edge: faces wind anticlockwise, so the inside is to the left of each side
  const side=(F,n)=>{const {L,i}=onEdge(F);return norm(cross(n,norm(sub(L[(i+1)%L.length],L[i]))));};
  const dA=side(A,nA),dB=side(B,nB),e=norm(sub(b,a));
  const convex=dot(dB,nA)<0,th=Math.acos(clamp(dot(dA,dB),-1,1));
  if(th<0.05||th>Math.PI-0.05)return {err:'That corner is too sharp or too flat to round'};
  // the arc touches each face t from the edge; its centre is r from both faces (inside a corner, outside a dip)
  const t=r/Math.tan(th/2),TA=mul(dA,t),TB=mul(dB,t),C=add(TA,mul(nA,convex?-r:r));
  const vA=sub(TA,C),vB=sub(TB,C),phi=Math.acos(clamp(dot(vA,vB)/(r*r),-1,1));
  const n=chamfer?1:Math.max(2,Math.round(phi/(Math.PI*2)*32));
  const prof=[];
  for(let s=0;s<=n;s++){const u=s/n;prof.push(chamfer?(s?TB:TA):add(C,mul(add(mul(vA,Math.sin((1-u)*phi)),mul(vB,Math.sin(u*phi))),1/Math.sin(phi))));}
  const ends=[];
  for(const [P,other] of [[a,b],[b,a]]){
    const kp=key(P),touch=model.faces.filter(f=>f!==A&&f!==B&&f.g===A.g&&!f.hidden&&loops(f).some(L=>L.some(q=>key(q)===kp)));
    if(touch.length>1||(touch[0]&&touch[0].soft))return {err:'That line ends at a corner that already has a rounded or extra face. Round lines that don\'t meet each other, e.g. the 4 upright corners of a box.'};
    const E=touch[0]||null;let pts=prof.map(o=>add(P,o));
    if(E){// slide the profile along the edge onto the end face, so it fits a sloping end too
      const nE=faceNormal(E),de=dot(e,nE);if(Math.abs(de)<0.2)return {err:'The face at the end of that line is at too steep an angle to round into'};
      pts=pts.map(X=>add(X,mul(e,dot(sub(E.pts[0],X),nE)/de)));
    }
    // the rounding must fit inside the faces beside the edge
    for(const [F,X] of [[A,pts[0]],[B,pts[pts.length-1]]]){
      const L=loops(F).find(L=>L.some(q=>key(q)===kp)),i=L.findIndex(q=>key(q)===kp);
      const nb=[L[(i+L.length-1)%L.length],L[(i+1)%L.length]].find(q=>key(q)!==key(other));
      if(!nb||dist(P,X)>=dist(P,nb)-1e-7)return {err:'Too big: the rounding is wider than the face beside it. Type a smaller size and press Enter.'};
    }
    pts=pts.map(clean);let seq=pts;
    if(E){const L=loops(E).find(L=>L.some(q=>key(q)===kp)),i=L.findIndex(q=>key(q)===kp);if(!hasEdge(A,L[(i+L.length-1)%L.length],P))seq=pts.slice().reverse();}
    ends.push({P,E,pts,seq});
  }
  return {A,B,nA,nB,ends,n};
}
function applyFillet(pl){
  const {A,B,ends,n}=pl,swap=(F,P,seq)=>{for(const L of loops(F)){const i=L.findIndex(q=>key(q)===key(P));if(i>=0){L.splice(i,1,...seq);return;}}};
  for(const {P,E,pts,seq} of ends){swap(A,P,[pts[0]]);swap(B,P,[pts[n]]);if(E)swap(E,P,seq);}
  const [s0,s1]=ends,out=add(pl.nA,pl.nB);
  for(let i=0;i<n;i++){
    const q=[s0.pts[i],s0.pts[i+1],s1.pts[i+1],s1.pts[i]];if(dot(loopNormal(q),out)<0)q.reverse();
    model.faces.push({id:nid(),pts:q,holes:[],color:A.color||null,g:A.g,soft:n>1||undefined});// a curved strip draws without lines between its pieces
  }
}
// ---- Offset: a copy of a face's outline a set distance inside it (splitting the face, e.g. for a rim or
// wall thickness) or outside it (a border around it), as in SketchUp.
function offsetLoop(F,d){// d > 0 inside, d < 0 outside; null if the outline would cross itself
  const n=faceNormal(F),[u,v]=basis(n),o=F.pts[0],P=F.pts.map(p=>to2(p,o,u,v));let N=P.length;
  const nrm=i=>{const a=P[i],b=P[(i+1)%N],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [-dy/l,dx/l];};// left = inside
  const out=[];
  for(let i=0;i<N;i++){
    const n1=nrm((i+N-1)%N),n2=nrm(i),c=1+n1[0]*n2[0]+n1[1]*n2[1];
    if(c<0.05)return null;// a hairpin turn
    out.push([P[i][0]+(n1[0]+n2[0])*d/c,P[i][1]+(n1[1]+n2[1])*d/c]);
  }
  // Offsetting a curve inwards by its radius or more turns its little sides inside out: merge each one
  // that flipped into a single point, so the curve tightens to a corner instead of crossing itself.
  const D=P.map((a,i)=>{const b=P[(i+1)%N];return [b[0]-a[0],b[1]-a[1]];});
  for(let guard=0;guard<4*N&&out.length>3;guard++){
    const n=out.length,k=out.findIndex((a,i)=>{const b=out[(i+1)%n];return (b[0]-a[0])*D[i][0]+(b[1]-a[1])*D[i][1]<=1e-14;});
    if(k<0)break;
    const a=out[k],b=out[(k+1)%n];out[k]=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    out.splice((k+1)%n,1);D.splice(k,1);if((k+1)%n===0)D.push(D.shift());// merged across the start: keep each side's direction with it
  }
  N=out.length;
  for(let i=0;i<N;i++)for(let j=i+2;j<N;j++){if(i===0&&j===N-1)continue;if(segX(out[i],out[(i+1)%N],out[j],out[(j+1)%N]))return null;}
  let A=0;for(let i=0;i<N;i++)A+=out[i][0]*out[(i+1)%N][1]-out[(i+1)%N][0]*out[i][1];
  if(A<=0)return null;// turned inside out: too far in
  return out.map(([x,y])=>clean(add(o,add(mul(u,x),mul(v,y)))));
}
function signedEdgeDist(F,p){// distance from the face's outline, + inside, - outside
  const n=faceNormal(F),[u,v]=basis(n),o=F.pts[0],P=F.pts.map(q=>to2(q,o,u,v)),q=to2(p,o,u,v);
  let m=Infinity;for(let i=0;i<P.length;i++)m=Math.min(m,dSeg2(q,P[i],P[(i+1)%P.length]));
  return pip(q,P)?m:-m;
}
function applyOffset(F,d){
  const L=offsetLoop(F,d);if(!L)return 'That distance makes the outline cross itself. Try a smaller one.';
  const n=faceNormal(F);
  if(d>0){
    if(L.some(p=>!insideFace(F,p,true)))return 'The new outline would cross a hole in the face. Try a smaller distance.';
    const n2=faceNormal(F),[u,v]=basis(n2),o=F.pts[0],L2=L.map(p=>to2(p,o,u,v));
    const inner={id:nid(),pts:L,holes:[],color:F.color||null,g:F.g};
    // holes that end up inside the new outline belong to the new inner face
    F.holes=F.holes.filter(h=>{if(h.every(p=>pip(to2(p,o,u,v),L2))){inner.holes.push(h);return false;}return true;});
    F.holes.push(L.slice().reverse());delete F._tc;model.faces.push(inner);
  }else{
    if(F.g)return 'Offsetting outwards works on loose shapes: ungroup this first.';
    const f=addFace(L,n,F.color);if(f)planarize(n,F.pts[0]);
  }
  return null;
}
tools.offset=()=>{
  let F=null,d=0,cur=null,last=0;
  const reset=()=>{F=null;d=0;endOp();setHint(t.hint);};
  const t={label:'Distance',hint:'Click a face to offset its outline',
    move(e,m){
      if(!F){const h=pickFace(screenRay(m.x,m.y));setHover(h?h.face:null);return;}
      const n=faceNormal(F),q=inferPoint(m.x,m.y,{plane:{p:F.pts[0],n},noAxes:true});if(!q)return;cur=q;setMarker(q);
      d=signedEdgeDist(F,q.p);const L=offsetLoop(F,d),col=L?[0.1,0.1,0.1]:[0.9,0.1,0.1];
      preview.lines=L?L.map((p,i)=>[p,L[(i+1)%L.length],col]):[];
      vcbShow(fmt(Math.abs(d)));setHint(L?(d>0?'Inside':'Outside')+' by '+fmt(Math.abs(d))+' · click to finish, or type a distance and press Enter':'Too far: the outline would cross itself');
    },
    down(e,m){
      if(!F){const h=pickFace(screenRay(m.x,m.y));if(!h)return;F=h.face;setHover(null);setHint('Move the mouse inside or outside the face, then click · or type a distance (- for outside)');return;}
      finish(d);
    },
    vcb(s){
      if(!F)return flash('Click a face first');
      const neg=/^\s*-/.test(s),L=parseLen(s.replace(/^\s*-/,''));if(!(L>0))return flash('Type a distance, e.g. 2 (inside) or -2 (outside)');
      finish(neg?-L:(d<0?-L:L));
    },
    busy:()=>!!F,
    cancel(){const busy=!!F;reset();return busy;}
  };
  function finish(dd){
    if(Math.abs(dd)<1e-6)return;
    const snapF=clone(model.faces),snapE=clone(model.edges);
    const err=applyOffset(F,dd);
    if(err){model.faces=snapF;model.edges=snapE;return flash(err,4500);}
    pushUndo(snapshot(snapF,snapE));commitChange();reset();
  }
  return t;
};

// ---- Follow Me: sweep a face along a path (selected lines, or the outline of one selected face), as in
// SketchUp. Each corner of the path is mitred. The result is a new solid group.
function sweepPath(){
  const E=model.edges.filter(e=>selection.has(e.id)),Fs=model.faces.filter(f=>selection.has(f.id));
  if(!E.length&&Fs.length===1)return {pts:Fs[0].pts.slice(),closed:true,face:Fs[0]};
  if(!E.length)return null;
  const adj=new Map(),pos=new Map();
  for(const e of E)for(const [p,q] of [[e.a,e.b],[e.b,e.a]]){const k=key(p);pos.set(k,p);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(key(q));}
  if([...adj.values()].some(l=>l.length>2))return {err:'The selected lines branch: select one unbroken path'};
  const ends=[...adj.keys()].filter(k=>adj.get(k).length===1),closed=!ends.length;
  let k=closed?adj.keys().next().value:ends[0],prev=null;const keys=[];
  while(k&&!keys.includes(k)){keys.push(k);const nx=adj.get(k).find(x=>x!==prev);prev=k;k=nx;}
  if(keys.length!==adj.size)return {err:'The selected lines are not one connected path'};
  return {pts:keys.map(x=>pos.get(x)),closed};
}
function followMe(prof,path){
  // start where the shape stands: the nearest corner of a closed outline, or the nearer end of an open path
  const cen=mul(prof.pts.reduce((s,p)=>add(s,p),[0,0,0]),1/prof.pts.length);
  let Q=path.pts.slice();const closed=path.closed;
  if(closed){let b=0;Q.forEach((p,i)=>{if(dist(p,cen)<dist(Q[b],cen))b=i;});Q=[...Q.slice(b),...Q.slice(0,b)];}
  else if(dist(Q[Q.length-1],cen)<dist(Q[0],cen))Q.reverse();
  const m=Q.length,segs=closed?m:m-1;
  if(segs<1)return 'The path is too short';
  const dir=i=>norm(sub(Q[(i+1)%m],Q[i]));
  const slide=(P,d,at,n)=>{const k=dot(d,n);if(Math.abs(k)<1e-6)return null;return add(P,mul(d,dot(sub(at,P),n)/k));};
  const miter=j=>{const a=dir((j-1+m)%m),b=dir(j%m),s=add(a,b);return len(s)<1e-6?null:norm(s);};
  let loopsP=loops(prof).map(L=>L.slice());
  if(dot(faceNormal(prof),dir(0))<0)loopsP=loopsP.map(L=>L.slice().reverse());// profile faces along the path
  if(Math.abs(dot(faceNormal(prof),dir(0)))<0.05)return 'The face lies along the path: draw it across the start of the path instead';
  const secs=[];
  let cur=loopsP;
  if(closed){const n0=miter(0);if(!n0)return 'The path doubles back on itself';cur=cur.map(L=>L.map(P=>slide(P,dir(0),Q[0],n0)));}
  secs.push(cur);
  for(let j=1;j<=segs;j++){
    const d=dir(j-1),last=!closed&&j===segs,at=Q[j%m];
    if(closed&&j===segs)break;
    const n=last?d:miter(j);if(!n)return 'The path doubles back on itself';
    cur=cur.map(L=>L.map(P=>slide(P,d,at,n)));
    if(cur.some(L=>L.some(p=>!p)))return 'The path turns too sharply for this face';
    secs.push(cur);
  }
  const g=nid(),col=prof.color||null,faces=[],sec=j=>secs[closed?j%secs.length:j];
  const ring=closed?secs.length:secs.length-1;
  for(let j=0;j<ring;j++){
    const S0=sec(j),S1=sec(j+1);
    S0.forEach((L,li)=>{for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length],c=S1[li][(i+1)%L.length],d=S1[li][i];faces.push({id:nid(),pts:[a,b,c,d].map(clean),holes:[],color:col,g});}});
  }
  if(!closed){
    const s0=secs[0],s1=secs[secs.length-1];
    faces.push({id:nid(),pts:s0[0].slice().reverse().map(clean),holes:s0.slice(1).map(h=>h.slice().reverse().map(clean)),color:col,g});
    faces.push({id:nid(),pts:s1[0].map(clean),holes:s1.slice(1).map(h=>h.map(clean)),color:col,g});
  }
  // a profile with curved sides gives a smooth surface: don't draw lines across it
  const own=new Map(),N=faces.map(faceNormal),lim=Math.cos(32*Math.PI/180);
  faces.forEach((f,i)=>{for(let k=0;k<f.pts.length;k++)own.set(key(f.pts[k])+'>'+key(f.pts[(k+1)%f.pts.length]),i);});
  faces.forEach((f,i)=>{for(let k=0;k<f.pts.length;k++){const j=own.get(key(f.pts[(k+1)%f.pts.length])+'>'+key(f.pts[k]));if(j!==undefined&&dot(N[i],N[j])>lim){f.soft=true;faces[j].soft=true;}}});
  // the profile becomes part of the new solid when it stood on its own
  const shared=new Set();for(const f of model.faces)if(f!==prof)for(const L of loops(f))for(let i=0;i<L.length;i++)shared.add(edgeKey(L[i],L[(i+1)%L.length]));
  if(!loops(prof).some(L=>L.some((p,i)=>shared.has(edgeKey(p,L[(i+1)%L.length])))))model.faces=model.faces.filter(f=>f!==prof);
  model.faces.push(...faces);
  return null;
}
// All loose lines joined end-to-end with this one (stops where the path branches), so one click picks the whole path.
function edgeChain(e0){
  const deg=new Map();for(const e of model.edges)for(const p of [e.a,e.b]){const k=key(p);deg.set(k,(deg.get(k)||0)+1);}
  const out=new Set([e0.id]),todo=[e0.a,e0.b];
  while(todo.length){const p=todo.pop(),k=key(p);if(deg.get(k)!==2)continue;
    for(const e of model.edges)if(!out.has(e.id)&&(key(e.a)===k||key(e.b)===k)){out.add(e.id);todo.push(key(e.a)===k?e.b:e.a);}}
  return out;
}
tools.follow=()=>{
  let prof=null;
  const hint=()=>{const p=sweepPath();if(p&&!p.err)return 'Click the shape (face) you want to sweep along the selected path';if(p&&p.err)return p.err;
    return prof?'Now click the line it should follow (the whole joined-up path is used)':'Click the shape (face) you want to sweep';};
  const run=(face,path)=>{
    const snapF=clone(model.faces);const err=followMe(face,path);
    if(err){model.faces=snapF;return flash(err,5000);}
    pushUndo(snapshot(snapF,model.edges));selection.clear();setHover(null);prof=null;preview.lines=[];commitChange();setHint(hint());
    flash('Swept along the path: the result is a group (Ungroup to join it to other shapes)',4500);
  };
  const t={label:'',hint:hint(),
    move(e,m){
      // Show in orange the whole joined-up path a click here would follow.
      const ed=(prof||!(sweepPath()&&!sweepPath().err))?pickEdge(m.x,m.y):null;
      preview.lines=ed?model.edges.filter(x=>edgeChain(ed).has(x.id)).map(x=>[x.a,x.b,[1,0.45,0]]):[];
      if(prof){setHover(prof);setHint(ed?'Click to follow this line and the lines joined to it':hint());return;}
      if(ed){setHover(null);return setHint('Click to pick this path (the line and the lines joined to it), then click the shape');}
      const h=pickFace(screenRay(m.x,m.y));setHover(h&&!selection.has(h.face.id)?h.face:null);setHint(hint());},
    down(e,m){
      const path=sweepPath();
      if(path&&!path.err&&!prof){const h=pickFace(screenRay(m.x,m.y));if(!h)return flash(hint());
        if(selection.has(h.face.id))return flash('That face is the path. Click the face (the shape) to sweep along it.');return run(h.face,path);}
      if(!prof){const ed=pickEdge(m.x,m.y);if(ed){selection.clear();for(const id of edgeChain(ed))selection.add(id);requestDraw();return setHint(hint());}
        const h=pickFace(screenRay(m.x,m.y));if(!h)return flash(hint());prof=h.face;setHover(prof);return setHint(hint());}
      const ed=pickEdge(m.x,m.y);if(!ed)return flash('Click on the line (path) itself: hover until the hint says "Click to follow this line"');
      selection.clear();for(const id of edgeChain(ed))selection.add(id);
      const p2=sweepPath();if(!p2||p2.err){selection.clear();return flash(p2?p2.err:hint(),5000);}
      run(prof,p2);
    },
    busy:()=>!!prof,
    cancel(){const b=!!prof;prof=null;preview.lines=[];setHover(null);setHint(hint());return b;}
  };
  return t;
};
// Round every edge and corner of a box-like (convex) solid at once: shrink it inwards by the radius, then
// wrap balls of that radius round the shrunk shape's corners (a hull). Flat faces keep their place and size.
async function roundAllEdges(face,r){
  const ids=componentOf(face.id),F=model.faces.filter(f=>ids.has(f.id));
  const cnt=new Map();
  for(const f of F)for(const L of loops(f))for(let i=0;i<L.length;i++){const k=edgeKey(L[i],L[(i+1)%L.length]);cnt.set(k,(cnt.get(k)||0)+1);}
  if([...cnt.values()].some(c=>c!==2))return 'Rounding every edge needs a closed solid: Check Model shows any gaps.';
  const planes=[];
  for(const f of F){const n=faceNormal(f),d=dot(n,f.pts[0]);if(!planes.some(p=>dot(p.n,n)>0.99999&&Math.abs(p.d-d)<1e-7))planes.push({n,d});}
  const V=F.flatMap(f=>loops(f).flat());
  if(planes.some(p=>V.some(v=>dot(p.n,v)>p.d+1e-7)))return 'Rounding every edge works on box-like shapes without dents, steps or holes. For other shapes, round the lines one at a time.';
  if(!window.WFEnclosure)return 'The rounding engine is not available.';
  const w=await WFEnclosure.engine(),M=w.Manifold,pool=[],K=m=>{pool.push(m);return m;},S=1000;// work in mm
  try{
    const mn=[0,1,2].map(i=>Math.min(...V.map(v=>v[i]))*S-1),mx=[0,1,2].map(i=>Math.max(...V.map(v=>v[i]))*S+1);
    let inner=K(M.cube([mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]]).translate(mn));
    for(const p of planes)inner=K(inner.trimByPlane([-p.n[0],-p.n[1],-p.n[2]],-(p.d-r)*S));
    const g=inner.getMesh(),c=[];
    for(let i=0;i<g.vertProperties.length;i+=g.numProp)c.push([g.vertProperties[i],g.vertProperties[i+1],g.vertProperties[i+2]]);
    if(c.length<4||inner.volume()<1e-6)return 'Too big: the rounding is more than half the thickness of the shape. Type a smaller size and press Enter.';
    const solid=K(M.hull(c.map(v=>K(K(M.sphere(r*S,32)).translate(v)))));
    const out=solid.getMesh(),P=[];
    for(let i=0;i<out.vertProperties.length;i+=out.numProp)P.push([out.vertProperties[i]/S,out.vertProperties[i+1]/S,out.vertProperties[i+2]/S]);
    const tris=[];for(let i=0;i<out.triVerts.length;i+=3)tris.push([P[out.triVerts[i]],P[out.triVerts[i+1]],P[out.triVerts[i+2]]]);
    const nf=facesFromTriangles(tris);
    for(const f of nf){
      f.color=face.color||null;if(face.g)f.g=face.g;
      const n=faceNormal(f);// the curved pieces draw smooth, the original flat faces keep their outlines
      if(!planes.some(p=>dot(p.n,n)>0.9999&&Math.abs(dot(p.n,f.pts[0])-p.d)<1e-6))f.soft=true;
    }
    model.faces=model.faces.filter(f=>!ids.has(f.id)).concat(nf);
    for(const id of ids)selection.delete(id);
    return null;
  }finally{for(const m of pool)try{m.delete();}catch(e){/* intentional: freeing engine memory */}}
}
// ---- Slice: cut a solid in two with a flat plane. Each half is closed with a flat face where it was cut
// and becomes its own group, so it can be moved, deleted or exported on its own.
const SLICE_AX={x:[1,0,0],y:[0,1,0],z:[0,0,1]};
async function sliceSolid(ids,n,d){// cut plane: dot(n,p)=d (metres)
  const F=model.faces.filter(f=>ids.has(f.id)),m=buildMesh(false,F);
  if(m.open)return 'That shape is not a closed solid, so it can\'t be sliced: Check Model shows the gaps.';
  const w=await WFEnclosure.engine(),M=w.Manifold,pool=[],K=x=>{pool.push(x);return x;},S=1000;
  try{
    const mesh=new w.Mesh({numProp:3,vertProperties:new Float32Array(m.verts.flatMap(p=>[p[0]*S,p[1]*S,p[2]*S])),triVerts:new Uint32Array(m.tris.flat())});
    mesh.merge();
    const solid=K(new M(mesh));
    if(solid.status&&solid.status()!=='NoError'&&solid.status()!==0)return 'That shape could not be read as a solid ('+solid.status()+').';
    const [a,b]=solid.splitByPlane(n,d*S);K(a);K(b);
    if(a.isEmpty()||b.isEmpty())return 'The cut misses the shape: move it so the red plane goes through it.';
    // flat faces keep their outlines (the original flat faces and the new cut face); curved ones stay smooth
    const hard=F.filter(f=>!f.soft).map(f=>{const nn=faceNormal(f);return {n:nn,d:dot(nn,f.pts[0])};});
    hard.push({n,d},{n:mul(n,-1),d:-d});
    const col=F[0].color||null,out=[];
    for(const part of [a,b]){
      const g=part.getMesh(),P=[];for(let i=0;i<g.vertProperties.length;i+=g.numProp)P.push([g.vertProperties[i]/S,g.vertProperties[i+1]/S,g.vertProperties[i+2]/S]);
      const tris=[];for(let i=0;i<g.triVerts.length;i+=3)tris.push([P[g.triVerts[i]],P[g.triVerts[i+1]],P[g.triVerts[i+2]]]);
      const nf=facesFromTriangles(tris),gid=nid();
      for(const f of nf){f.color=col;f.g=gid;const nn=faceNormal(f);if(!hard.some(h=>dot(h.n,nn)>0.9999&&Math.abs(dot(h.n,f.pts[0])-h.d)<1e-6))f.soft=true;}
      out.push(...nf);
    }
    model.faces=model.faces.filter(f=>!ids.has(f.id)).concat(out);
    for(const id of ids)selection.delete(id);
    return null;
  }finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
}
tools.slice=()=>{
  let ids=null,pl=null,box=null;
  const axis=()=>lockAxis||'z';
  const hint='Hover a solid: the red plane shows the cut · click to cut it in two · arrow keys turn the plane: ↑ flat (cuts across blue), → across red, ← across green · type a distance from the bottom (or left/front) and Enter for an exact cut';
  const boxOf=ids=>{const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(const f of model.faces)if(ids.has(f.id))for(const p of f.pts)for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}return {mn,mx};};
  const show=()=>{
    if(!pl){preview.lines=[];return;}
    const i='xyz'.indexOf(axis()),j=(i+1)%3,k=(i+2)%3,pad=0.15,col=[0.9,0.1,0.1];
    const lo=[...box.mn],hi=[...box.mx];for(const q of [j,k]){const e=(hi[q]-lo[q])*pad+0.001;lo[q]-=e;hi[q]+=e;}
    const P=(a,b)=>{const p=[0,0,0];p[i]=pl.d;p[j]=a;p[k]=b;return p;};
    const c=[P(lo[j],lo[k]),P(hi[j],lo[k]),P(hi[j],hi[k]),P(lo[j],hi[k])];
    preview.lines=c.map((p,q)=>[p,c[(q+1)%4],col]);preview.lines.push([c[0],c[2],col],[c[1],c[3],col]);
    vcbShow(fmt(pl.d-box.mn[i]));
  };
  async function cut(){
    if(!ids||!pl)return;
    const snapF=clone(model.faces),i='xyz'.indexOf(axis());
    if(pl.d<=box.mn[i]+1e-6||pl.d>=box.mx[i]-1e-6)return flash('The cut misses the shape: move the red plane so it goes through it');
    flash('Slicing…',6000);
    try{
      const err=await sliceSolid(ids,SLICE_AX[axis()],pl.d);
      if(err){model.faces=snapF;markDirty();return flash(err,6000);}
      pushUndo(snapshot(snapF,model.edges));ids=null;pl=null;preview.lines=[];setHover(null);commitChange();
      flash('Cut in two: each half is now its own group. Move it (M), or click it with Select and press Delete.',6000);
    }catch(er){console.error('EvenUCan: slice failed',er);model.faces=snapF;markDirty();flash('Could not slice that shape: '+er.message,6000);}
  }
  const t={label:'Distance',hint,
    move(e,m){
      const h=pickFace(screenRay(m.x,m.y));
      if(!h){ids=null;pl=null;setHover(null);preview.lines=[];return;}
      ids=componentOf(h.face.id);box=boxOf(ids);setHover(h.face);
      const i='xyz'.indexOf(axis()),cp=inferPoint(m.x,m.y),p=cp&&cp.face?cp.p:h.p;
      pl={d:p[i]};show();
    },
    down(e,m){if(!ids)return flash('Click on a solid to slice it');cut();},
    vcb(s){
      if(!ids)return flash('Hover the shape first, then type the distance');
      const L=parseLen(s);if(!(L>0))return flash('Type a distance, e.g. 10');
      const i='xyz'.indexOf(axis());pl={d:box.mn[i]+L};show();cut();
    },
    cancel(){const busy=!!pl;ids=null;pl=null;preview.lines=[];setHover(null);return busy;}
  };
  return t;
};
let roundSize=0.002,roundChamfer=false;// remembered between uses (2 mm, rounded)
// Round every edge of the shape this face belongs to, as one undo step.
function roundAllOn(face){
  const snapF=clone(model.faces);flash('Rounding every edge…',8000);
  roundAllEdges(face,roundSize).then(err=>{
    if(err){model.faces=snapF;markDirty();return flash(err,6000);}
    pushUndo(snapshot(snapF,model.edges),'Round every edge');setHover(null);commitChange();flash('Every edge rounded ('+fmt(roundSize)+')');
  }).catch(er=>{console.error('EvenUCan: round/chamfer failed',er);model.faces=snapF;markDirty();flash('Could not round that shape: '+er.message,6000);});
}
tools.round=()=>{
  let plan=null;
  const hint=()=>'Click a line where two faces meet to '+(roundChamfer?'chamfer':'round')+' it ('+fmt(roundSize)+') · Shift+click a box to round EVERY edge and corner · type a size and Enter: 3 = rounded, 3c = chamfer · Ctrl+click: the other kind once';
  const t={label:'Size',hint:hint(),
    move(e,m){
      const l=lineAt(m.x,m.y);plan=null;preview.lines=[];
      if(!l||l.id)return setHint(hint());
      plan=filletPlan(l.a,l.b,roundSize,roundChamfer!==(e.ctrlKey||e.metaKey));
      if(plan.err){preview.lines=[[l.a,l.b,[0.9,0.1,0.1]]];setHint(plan.err);plan=null;return;}
      const col=[0.1,0.33,0.95],[s0,s1]=plan.ends;
      for(const s of [s0,s1])for(let i=0;i<s.pts.length-1;i++)preview.lines.push([s.pts[i],s.pts[i+1],col]);
      preview.lines.push([s0.pts[0],s1.pts[0],col],[s0.pts[plan.n],s1.pts[plan.n],col]);
      setHint(hint());
    },
    down(e,m){
      if(e.shiftKey){// every edge of the shape at once
        const h=pickFace(screenRay(m.x,m.y));if(!h)return flash('Shift+click a face of the shape to round all its edges');
        preview.lines=[];return roundAllOn(h.face);
      }
      const l=lineAt(m.x,m.y);if(!l)return;
      if(l.id)return flash('That is a loose line: round a line where two faces meet');
      const pl=filletPlan(l.a,l.b,roundSize,roundChamfer!==(e.ctrlKey||e.metaKey));
      if(pl.err)return flash(pl.err,5000);
      pushUndo();applyFillet(pl);preview.lines=[];commitChange();
    },
    vcb(s){
      const m=s.match(/^(.*?)\s*([cr])$/i);// "3c" = 3 mm chamfer, "3r" = 3 mm rounded
      if(m){roundChamfer=m[2].toLowerCase()==='c';s=m[1];if(!s)return setHint(hint());}
      const L=parseLen(s);if(!(L>0))return flash('Type a size, e.g. 3 (rounded) or 3c (straight chamfer)');
      roundSize=L;vcbShow(fmt(L));setHint(hint());flash((roundChamfer?'Chamfer':'Rounding')+' size: '+fmt(L));
    }
  };
  return t;
};

const COLORS=[['White','#f2f0ea'],['Light grey','#c9c9c9'],['Concrete','#a3a29b'],['Charcoal','#4a4a4a'],['Brick','#a8513a'],['Terracotta','#c9744a'],['Sand','#e3d1a5'],['Oak','#c8a27a'],['Walnut','#6e4b32'],['Grass','#6f9a46'],['Leaf','#3f7a3a'],['Water','#4a90c8'],['Glass','#a9d3e8'],['Slate roof','#5a6470'],['Yellow','#e8c33a'],['Red','#c8372d']];
function buildPalette(){
  const p=$('palette');p.innerHTML='';
  for(const [n,c] of COLORS){const s=document.createElement('span');s.className='sw'+(c===curColor?' on':'');s.style.background=c;s.title=n;s.onclick=()=>{curColor=c;buildPalette();};p.appendChild(s);}
  const lab=document.createElement('div');lab.className='name';lab.textContent='Custom colour:';p.appendChild(lab);
  const inp=document.createElement('input');inp.type='color';inp.value=curColor;inp.oninput=()=>{curColor=inp.value;};p.appendChild(inp);
  const tip=document.createElement('div');tip.className='name';tip.textContent='Alt+click a face to pick up its colour.';p.appendChild(tip);
}
tools.paint=()=>({label:'',hint:'Click a face to paint it (paints the whole selection if the face is selected) · Alt+click to sample a colour',
  move(e,m){const h=pickFace(screenRay(m.x,m.y));setHover(h?h.face:null);},
  down(e,m){
    const h=pickFace(screenRay(m.x,m.y));if(!h)return;
    if(e.altKey){curColor=h.face.color||'#f2f0ea';buildPalette();return;}
    pushUndo();const targets=selection.has(h.face.id)?selection:new Set([h.face.id]);
    for(const f of model.faces)if(targets.has(f.id))f.color=curColor;
    commitChange();
  }});

// Tape Measure, as in SketchUp: measures, and leaves a guide point where you finish (or at a typed distance)
// for other tools to snap to. Ctrl+click measures without leaving a point.
tools.tape=()=>{
  let a=null,cur=null,fixed=null;
  const hint='Click two points to measure: a guide point is left at the second (Ctrl+click: just measure) · after the first click, type a distance to place a guide point that far along';
  const place=p=>{pushUndo();model.guides.push({id:nid(),p:clean(p)});commitChange();};
  const t={label:'Length',hint,
    move(e,m){
      cur=inferPoint(m.x,m.y,{base:a});setMarker(cur);
      if(a&&cur){preview.lines=[[a,cur.p,axisColor(cur)],...crossLines(cur.p,cam.dist*0.006,GUIDE_COL)];vcbShow(fmt(dist(a,cur.p)));}
      else preview.lines=fixed?[[fixed[0],fixed[1],[0.8,0.2,0.2]]]:[];
    },
    down(e,m){
      if(!cur)return;
      if(!a){a=cur.p;fixed=null;setHint('Click the end point, or type a distance and press Enter (the mouse sets the direction; arrow keys lock it)');return;}
      fixed=[a,cur.p];const d=dist(a,cur.p),keep=!(e.ctrlKey||e.metaKey)&&d>1e-9;
      if(keep)place(cur.p);
      a=null;vcbShow(fmt(d));flash('Distance: '+fmt(d)+(keep?' · guide point left there':''));setHint(hint);
    },
    vcb(s){
      if(!a||!cur)return flash('Click the starting point first, then type the distance');
      const L=parseLen(s);if(!(L>0))return flash('Type a distance, e.g. 40');
      const D=sub(cur.p,a);if(len(D)<1e-9)return flash('Point the mouse the way you want to measure first');
      const p=add(a,mul(norm(D),L));place(p);fixed=[a,p];a=null;
      flash('Guide point placed '+fmt(L)+' from the start');setHint(hint);
    },
    busy:()=>!!a,
    cancel(){const busy=!!(a||fixed);a=null;fixed=null;endOp();setHint(hint);return busy;}
  };
  return t;
};
function deleteGuides(){
  const n=model.guides.length;if(!n)return flash('There are no guide points');
  pushUndo(null,'Delete guides');for(const g of model.guides)selection.delete(g.id);model.guides=[];commitChange();
  flash(n+' guide point'+(n>1?'s':'')+' deleted');
}
const GUIDE_COL=[0.95,0.4,0.0];
function crossLines(p,s,col){return [[sub(p,[s,0,0]),add(p,[s,0,0]),col],[sub(p,[0,s,0]),add(p,[0,s,0]),col],[sub(p,[0,0,s]),add(p,[0,0,s]),col]];}
tools.center=()=>{
  let a=null,cur=null;
  const t={label:'Distance',hint:'Click one point (e.g. a corner), then another: a centre point is placed halfway and stays as a snap point',
    move(e,m){
      cur=inferPoint(m.x,m.y,{base:a});setMarker(cur);preview.lines=[];
      if(a&&cur){
        const mid=mul(add(a,cur.p),0.5);
        preview.lines=[[a,cur.p,axisColor(cur)],...crossLines(mid,Math.max(dist(a,cur.p)*0.06,cam.dist*0.006),GUIDE_COL)];
        vcbShow(fmt(dist(a,cur.p)));
      }
    },
    down(e,m){
      if(!cur)return;
      if(!a){a=cur.p;setHint('Click the second point · the centre is shown in orange');return;}
      if(dist(a,cur.p)<1e-9)return;
      const mid=clean(mul(add(a,cur.p),0.5));
      pushUndo();model.guides.push({id:nid(),p:mid});commitChange();
      flash('Centre point placed ('+fmt(dist(a,cur.p)/2)+' from each point). Other tools snap to it.',4000);
      a=null;endOp();setHint(t.hint);
    },
    busy:()=>!!a,
    cancel(){const busy=!!a;a=null;endOp();setHint(t.hint);return busy;}
  };
  return t;
};
const navTool=(n,h)=>()=>({label:'',hint:h,nav:n});
tools.orbit=navTool('orbit','Drag to orbit · tip: right-drag orbits with any tool, middle-drag pans, scroll wheel zooms toward the mouse');
tools.pan=navTool('pan','Drag to pan the view');
tools.zoom=navTool('zoom','Drag up/down to zoom · scroll wheel zooms toward the cursor');

function setTool(name){
  if(tool.cancel)tool.cancel();
  endOp();setHover(null);
  toolName=name;tool=tools[name]();
  document.querySelectorAll('#toolbar button[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===name));
  if(window.EvenUCanRibbonRefresh)window.EvenUCanRibbonRefresh();
  $('vcbLabel').textContent=tool.label||'';vcbEl.value='';
  setHint(tool.hint);
  $('palette').style.display=name==='paint'?'block':'none';
  if(name!=='solid')$('shapes').style.display='none';
  const tp=document.getElementById('textPanel');if(tp&&name!=='text')tp.style.display='none';
  const hp=document.getElementById('holePanel');if(hp&&name!=='hole')hp.style.display='none';
  const sp=document.getElementById('standoffPanel');if(sp&&name!=='standoff')sp.style.display='none';
  const bp=document.getElementById('boardPanel');if(bp&&name!=='boardmount')bp.style.display='none';
  cv.style.cursor=tool.nav?(tool.nav==='orbit'||tool.nav==='pan'?'grab':'ns-resize'):(name==='select'?'default':'crosshair');
}
function cancelOp(){
  const busy=tool.cancel?tool.cancel():false;
  if(!busy&&selection.size){selection.clear();selChanged();}
  endOp();
}
function selectAll(){for(const f of model.faces)if(!f.hidden)selection.add(f.id);for(const x of model.edges)selection.add(x.id);selChanged();}
function deleteSelection(){
  if(!selection.size)return;
  pushUndo(null,'Delete');
  model.faces=model.faces.filter(f=>!selection.has(f.id));model.edges=model.edges.filter(e=>!selection.has(e.id));model.guides=model.guides.filter(g=>!selection.has(g.id));
  selection.clear();commitChange();
}

