// EvenUCan 3D drawing app - 15-solid-ops-text-shell.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- Solid operations through the Manifold engine (in mm): our faces -> a solid, and a solid -> our faces.
const solidOf=function solidOf(w,K,F){
  const m=buildMesh(false,F),S=1000;if(m.open)return null;
  const mesh=new w.Mesh({numProp:3,vertProperties:new Float32Array(m.verts.flatMap(p=>[p[0]*S,p[1]*S,p[2]*S])),triVerts:new Uint32Array(m.tris.flat())});
  mesh.merge();const s=K(new w.Manifold(mesh));
  if(s.status&&s.status()!=='NoError'&&s.status()!==0)throw new Error('a shape could not be read as a solid ('+s.status()+')');
  return s;
};
// flat: [{n,d,color}] planes whose faces keep their outlines (and colour); anything else is a curved part, drawn smooth.
const facesOfSolid=function facesOfSolid(s,flat,col,gid){
  const g=s.getMesh(),P=[],S=1000;for(let i=0;i<g.vertProperties.length;i+=g.numProp)P.push([g.vertProperties[i]/S,g.vertProperties[i+1]/S,g.vertProperties[i+2]/S]);
  const tris=[];for(let i=0;i<g.triVerts.length;i+=3)tris.push([P[g.triVerts[i]],P[g.triVerts[i+1]],P[g.triVerts[i+2]]]);
  const nf=facesFromTriangles(tris);
  for(const f of nf){
    if(gid)f.g=gid;const n=faceNormal(f),h=flat.find(h=>dot(h.n,n)>0.9999&&Math.abs(dot(h.n,f.pts[0])-h.d)<1e-6);
    f.color=h&&h.color!==undefined?h.color:col;if(!h)f.soft=true;
  }
  return nf;
};
const flatPlanes=(F,color)=>F.filter(f=>!f.soft).map(f=>{const n=faceNormal(f);return {n,d:dot(n,f.pts[0]),color:color===undefined?f.color||null:color};});
// The objects picked, in the order they were picked (the first one is kept by Subtract).
const pickedSolids=function pickedSolids(){
  const ids=expandGroups(new Set(selection)),solids=[],seen=new Set();
  for(const id of ids){const f=model.faces.find(x=>x.id===id);if(!f||f.hidden||seen.has(id))continue;const c=componentOf(id);for(const x of c)seen.add(x);solids.push(c);}
  return solids;
};
// Join (add), Subtract (the first object picked, minus the others) or Intersect (only where they all overlap).
const BOOL={add:{verb:'join',ing:'Joining',name:'Join',key:'U'},subtract:{verb:'subtract',ing:'Subtracting',name:'Subtract',key:'S'},intersect:{verb:'intersect',ing:'Intersecting',name:'Intersect',key:''}};
const booleanSelected=async function booleanSelected(op){
  const B=BOOL[op],solids=pickedSolids();
  if(solids.length<2)return flash(op==='subtract'?'Subtract: click the object to keep, then Shift+click the shape(s) to cut out of it, then press S':
    'Select two or more objects to '+B.verb+': click the first, Shift+click the others (any face of each), then '+(B.key?'press '+B.key:'click '+B.name),6000);
  if(!window.WFEnclosure)return flash('The solid engine is not available');
  const snapF=cloneCad(model.faces);flash(B.ing+'…',8000);
  const w=await WFEnclosure.engine(),pool=[],K=x=>{pool.push(x);return x;};
  try{
    const FS=solids.map(c=>model.faces.filter(f=>c.has(f.id))),parts=FS.map(F=>solidOf(w,K,F));
    if(parts.some(p=>!p)){model.faces=snapF;return flash('Only closed solids can be used: Check Model shows where one has gaps',5000);}
    let u=parts[0];
    for(const p of parts.slice(1))u=K(op==='add'?u.add(p):op==='subtract'?u.subtract(p):u.intersect(p));
    if(u.isEmpty())return flash(op==='intersect'?'Those shapes don\'t overlap, so nothing is left: nothing was changed':'Nothing would be left: nothing was changed',5000);
    const col=(FS[0].find(f=>f.color)||{}).color||null;
    // Join keeps every part's colours; Subtract and Intersect colour the result like the first object.
    const flat=op==='add'?FS.flatMap(F=>flatPlanes(F)):[...flatPlanes(FS[0]),...FS.slice(1).flatMap(F=>flatPlanes(F,col))];
    const nf=facesOfSolid(u,flat,col,nid()),all=new Set(solids.flatMap(c=>[...c]));
    model.faces=model.faces.filter(f=>!all.has(f.id)).concat(nf);
    pushUndo(snapshot(snapF,model.edges),B.name);selection=new Set(nf.map(f=>f.id));selChanged();commitChange();
    const pieces=u.decompose?(()=>{const a=u.decompose();for(const x of a)K(x);return a.length;})():1;
    if(op==='add')flash(pieces>1?'Joined into one object. They don\'t touch, so they stay apart, but now select and move as one':'Joined '+solids.length+' objects into one solid',5000);
    else if(op==='subtract')flash('Cut '+(solids.length-1)+' shape'+(solids.length>2?'s':'')+' out of the first one'+(pieces>1?' (it is now in '+pieces+' pieces, still one object)':''),5000);
    else flash('Kept only where they overlap'+(pieces>1?' ('+pieces+' pieces, one object)':''),5000);
  }catch(er){console.error('EvenUCan: '+B.verb+' failed',er);model.faces=snapF;markDirtyCad();flash('Could not '+B.verb+' those: '+er.message,6000);}
  finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
};
const joinSelected=()=>booleanSelected('add'),subtractSelected=()=>booleanSelected('subtract'),intersectSelected=()=>booleanSelected('intersect');
// Whole objects in the selection (picking one face of a shape takes all of it), plus any selected loose lines.
const pickedIds=function pickedIds(){
  const ids=expandGroups(new Set(selection)),out=new Set();
  for(const id of ids){if(out.has(id))continue;const f=model.faces.find(x=>x.id===id);if(f){if(!f.hidden)for(const x of componentOf(id))out.add(x);}else out.add(id);}
  return out;
};
// Flip the selected objects in place along an axis (0 red, 1 green, 2 blue), or add a mirrored copy touching them.
const flipSelected=function flipSelected(i,copy){
  const ids=pickedIds();if(!ids.size)return flash('Select what you want to '+(copy?'mirror':'flip')+' first (click any face of it)');
  const b=bounds(ids),at=copy?b.mx[i]:(b.mn[i]+b.mx[i])/2,fn=p=>{const q=p.slice();q[i]=2*at-p[i];return q;};
  const rev=f=>{f.pts.reverse();f.holes.forEach(h=>h.reverse());delete f._tc;};// a mirror turns faces inside out: turn them back
  pushUndo(null,copy?'Mirror copy':'Flip');
  if(copy){
    const before=new Set([...model.faces,...model.edges].map(x=>x.id)),gid=nid();
    copyEntities(model.faces,model.edges,ids,fn);
    const added=[...model.faces,...model.edges].filter(x=>!before.has(x.id));
    for(const x of added){x.g=gid;if(x.pts)rev(x);}// the copy is its own object, so it doesn't fuse with the original
    selection=new Set([...ids,...added.map(x=>x.id)]);selChanged();commitChange();
    flash('Mirrored copy added beside it. Both are selected: press U to join them into one solid',6000);
  }else{
    xformIds(ids,fn);for(const f of model.faces)if(ids.has(f.id))rev(f);
    commitChange();flash(['Flipped left ↔ right','Flipped front ↔ back','Turned upside down'][i]);
  }
};
// A small pop-up menu (the right-click menu's look): items are [label, key, enabled, action] or null for a line.
const showMenu=function showMenu(items,x,y){
  ctxEl.innerHTML='';
  for(const it of items){
    const d=document.createElement('div');
    if(!it){d.className='sep';ctxEl.appendChild(d);continue;}
    const [label,key,on,fn]=it;d.className='it'+(on?'':' off');
    d.innerHTML='<span></span>'+(key?'<kbd></kbd>':'');d.firstChild.textContent=label;if(key)d.lastChild.textContent=key;
    if(on)d.onclick=()=>{closeCtx();fn();requestDraw();};
    ctxEl.appendChild(d);
  }
  ctxEl.style.display='block';
  const w=ctxEl.offsetWidth,hh=ctxEl.offsetHeight;
  ctxEl.style.left=Math.max(4,Math.min(x,innerWidth-w-4))+'px';ctxEl.style.top=Math.max(4,Math.min(y,innerHeight-hh-4))+'px';
};
const flipMenu=function flipMenu(x,y){
  const n=selection.size>0;
  showMenu([['Flip left ↔ right (along red)','',n,()=>flipSelected(0,false)],['Flip front ↔ back (along green)','',n,()=>flipSelected(1,false)],['Turn upside down (along blue)','',n,()=>flipSelected(2,false)],null,
    ['Mirror copy to the right','',n,()=>flipSelected(0,true)],['Mirror copy to the back','',n,()=>flipSelected(1,true)],['Mirror copy on top','',n,()=>flipSelected(2,true)]],x,y);
  if(!n)flash('Select what you want to flip or mirror first (click any face of it)');
};
// Lay flat: turn the object so the clicked face sits flat on the bed, face down (the way you'd print it).
const layFlat=function layFlat(face){
  const ids=componentOf(face.id),n=faceNormal(face),down=[0,0,-1],cs=dot(n,down);
  pushUndo(null,'Lay flat');
  if(cs<0.999999){
    let ax=cross(n,down);ax=len(ax)<1e-9?X:norm(ax);
    const b=bounds(ids),c=mul(add(b.mn,b.mx),0.5),ang=Math.acos(clamp(cs,-1,1));
    xformIds(ids,p=>rotateAbout(p,c,ax,ang));
  }
  const b=bounds(ids);xformIds(ids,p=>[p[0],p[1],p[2]-b.mn[2]]);
  commitChange();flash('Laid flat on that face, on the bed');
};
// Every separate piece (each group, and each set of connected loose faces) in one go: for each, picks its
// own largest face (the one most likely to print stably) and lays it flat on the bed, the same way Lay
// Flat does for one piece at a time.
const layAllFlat=function layAllFlat(){
  const seen=new Set(),pieces=[];
  for(const f of model.faces){
    if(seen.has(f.id))continue;
    const ids=componentOf(f.id);for(const id of ids)seen.add(id);pieces.push(ids);
  }
  if(!pieces.length)return flash('Nothing to lay flat');
  pushUndo(null,'Lay all flat');
  for(const ids of pieces){
    // The largest face, not just any face tied for largest: a flange's top and bottom are the same size, so
    // among faces within 1% of the biggest area, prefer whichever one is already closest to facing down -
    // for a flat disc that's the one already resting correctly, not its mirror-image top.
    let cands=[],bestMag=0;
    for(const f of model.faces){
      if(!ids.has(f.id))continue;
      // Sum over the outer loop AND every hole (holes are wound the opposite way round, so this
      // naturally nets out to outer-area-minus-holes - skipping the holes would count a face with a
      // hole punched through it, e.g. a cap with the shaft's hole in it, as if it were still solid).
      const n=[0,0,0];
      for(const P of [f.pts,...(f.holes||[])])
        for(let i=0;i<P.length;i++){const a=P[i],b2=P[(i+1)%P.length];n[0]+=(a[1]-b2[1])*(a[2]+b2[2]);n[1]+=(a[2]-b2[2])*(a[0]+b2[0]);n[2]+=(a[0]-b2[0])*(a[1]+b2[1]);}
      const mag=len(n);if(mag<1e-15)continue;
      if(mag>bestMag*1.01){bestMag=mag;cands=[f];}
      else if(mag>bestMag*0.99)cands.push(f);
    }
    let best=null,bestDown=-2;
    for(const f of cands){const d=dot(faceNormal(f),[0,0,-1]);if(d>bestDown){bestDown=d;best=f;}}
    if(!best)continue;
    const n=faceNormal(best),down=[0,0,-1],cs=dot(n,down);
    if(cs<0.999999){
      let ax=cross(n,down);ax=len(ax)<1e-9?X:norm(ax);
      const b=bounds(ids),c=mul(add(b.mn,b.mx),0.5),ang=Math.acos(clamp(cs,-1,1));
      xformIds(ids,p=>rotateAbout(p,c,ax,ang));
    }
    const b2=bounds(ids);xformIds(ids,p=>[p[0],p[1],p[2]-b2.mn[2]]);
  }
  commitChange();setGhosts([]);flash('Laid '+pieces.length+' piece'+(pieces.length>1?'s':'')+' flat on the bed');
};
// Repacks every separate piece side by side on the bed, left to right then wrapping to a new row, so
// nothing overlaps - handy after Generate drops several printable pieces (base, lid, plugs, rivets) in
// one go. Only moves pieces sideways (X/Y): each piece's own height off the bed is left alone.
const arrangeOnBed=function arrangeOnBed(opts){
  const quiet=opts===true||(opts&&opts.quiet);
  const keepGhosts=opts===true||(opts&&opts.keepGhosts);
  const seen=new Set(),pieces=[];
  for(const f of model.faces){
    if(seen.has(f.id))continue;
    const ids=componentOf(f.id);for(const id of ids)seen.add(id);pieces.push(ids);
  }
  if(pieces.length<2){if(!quiet)flash('Nothing to arrange (fewer than two pieces)');return;}
  if(!quiet)pushUndo(null,'Arrange on bed');
  const items=pieces.map(ids=>{const b=bounds(ids);return {ids,w:b.mx[0]-b.mn[0],d:b.mx[1]-b.mn[1]};})
    .sort((a,b)=>Math.max(b.w,b.d)-Math.max(a.w,a.d));
  // Pack in rows across the plate (plate size from Bed settings, in model units). A piece turns 90 degrees
  // when that lets it fit. A piece that cannot fit at all is still placed as close as possible, and we warn.
  const gap=0.008,BW=bed.x/1000,BD=bed.y/1000,eps=1e-9;
  const step=(s,w,d)=>{
    const t={x:s.x,y:s.y,rowH:s.rowH};
    if(t.x>0&&t.x+w>BW+eps){t.y+=t.rowH+gap;t.x=0;t.rowH=0;}
    const pos=[t.x,t.y];t.x+=w+gap;t.rowH=Math.max(t.rowH,d);
    return {s:t,pos,top:pos[1]+d,right:pos[0]+w};
  };
  let s={x:0,y:0,rowH:0},placed=[],overflow=0;
  for(const it of items){
    const opts=[[it.w,it.d,false]];if(Math.abs(it.w-it.d)>eps)opts.push([it.d,it.w,true]);
    let best=null;
    for(const [w,d,rot] of opts){
      const r=step(s,w,d),fits=w<=BW+eps&&r.top<=BD+eps&&r.right<=BW+eps;
      const cand={w,d,rot,r,fits};
      // prefer a fit, then the shallower result, then the narrower one, then the piece's own way round
      if(!best)best=cand;
      else if(fits!==best.fits){if(fits)best=cand;}
      else if(r.top<best.r.top-eps){best=cand;}
      else if(Math.abs(r.top-best.r.top)<=eps&&r.right<best.r.right-eps){best=cand;}
    }
    if(!best.fits)overflow++;
    placed.push({it,w:best.w,d:best.d,rot:best.rot,pos:best.r.pos});
    s=best.r.s;
  }
  const W=Math.max(...placed.map(p=>p.pos[0]+p.w)),D=Math.max(...placed.map(p=>p.pos[1]+p.d));
  // Centre the whole arrangement on the origin (the plate is drawn centred on (0,0))
  const cx=W/2,cy=D/2;
  for(const p of placed){
    if(p.rot){const b0=bounds(p.it.ids),c=mul(add(b0.mn,b0.mx),0.5);xformIds(p.it.ids,q=>rotateAbout(q,c,Z,Math.PI/2));}
    const b=bounds(p.it.ids),dx=p.pos[0]-cx-b.mn[0],dy=p.pos[1]-cy-b.mn[1];
    xformIds(p.it.ids,q=>[q[0]+dx,q[1]+dy,q[2]]);
  }
  commitChange();
  if(!keepGhosts)setGhosts([]);
  if(overflow)flash((overflow===1?'One piece':overflow+' pieces')+' cannot fit on the plate ('+bedText()+'). Make the plate bigger in Bed settings, or split the piece.',8000);
  else if(!quiet)flash('Arranged '+items.length+' pieces on the bed');
};
const clearBuildPlate=function clearBuildPlate(){
  const count=model.faces.length;
  if(!count&&!model.edges.length&&!model.guides.length)return flash('Print bed is already clear');
  if(!confirm('Clear all objects from the print bed? This will delete all parts currently on the plate.'))return;
  pushUndo(null,'Clear build plate');
  if(tool&&tool.cancel)tool.cancel();
  model.faces=[];model.edges=[];model.guides=[];lastShape=null;selection.clear();setGhosts([]);
  commitChange();
  flash('Build plate cleared');
};
// ---- 3D text: letters drawn with a font on this computer, traced into outlines (so it works offline), then made
// into a raised solid or cut into a face. Outlines are in mm, baseline at y=0, reading along +x.
const textOutlines=function textOutlines(text,family,bold,heightMM){
  const PX=160,cv2=document.createElement('canvas'),c=cv2.getContext('2d'),font=(bold?'bold ':'')+PX+'px "'+family+'", sans-serif';
  c.font=font;const mt=c.measureText(text),capH=c.measureText('H').actualBoundingBoxAscent||PX*0.7;
  const pad=6,asc=Math.ceil(Math.max(mt.actualBoundingBoxAscent,capH)),desc=Math.ceil(Math.max(mt.actualBoundingBoxDescent,0));
  const W=Math.ceil(mt.width+Math.max(0,mt.actualBoundingBoxLeft)+pad*2+4),H=asc+desc+pad*2;
  cv2.width=W;cv2.height=H;c.font=font;c.fillStyle='#000';c.textBaseline='alphabetic';
  const ox=pad+Math.max(0,mt.actualBoundingBoxLeft),base=pad+asc;c.fillText(text,ox,base);
  const A=c.getImageData(0,0,W,H).data,v=(i,j)=>i<0||j<0||i>=W||j>=H?0:A[(j*W+i)*4+3];
  // marching squares through every pixel square: crossing points on the square sides, joined into closed loops
  const pts=new Map(),segs=[],T=128;
  const pt=(k,x,y)=>{if(!pts.has(k))pts.set(k,[x,y]);return k;};
  const hx=(i,j)=>{const a=v(i,j),b=v(i+1,j);return pt('h'+i+','+j,i+(T-a)/(b-a),j);};
  const vy=(i,j)=>{const a=v(i,j),b=v(i,j+1);return pt('v'+i+','+j,i,j+(T-a)/(b-a));};
  for(let j=-1;j<H;j++)for(let i=-1;i<W;i++){
    const a=v(i,j)>=T,b=v(i+1,j)>=T,cc=v(i+1,j+1)>=T,d=v(i,j+1)>=T,k=(a?8:0)|(b?4:0)|(cc?2:0)|(d?1:0);if(k===0||k===15)continue;
    const top=()=>hx(i,j),bot=()=>hx(i,j+1),lef=()=>vy(i,j),rig=()=>vy(i+1,j);
    const add2=(p,q)=>segs.push([p,q]);
    switch(k){
      case 1:case 14:add2(lef(),bot());break;case 2:case 13:add2(bot(),rig());break;case 3:case 12:add2(lef(),rig());break;
      case 4:case 11:add2(top(),rig());break;case 6:case 9:add2(top(),bot());break;case 7:case 8:add2(lef(),top());break;
      case 5:case 10:{const mid=(v(i,j)+v(i+1,j)+v(i+1,j+1)+v(i,j+1))/4>=T;
        if((k===5)===mid){add2(lef(),top());add2(bot(),rig());}else{add2(lef(),bot());add2(top(),rig());}break;}
    }
  }
  const at=new Map();segs.forEach((s,n)=>{for(const p of s){if(!at.has(p))at.set(p,[]);at.get(p).push(n);}});
  const used=new Uint8Array(segs.length),loops=[];
  for(let n0=0;n0<segs.length;n0++){if(used[n0])continue;
    const L=[];let n=n0,p=segs[n0][0];
    while(!used[n]){used[n]=1;L.push(pts.get(p));const q=segs[n][0]===p?segs[n][1]:segs[n][0];p=q;n=(at.get(q)||[]).find(m=>!used[m]);if(n===undefined)break;}
    if(L.length>=3)loops.push(L);
  }
  // fewer points along straight-ish runs (half a pixel tolerance)
  const simp=L=>{const keep=new Uint8Array(L.length);keep[0]=1;const rd=(a,b)=>{let mx=0,mi=-1;const [x0,y0]=L[a],[x1,y1]=L[b%L.length],dx=x1-x0,dy=y1-y0,ln=Math.hypot(dx,dy)||1;
      for(let k=a+1;k<b;k++){const d=Math.abs((L[k][0]-x0)*dy-(L[k][1]-y0)*dx)/ln;if(d>mx){mx=d;mi=k;}}if(mx>0.45){keep[mi]=1;rd(a,mi);rd(mi,b);}};
    const h=L.length>>1;keep[h]=1;rd(0,h);rd(h,L.length);return L.filter((_,k)=>keep[k]);};
  const s=heightMM/1000/capH,toMM=L=>L.map(([x,y])=>[(x-ox)*s,(base-y)*s]);
  const area=L=>{let a=0;for(let k=0;k<L.length;k++){const p=L[k],q=L[(k+1)%L.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
  const inside=(p,L)=>{let r=false;for(let k=0,m=L.length-1;k<L.length;m=k++){const a=L[k],b=L[m];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])r=!r;}return r;};
  const all=loops.map(simp).filter(L=>L.length>=3).map(toMM).filter(L=>Math.abs(area(L))>(0.5*s)*(0.5*s));
  // a loop inside an even number of others is an outline (anticlockwise), inside an odd number a hole (clockwise)
  const depth=all.map((L,k)=>all.filter((M,m)=>m!==k&&Math.abs(area(M))>Math.abs(area(L))&&inside(L[0],M)).length);
  const regions=[];
  all.forEach((L,k)=>{if(depth[k]%2)return;if(area(L)<0)L.reverse();regions.push({outer:L,holes:[],a:area(L)});});
  all.forEach((L,k)=>{if(!(depth[k]%2))return;if(area(L)>0)L.reverse();
    let best=null;for(const R of regions)if(inside(L[0],R.outer)&&(!best||R.a<best.a))best=R;if(best)best.holes.push(L);});
  return {regions,width:(mt.width)*s};
};
// The faces of the text as a solid: lying on the plane through p (normal n), from z0 to z1 along n. One group.
const textSolidFaces=function textSolidFaces(T,p,n,u,v,z0,z1,gid,color){
  const P=([x,y],z)=>clean(add(p,add(add(mul(u,x),mul(v,y)),mul(n,z)))),out=[];
  for(const R of T.regions){
    const loops=[R.outer,...R.holes];
    out.push({id:nid(),pts:R.outer.map(q=>P(q,z1)),holes:R.holes.map(h=>h.map(q=>P(q,z1))),color,g:gid});
    out.push({id:nid(),pts:R.outer.map(q=>P(q,z0)).reverse(),holes:R.holes.map(h=>h.map(q=>P(q,z0)).reverse()),color,g:gid});
    for(const L of loops)for(let k=0;k<L.length;k++){
      const a=L[k],b=L[(k+1)%L.length],pa=L[(k+L.length-1)%L.length],nb=L[(k+2)%L.length];
      const turn=(x,y,z)=>{const d1=[y[0]-x[0],y[1]-x[1]],d2=[z[0]-y[0],z[1]-y[1]];const c=(d1[0]*d2[0]+d1[1]*d2[1])/((Math.hypot(...d1)*Math.hypot(...d2))||1);return c;};
      // sides round a curve are drawn smooth; sharp corners keep their lines
      const soft=turn(pa,a,b)>Math.cos(35*Math.PI/180)&&turn(a,b,nb)>Math.cos(35*Math.PI/180);
      out.push({id:nid(),pts:[P(a,z0),P(b,z0),P(b,z1),P(a,z1)],holes:[],color,g:gid,soft:soft||undefined});
    }
  }
  return out;
};
let textSet=(()=>{try{return Object.assign({text:'EvenUCan',font:'Arial',bold:true,h:8,d:1.5,mode:'raised'},JSON.parse(store.get('text')||'{}'));}catch(e){return {text:'EvenUCan',font:'Arial',bold:true,h:8,d:1.5,mode:'raised'};}})();
const TEXT_FONTS=['Arial','Arial Black','Segoe UI','Verdana','Tahoma','Trebuchet MS','Impact','Georgia','Times New Roman','Consolas','Courier New','Comic Sans MS'];
const textPanel=document.createElement('div');textPanel.id='textPanel';textPanel.className='panel';$cad('view').appendChild(textPanel);
textPanel.innerHTML=`<h3 style="margin:0 0 6px">3D text</h3>
<label>Text<input data-t="text" autocomplete="off" spellcheck="false"></label>
<label>Font<select data-t="font">${TEXT_FONTS.map(f=>`<option style="font-family:'${f}'">${f}</option>`).join('')}</select></label>
<label class="chk"><input type="checkbox" data-t="bold"> Bold</label>
<div class="row2"><label>Letter height (mm)<input data-t="h" type="number" min="0.5" step="0.5"></label><label>Depth (mm)<input data-t="d" type="number" min="0.1" step="0.1"></label></div>
<label class="chk"><input type="radio" name="tmode" value="raised"> Raised (stands up)</label>
<label class="chk"><input type="radio" name="tmode" value="engraved"> Engraved (cut into a face)</label>
<div class="note">Then click where the text starts: on the ground, or on a face of your model.</div>`;
let textCache=null;
const textShape=function textShape(){const k=JSON.stringify([textSet.text,textSet.font,textSet.bold,textSet.h]);if(!textCache||textCache.k!==k)textCache={k,T:textSet.text.trim()?textOutlines(textSet.text,textSet.font,textSet.bold,textSet.h):{regions:[],width:0}};return textCache.T;};
const syncTextPanel=function syncTextPanel(){
  textPanel.querySelector('[data-t=text]').value=textSet.text;textPanel.querySelector('[data-t=font]').value=textSet.font;
  textPanel.querySelector('[data-t=bold]').checked=textSet.bold;textPanel.querySelector('[data-t=h]').value=textSet.h;textPanel.querySelector('[data-t=d]').value=textSet.d;
  for(const r of textPanel.querySelectorAll('[name=tmode]'))r.checked=r.value===textSet.mode;
};
textPanel.addEventListener('input',e=>{
  const t=e.target,k=t.dataset.t;
  if(k==='text')textSet.text=t.value;else if(k==='font')textSet.font=t.value;else if(k==='bold')textSet.bold=t.checked;
  else if(k==='h'){const x=parseFloat(t.value);if(x>0)textSet.h=x;}else if(k==='d'){const x=parseFloat(t.value);if(x>0)textSet.d=x;}
  else if(t.name==='tmode')textSet.mode=t.value;
  store.set('text',JSON.stringify(textSet));if(tool.move&&lastE)tool.move(lastE,lastM);
});
textPanel.addEventListener('keydown',e=>e.stopPropagation());
// Which way the text reads on a plane: upright on walls (up = blue), on the ground it reads from the front.
const textAxes=function textAxes(n){
  let v=sub(Z,mul(n,dot(n,Z)));v=len(v)<1e-6?(n[2]>0?Y:[0,-1,0]):norm(v);
  return {u:norm(cross(v,n)),v};
};
tools.text=()=>{
  let cur=null;
  textPanel.style.display='block';syncTextPanel();
  const place=()=>{if(!cur)return null;const pl=planeFor(cur),{u,v}=textAxes(pl.n);return {p:cur.p,n:pl.n,u,v,face:cur.face};};
  const t={label:'Height',hint:'Type your text in the panel on the right, then click where it starts: on the ground or on a face · type a number and Enter for the letter height',
    move(e,m){
      cur=inferPoint(m.x,m.y);setMarker(cur);preview.lines=[];const pl=place(),T=textShape();if(!pl)return;
      const col=[0.15,0.35,0.9],P=([x,y])=>add(pl.p,add(mul(pl.u,x),mul(pl.v,y)));
      for(const R of T.regions)for(const L of [R.outer,...R.holes])for(let k=0;k<L.length;k++)preview.lines.push([P(L[k]),P(L[(k+1)%L.length]),col]);
    },
    async down(e,m){
      const pl=place(),T=textShape();if(!pl)return;
      if(!T.regions.length)return flash('Type some text in the panel first');
      const dm=textSet.d/1000,gid=nid();
      if(textSet.mode==='raised'){
        pushUndo(null,'Text');const F=textSolidFaces(T,pl.p,pl.n,pl.u,pl.v,0,dm,gid,null);model.faces.push(...F);
        preview.lines=[];selection=new Set(F.map(f=>f.id));selChanged();commitChange();
        flash(pl.face?'Text added on the face. It is its own object: select it and the shape and press U to join them':'Text added',5000);return;
      }
      if(!pl.face)return flash('Engraved text needs a face to cut into: click on a face of your model',5000);
      // engraved: a block of letters from the face down into it (and a hair above), cut out of that object
      const ids=componentOf(pl.face.id),target=model.faces.filter(f=>ids.has(f.id)),snapF=cloneCad(model.faces);
      flash('Engraving…',8000);const w=await WFEnclosure.engine(),pool=[],K=x=>{pool.push(x);return x;};
      try{
        const body=solidOf(w,K,target);if(!body){flash('That shape isn\'t a closed solid, so text can\'t be cut into it: Check Model shows the gaps',6000);return;}
        const cutter=solidOf(w,K,textSolidFaces(T,pl.p,pl.n,pl.u,pl.v,-dm,0.0002,0,null));
        if(!cutter)throw new Error('the letters could not be made into a solid');
        const out=K(body.subtract(cutter)),col=(target.find(f=>f.color)||{}).color||null;
        const flat=[...flatPlanes(target),{n:pl.n,d:dot(pl.n,pl.p)-dm,color:col}];
        const nf=facesOfSolid(out,flat,col,pl.face.g||null);
        model.faces=model.faces.filter(f=>!ids.has(f.id)).concat(nf);
        pushUndo(snapshot(snapF,model.edges),'Engraved text');preview.lines=[];selection.clear();selChanged();commitChange();flash('Text engraved '+fmt(dm)+' deep');
      }catch(er){console.error('EvenUCan: text failed',er);model.faces=snapF;markDirtyCad();flash('Could not engrave the text: '+er.message,6000);}
      finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
    },
    vcb(s){const L=parseLen(s);if(!(L>0))return flash('Type a letter height, e.g. 8');textSet.h=+(L*1000).toFixed(3);store.set('text',JSON.stringify(textSet));syncTextPanel();if(tool.move&&lastE)tool.move(lastE,lastM);flash('Letters '+fmt(L)+' high');},
    cancel(){const b=preview.lines.length>0;preview.lines=[];return false;}
  };
  return t;
};
// ---- Shell: hollow a solid out, leaving walls of the given thickness and the chosen faces open. Each flat side is
// moved inwards by the thickness (an open side is moved outwards so it cuts through), and that inside is cut away.
let shellSize=(()=>{const v=parseFloat(store.get('shell'));return v>0?v:0.002;})();// 2 mm unless changed
const shellSolid=async function shellSolid(face,openIds){
  const ids=componentOf(face.id),F=model.faces.filter(f=>ids.has(f.id)),t=shellSize;
  const planes=[];
  for(const f of F){const n=faceNormal(f),d=dot(n,f.pts[0]),open=openIds.has(f.id);
    const p=planes.find(p=>dot(p.n,n)>0.99999&&Math.abs(p.d-d)<1e-7);if(p)p.open=p.open||open;else planes.push({n,d,open});}
  const V=F.flatMap(f=>loops(f).flat());
  if(planes.some(p=>V.some(v=>dot(p.n,v)>p.d+1e-7)))return 'Shell works on box-like shapes without dents, steps or holes (boxes, cylinders, prisms). For other shapes, Offset a face inwards and push the middle in.';
  if(!window.WFEnclosure)return 'The solid engine is not available.';
  const w=await WFEnclosure.engine(),M=w.Manifold,pool=[],K=x=>{pool.push(x);return x;},S=1000;
  try{
    const body=solidOf(w,K,F);if(!body)return 'That shape isn\'t a closed solid: Check Model shows the gaps.';
    const mn=[0,1,2].map(i=>Math.min(...V.map(v=>v[i]))*S-t*S-5),mx=[0,1,2].map(i=>Math.max(...V.map(v=>v[i]))*S+t*S+5);
    let inner=K(M.cube([mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]]).translate(mn));
    for(const p of planes)inner=K(inner.trimByPlane([-p.n[0],-p.n[1],-p.n[2]],-(p.open?p.d+t+0.001:p.d-t)*S));
    if(inner.isEmpty()||inner.volume()<1e-6)return 'Too thick: the walls would fill the whole shape. Type a thinner wall and press Enter.';
    const out=K(body.subtract(inner)),col=(F.find(f=>f.color)||{}).color||null;
    const flat=[...flatPlanes(F),...planes.filter(p=>!p.open).map(p=>({n:mul(p.n,-1),d:-(p.d-t),color:col}))];
    const nf=facesOfSolid(out,flat,col,face.g||null);
    for(const f of nf){const n=faceNormal(f);if(F.some(o=>o.soft&&dot(faceNormal(o),n)>0.9999))f.soft=true;}
    model.faces=model.faces.filter(f=>!ids.has(f.id)).concat(nf);
    for(const id of ids)selection.delete(id);
    return null;
  }finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
};
tools.shell=()=>{
  const hint=()=>'Click the face to leave open (e.g. the top): the shape is hollowed out with '+fmt(shellSize)+' walls · Shift+click to pick more faces to leave open first · Ctrl+click: hollow with no opening · type a wall thickness and Enter';
  const t={label:'Thickness',hint:hint(),
    move(e,m){const h=pickFace(screenRay(m.x,m.y));setHover(h?h.face:null);},
    async down(e,m){
      const h=pickFace(screenRay(m.x,m.y));if(!h)return flash('Click a face of the shape to hollow');
      if(e.shiftKey){if(selection.has(h.face.id))selection.delete(h.face.id);else selection.add(h.face.id);selChanged();
        const n=[...selection].filter(id=>componentOf(h.face.id).has(id)).length;return setHintCad(n+' face'+(n===1?'':'s')+' to leave open · click one more (without Shift) to hollow it out');}
      const comp=componentOf(h.face.id),open=e.ctrlKey||e.metaKey?new Set():new Set([...selection].filter(id=>comp.has(id)).concat(h.face.id));
      const snapF=cloneCad(model.faces);flash('Hollowing…',8000);setHover(null);
      try{
        const err=await shellSolid(h.face,open);
        if(err){model.faces=snapF;markDirtyCad();return flash(err,6000);}
        pushUndo(snapshot(snapF,model.edges),'Shell');commitChange();
        flash('Hollowed out with '+fmt(shellSize)+' walls'+(open.size?', '+open.size+' side'+(open.size>1?'s':'')+' open':' and no opening'),5000);
      }catch(er){console.error('EvenUCan: shell failed',er);model.faces=snapF;markDirtyCad();flash('Could not hollow that shape: '+er.message,6000);}
    },
    vcb(s){const L=parseLen(s);if(!(L>0))return flash('Type a wall thickness, e.g. 2');shellSize=L;store.set('shell',String(L));vcbShow(fmt(L));setHintCad(hint());flash('Walls '+fmt(L)+' thick');}
  };
  return t;
};
