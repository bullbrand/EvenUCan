function showAbout(){
  const back=document.createElement('div');back.id='askBack';
  back.innerHTML=`<div id="askBox" style="width:min(520px,calc(100% - 32px))"><div class="msg" style="line-height:1.5">
<div style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:8px"><img src="${$('appIcon').querySelector('img').src}" alt="" width="32" height="32" style="border-radius:6px">EvenUCan</div>
<div style="font-size:14px;margin-bottom:8px">${appVersion?'Version <b>'+appVersion+'</b>':'Web version'} · <i>from idea to object</i></div>
<div>Created by <b>David John Waugh</b>. © 2026 David John Waugh.</div>
<div style="margin-top:6px;font-size:13px">Free software: you may use, share and change it under the <b>GNU General Public License v3</b> (or later). It comes with no warranty.</div>
<div style="margin-top:10px;font-size:12px;color:#555">Built in: the <b>Manifold</b> geometry library (© The Manifold Authors, Apache License 2.0) and the <b>Anthropic TypeScript SDK</b> (© Anthropic, Apache License 2.0). The parts library is made from the Fritzing parts (© Fritzing contributors, CC BY-SA 3.0).</div>
<div style="margin-top:8px;font-size:12px;color:#555"><b>Credits for the icons:</b> most tool and menu icons come from <b>FreeCAD</b> (© FreeCAD contributors, GNU LGPL 2.1 or later; a few under CC BY-SA 4.0, LGPL 3 or public domain), https://www.freecad.org and https://github.com/FreeCAD/FreeCAD. The others (Eraser, Pan, Zoom, Lay all flat, Box designer, Parts, Wiring, Code, AI key, Picture, Start a project, Help, Web) are original EvenUCan icons in the same style. The full list is in THIRD-PARTY-NOTICES.txt.</div>
<div style="margin-top:8px;font-size:12px;color:#555">When you report a problem, please say which version you have.</div></div>
<div class="btns"><button data-v="copy">Copy version</button><button data-v="ok">OK</button></div></div>`;
  const close=()=>back.remove();
  back.querySelector('[data-v=ok]').onclick=close;
  back.querySelector('[data-v=copy]').onclick=()=>{navigator.clipboard.writeText('EvenUCan '+(appVersion||'web version')).then(()=>flash('Version copied'));};
  back.addEventListener('click',e=>{if(e.target===back)close();});
  back.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'||e.key==='Enter')close();});
  document.body.appendChild(back);back.querySelector('[data-v=ok]').focus();
}
$('bAbout').onclick=showAbout;$('appIcon').onclick=()=>$('bAbout').click();
// ---- auto-update check: runs once after load, non-blocking, silently fails
(()=>{
  const DISMISSED_KEY='updateDismissed';
  function semverGt(a,b){// returns true if a > b  (simple 3-part comparison)
    const p=s=>s.split('.').map(Number);const[a1,a2,a3]=p(a);const[b1,b2,b3]=p(b);
    return a1>b1||(a1===b1&&a2>b2)||(a1===b1&&a2===b2&&a3>b3);}
  function showBanner(latest,notes,url){
    const dismissed=WF.store.get(DISMISSED_KEY);
    if(dismissed===latest)return;// user already dismissed this version
    const msg=$('updateMsg');
    msg.innerHTML='🆕 EvenUCan <b>v'+esc(latest)+'</b> is available'+(notes?' — '+esc(notes):'')
      +'. <a href="'+esc(url||'https://github.com/bullbrand/EvenUCan/releases/latest')+'" target="_blank" rel="noopener">Download update</a>';
    $('updateBanner').style.display='block';
    $('updateDismiss').onclick=()=>{WF.store.set(DISMISSED_KEY,latest);$('updateBanner').style.display='none';};
  }
  setTimeout(async()=>{
    try{
      const r=await fetch('https://raw.githubusercontent.com/bullbrand/EvenUCan/main/version.json',{cache:'no-store'});
      if(!r.ok)return;
      const d=await r.json();
      if(d&&d.version&&semverGt(d.version,APP_VERSION))showBanner(d.version,d.notes,d.downloadUrl);
    }catch(e){/* network unavailable or rate-limited — silently ignore */}
  },3000);
  window.checkForUpdatesManual=async function(){
    try{
      const r=await fetch('https://raw.githubusercontent.com/bullbrand/EvenUCan/main/version.json',{cache:'no-store'});
      if(!r.ok){flash('Could not reach update server — check your connection');return;}
      const d=await r.json();
      if(d&&d.version&&semverGt(d.version,APP_VERSION)){
        WF.store.set&&WF.store.set('euDismissedVersion',null);// allow banner to show again
        showBanner(d.version,d.notes,d.downloadUrl);
      }else{flash('EvenUCan v'+APP_VERSION+' - you are up to date');}
    }catch(e){flash('Update check failed — check your connection');}
  }
})();
// Hide / unhide faces. Hidden faces stay in the model (saved and exported); they just aren't drawn or clickable.
function hideSelected(){
  const ids=model.faces.filter(f=>selection.has(f.id)&&!f.hidden).map(f=>f.id);
  if(!ids.length)return flash('Select the faces to hide first, then click Hide');
  pushUndo(null,'Hide');
  for(const f of model.faces)if(ids.includes(f.id))f.hidden=true;
  for(const id of ids)selection.delete(id);
  setHover(null);commitChange();flash(ids.length+(ids.length===1?' face':' faces')+' hidden · Unhide All brings them back');
}
function unhideAll(){
  const n=model.faces.filter(f=>f.hidden).length;
  if(!n)return flash('Nothing is hidden');
  pushUndo(null,'Unhide all');for(const f of model.faces)delete f.hidden;
  commitChange();flash(n+(n===1?' face':' faces')+' shown again');
}
$('bHide').onclick=hideSelected;$('bUnhide').onclick=unhideAll;
function groupSelected(){
  const items=groupable().filter(x=>selection.has(x.id));
  if(!items.length)return flash('Select what you want to group first (drag a box around it), then click Group');
  pushUndo(null,'Group');const g=nid();
  for(const x of items)x.g=g;// grouping items that were already grouped merges them into this one group
  commitChange();flash('Grouped '+items.length+' items · click any part to select the whole group');
}
function ungroupSelected(){
  const items=groupable().filter(x=>selection.has(x.id)&&x.g);
  if(!items.length)return flash('Select a group first, then click Ungroup');
  pushUndo(null,'Ungroup');const n=new Set(items.map(x=>x.g)).size;
  for(const x of items)delete x.g;
  commitChange();flash(n===1?'Group broken into loose shapes':n+' groups broken into loose shapes');
}
// Join: merge two or more solids into one (where they overlap or touch, the inside walls go), as one group.
// Flat faces keep their outlines and colours; curved parts stay smooth.
// ---- Solid operations through the Manifold engine (in mm): our faces -> a solid, and a solid -> our faces.
function solidOf(w,K,F){
  const m=buildMesh(false,F),S=1000;if(m.open)return null;
  const mesh=new w.Mesh({numProp:3,vertProperties:new Float32Array(m.verts.flatMap(p=>[p[0]*S,p[1]*S,p[2]*S])),triVerts:new Uint32Array(m.tris.flat())});
  mesh.merge();const s=K(new w.Manifold(mesh));
  if(s.status&&s.status()!=='NoError'&&s.status()!==0)throw new Error('a shape could not be read as a solid ('+s.status()+')');
  return s;
}
// flat: [{n,d,color}] planes whose faces keep their outlines (and colour); anything else is a curved part, drawn smooth.
function facesOfSolid(s,flat,col,gid){
  const g=s.getMesh(),P=[],S=1000;for(let i=0;i<g.vertProperties.length;i+=g.numProp)P.push([g.vertProperties[i]/S,g.vertProperties[i+1]/S,g.vertProperties[i+2]/S]);
  const tris=[];for(let i=0;i<g.triVerts.length;i+=3)tris.push([P[g.triVerts[i]],P[g.triVerts[i+1]],P[g.triVerts[i+2]]]);
  const nf=facesFromTriangles(tris);
  for(const f of nf){
    if(gid)f.g=gid;const n=faceNormal(f),h=flat.find(h=>dot(h.n,n)>0.9999&&Math.abs(dot(h.n,f.pts[0])-h.d)<1e-6);
    f.color=h&&h.color!==undefined?h.color:col;if(!h)f.soft=true;
  }
  return nf;
}
const flatPlanes=(F,color)=>F.filter(f=>!f.soft).map(f=>{const n=faceNormal(f);return {n,d:dot(n,f.pts[0]),color:color===undefined?f.color||null:color};});
// The objects picked, in the order they were picked (the first one is kept by Subtract).
function pickedSolids(){
  const ids=expandGroups(new Set(selection)),solids=[],seen=new Set();
  for(const id of ids){const f=model.faces.find(x=>x.id===id);if(!f||f.hidden||seen.has(id))continue;const c=componentOf(id);for(const x of c)seen.add(x);solids.push(c);}
  return solids;
}
// Join (add), Subtract (the first object picked, minus the others) or Intersect (only where they all overlap).
const BOOL={add:{verb:'join',ing:'Joining',name:'Join',key:'U'},subtract:{verb:'subtract',ing:'Subtracting',name:'Subtract',key:'S'},intersect:{verb:'intersect',ing:'Intersecting',name:'Intersect',key:''}};
async function booleanSelected(op){
  const B=BOOL[op],solids=pickedSolids();
  if(solids.length<2)return flash(op==='subtract'?'Subtract: click the object to keep, then Shift+click the shape(s) to cut out of it, then press S':
    'Select two or more objects to '+B.verb+': click the first, Shift+click the others (any face of each), then '+(B.key?'press '+B.key:'click '+B.name),6000);
  if(!window.WFEnclosure)return flash('The solid engine is not available');
  const snapF=clone(model.faces);flash(B.ing+'…',8000);
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
  }catch(er){console.error('EvenUCan: '+B.verb+' failed',er);model.faces=snapF;markDirty();flash('Could not '+B.verb+' those: '+er.message,6000);}
  finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
}
const joinSelected=()=>booleanSelected('add'),subtractSelected=()=>booleanSelected('subtract'),intersectSelected=()=>booleanSelected('intersect');
// Whole objects in the selection (picking one face of a shape takes all of it), plus any selected loose lines.
function pickedIds(){
  const ids=expandGroups(new Set(selection)),out=new Set();
  for(const id of ids){if(out.has(id))continue;const f=model.faces.find(x=>x.id===id);if(f){if(!f.hidden)for(const x of componentOf(id))out.add(x);}else out.add(id);}
  return out;
}
// Flip the selected objects in place along an axis (0 red, 1 green, 2 blue), or add a mirrored copy touching them.
function flipSelected(i,copy){
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
}
// A small pop-up menu (the right-click menu's look): items are [label, key, enabled, action] or null for a line.
function showMenu(items,x,y){
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
}
function flipMenu(x,y){
  const n=selection.size>0;
  showMenu([['Flip left ↔ right (along red)','',n,()=>flipSelected(0,false)],['Flip front ↔ back (along green)','',n,()=>flipSelected(1,false)],['Turn upside down (along blue)','',n,()=>flipSelected(2,false)],null,
    ['Mirror copy to the right','',n,()=>flipSelected(0,true)],['Mirror copy to the back','',n,()=>flipSelected(1,true)],['Mirror copy on top','',n,()=>flipSelected(2,true)]],x,y);
  if(!n)flash('Select what you want to flip or mirror first (click any face of it)');
}
// Lay flat: turn the object so the clicked face sits flat on the bed, face down (the way you'd print it).
function layFlat(face){
  const ids=componentOf(face.id),n=faceNormal(face),down=[0,0,-1],cs=dot(n,down);
  pushUndo(null,'Lay flat');
  if(cs<0.999999){
    let ax=cross(n,down);ax=len(ax)<1e-9?X:norm(ax);
    const b=bounds(ids),c=mul(add(b.mn,b.mx),0.5),ang=Math.acos(clamp(cs,-1,1));
    xformIds(ids,p=>rotateAbout(p,c,ax,ang));
  }
  const b=bounds(ids);xformIds(ids,p=>[p[0],p[1],p[2]-b.mn[2]]);
  commitChange();flash('Laid flat on that face, on the bed');
}
// Every separate piece (each group, and each set of connected loose faces) in one go: for each, picks its
// own largest face (the one most likely to print stably) and lays it flat on the bed, the same way Lay
// Flat does for one piece at a time.
function layAllFlat(){
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
}
// Repacks every separate piece side by side on the bed, left to right then wrapping to a new row, so
// nothing overlaps - handy after Generate drops several printable pieces (base, lid, plugs, rivets) in
// one go. Only moves pieces sideways (X/Y): each piece's own height off the bed is left alone.
function arrangeOnBed(){
  const seen=new Set(),pieces=[];
  for(const f of model.faces){
    if(seen.has(f.id))continue;
    const ids=componentOf(f.id);for(const id of ids)seen.add(id);pieces.push(ids);
  }
  if(pieces.length<2)return flash('Nothing to arrange (fewer than two pieces)');
  pushUndo(null,'Arrange on bed');
  const items=pieces.map(ids=>{const b=bounds(ids);return {ids,w:b.mx[0]-b.mn[0],d:b.mx[1]-b.mn[1],b};})
    .sort((a,b)=>Math.max(b.w,b.d)-Math.max(a.w,a.d));
  const gap=0.008,bedW=Math.max(bed.x/1000,items[0].w);
  // Pack left to right, top to bottom in local (0,0)-based space first, then shift the whole arrangement
  // so it's centred on the origin at the end - the bed itself is drawn centred on (0,0), not starting
  // at a corner, so packing from (0,0) without this shift leaves everything sitting off to one side.
  let x=0,y=0,rowH=0,maxX=0;
  for(const it of items){
    if(x>0&&x+it.w>bedW){x=0;y+=rowH+gap;rowH=0;}
    it.dx=x-it.b.mn[0];it.dy=y-it.b.mn[1];
    x+=it.w+gap;rowH=Math.max(rowH,it.d);maxX=Math.max(maxX,x-gap);
  }
  const totalD=y+rowH,cx=maxX/2,cy=totalD/2;
  for(const it of items)xformIds(it.ids,p=>[p[0]+it.dx-cx,p[1]+it.dy-cy,p[2]]);
  commitChange();setGhosts([]);flash('Arranged '+items.length+' pieces on the bed');
}
// ---- 3D text: letters drawn with a font on this computer, traced into outlines (so it works offline), then made
// into a raised solid or cut into a face. Outlines are in mm, baseline at y=0, reading along +x.
function textOutlines(text,family,bold,heightMM){
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
}
// The faces of the text as a solid: lying on the plane through p (normal n), from z0 to z1 along n. One group.
function textSolidFaces(T,p,n,u,v,z0,z1,gid,color){
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
}
let textSet=(()=>{try{return Object.assign({text:'EvenUCan',font:'Arial',bold:true,h:8,d:1.5,mode:'raised'},JSON.parse(store.get('text')||'{}'));}catch(e){return {text:'EvenUCan',font:'Arial',bold:true,h:8,d:1.5,mode:'raised'};}})();
const TEXT_FONTS=['Arial','Arial Black','Segoe UI','Verdana','Tahoma','Trebuchet MS','Impact','Georgia','Times New Roman','Consolas','Courier New','Comic Sans MS'];
const textPanel=document.createElement('div');textPanel.id='textPanel';textPanel.className='panel';$('view').appendChild(textPanel);
textPanel.innerHTML=`<h3 style="margin:0 0 6px">3D text</h3>
<label>Text<input data-t="text" autocomplete="off" spellcheck="false"></label>
<label>Font<select data-t="font">${TEXT_FONTS.map(f=>`<option style="font-family:'${f}'">${f}</option>`).join('')}</select></label>
<label class="chk"><input type="checkbox" data-t="bold"> Bold</label>
<div class="row2"><label>Letter height (mm)<input data-t="h" type="number" min="0.5" step="0.5"></label><label>Depth (mm)<input data-t="d" type="number" min="0.1" step="0.1"></label></div>
<label class="chk"><input type="radio" name="tmode" value="raised"> Raised (stands up)</label>
<label class="chk"><input type="radio" name="tmode" value="engraved"> Engraved (cut into a face)</label>
<div class="note">Then click where the text starts: on the ground, or on a face of your model.</div>`;
let textCache=null;
function textShape(){const k=JSON.stringify([textSet.text,textSet.font,textSet.bold,textSet.h]);if(!textCache||textCache.k!==k)textCache={k,T:textSet.text.trim()?textOutlines(textSet.text,textSet.font,textSet.bold,textSet.h):{regions:[],width:0}};return textCache.T;}
function syncTextPanel(){
  textPanel.querySelector('[data-t=text]').value=textSet.text;textPanel.querySelector('[data-t=font]').value=textSet.font;
  textPanel.querySelector('[data-t=bold]').checked=textSet.bold;textPanel.querySelector('[data-t=h]').value=textSet.h;textPanel.querySelector('[data-t=d]').value=textSet.d;
  for(const r of textPanel.querySelectorAll('[name=tmode]'))r.checked=r.value===textSet.mode;
}
textPanel.addEventListener('input',e=>{
  const t=e.target,k=t.dataset.t;
  if(k==='text')textSet.text=t.value;else if(k==='font')textSet.font=t.value;else if(k==='bold')textSet.bold=t.checked;
  else if(k==='h'){const x=parseFloat(t.value);if(x>0)textSet.h=x;}else if(k==='d'){const x=parseFloat(t.value);if(x>0)textSet.d=x;}
  else if(t.name==='tmode')textSet.mode=t.value;
  store.set('text',JSON.stringify(textSet));if(tool.move&&lastE)tool.move(lastE,lastM);
});
textPanel.addEventListener('keydown',e=>e.stopPropagation());
// Which way the text reads on a plane: upright on walls (up = blue), on the ground it reads from the front.
function textAxes(n){
  let v=sub(Z,mul(n,dot(n,Z)));v=len(v)<1e-6?(n[2]>0?Y:[0,-1,0]):norm(v);
  return {u:norm(cross(v,n)),v};
}
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
      const ids=componentOf(pl.face.id),target=model.faces.filter(f=>ids.has(f.id)),snapF=clone(model.faces);
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
      }catch(er){console.error('EvenUCan: text failed',er);model.faces=snapF;markDirty();flash('Could not engrave the text: '+er.message,6000);}
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
async function shellSolid(face,openIds){
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
}
tools.shell=()=>{
  const hint=()=>'Click the face to leave open (e.g. the top): the shape is hollowed out with '+fmt(shellSize)+' walls · Shift+click to pick more faces to leave open first · Ctrl+click: hollow with no opening · type a wall thickness and Enter';
  const t={label:'Thickness',hint:hint(),
    move(e,m){const h=pickFace(screenRay(m.x,m.y));setHover(h?h.face:null);},
    async down(e,m){
      const h=pickFace(screenRay(m.x,m.y));if(!h)return flash('Click a face of the shape to hollow');
      if(e.shiftKey){if(selection.has(h.face.id))selection.delete(h.face.id);else selection.add(h.face.id);selChanged();
        const n=[...selection].filter(id=>componentOf(h.face.id).has(id)).length;return setHint(n+' face'+(n===1?'':'s')+' to leave open · click one more (without Shift) to hollow it out');}
      const comp=componentOf(h.face.id),open=e.ctrlKey||e.metaKey?new Set():new Set([...selection].filter(id=>comp.has(id)).concat(h.face.id));
      const snapF=clone(model.faces);flash('Hollowing…',8000);setHover(null);
      try{
        const err=await shellSolid(h.face,open);
        if(err){model.faces=snapF;markDirty();return flash(err,6000);}
        pushUndo(snapshot(snapF,model.edges),'Shell');commitChange();
        flash('Hollowed out with '+fmt(shellSize)+' walls'+(open.size?', '+open.size+' side'+(open.size>1?'s':'')+' open':' and no opening'),5000);
      }catch(er){console.error('EvenUCan: shell failed',er);model.faces=snapF;markDirty();flash('Could not hollow that shape: '+er.message,6000);}
    },
    vcb(s){const L=parseLen(s);if(!(L>0))return flash('Type a wall thickness, e.g. 2');shellSize=L;store.set('shell',String(L));vcbShow(fmt(L));setHint(hint());flash('Walls '+fmt(L)+' thick');}
  };
  return t;
};
// ---- Hole tool: screw holes at sizes that work for 3D printing (printed holes come out a little small, so the
// clearance holes are a touch big). All sizes in mm.
const HOLE_SIZES={
  //        size D, coarse pitch P, clearance, tapped (screw cuts its thread), insert hole & depth (none from M6 up),
  //        countersink head, cap head dia & height, nut across flats & thickness
  M2:    {D:2,  P:0.4, clear:2.4, tap:1.7, ins:3.2,insD:4,   csk:4.4, cap:3.8, capH:2,  nut:4,  nutH:1.6},
  'M2.5':{D:2.5,P:0.45,clear:2.9, tap:2.2, ins:3.6,insD:5,   csk:5.5, cap:4.5, capH:2.5,nut:5,  nutH:2},
  M3:    {D:3,  P:0.5, clear:3.4, tap:2.6, ins:4.0,insD:6,   csk:6.5, cap:5.5, capH:3,  nut:5.5,nutH:2.4},
  M4:    {D:4,  P:0.7, clear:4.5, tap:3.5, ins:5.6,insD:9,   csk:8.8, cap:7,   capH:4,  nut:7,  nutH:3.2},
  M5:    {D:5,  P:0.8, clear:5.5, tap:4.4, ins:6.4,insD:10.5,csk:10.8,cap:8.5, capH:5,  nut:8,  nutH:4},
  M6:    {D:6,  P:1,   clear:6.6, tap:5.2, ins:0,  insD:0,   csk:12.4,cap:10,  capH:6,  nut:10, nutH:5.2},
  M8:    {D:8,  P:1.25,clear:8.6, tap:7,   ins:0,  insD:0,   csk:16.4,cap:13,  capH:8,  nut:13, nutH:6.8},
  M10:   {D:10, P:1.5, clear:10.8,tap:8.8, ins:0,  insD:0,   csk:20.4,cap:16,  capH:10, nut:16, nutH:8.4},
  M12:   {D:12, P:1.75,clear:13,  tap:10.5,ins:0,  insD:0,   csk:24.4,cap:18,  capH:12, nut:18, nutH:10.8}
};
const HOLE_TYPES={clear:'Clearance (screw slides through)',thread:'Threaded (a real thread)',tap:'Tapped (screw cuts its own thread)',ins:'Heat-set insert',csk:'Countersunk (flat-head screw)',cbore:'Counterbored (cap-head screw)',nut:'Nut trap (hex pocket + hole)'};
let holeSet=(()=>{try{return Object.assign({size:'M3',type:'clear',through:true,depth:6},JSON.parse(store.get('hole')||'{}'));}catch(e){return {size:'M3',type:'clear',through:true,depth:6};}})();
// What gets cut, from the face inwards: [{d: diameter, from, to (depth into the part), hex?, cone?:[d at from, d at to]}]
function holeParts(){
  const H=HOLE_SIZES[holeSet.size],t=holeSet.type,deep=holeSet.through?null:holeSet.depth,parts=[];
  if(t==='ins'){
    if(!H.ins)return {parts,none:true,text:'No standard heat-set insert size for '+holeSet.size+' here: choose Threaded, or a nut trap.'};
    const dd=holeSet.through?H.insD:holeSet.depth;parts.push({d:H.ins,to:dd});return {parts,text:'Insert hole Ø'+H.ins+' mm, '+dd+' mm deep'+(holeSet.through?' (for an '+holeSet.size+' insert)':'')};}
  if(t==='thread'){
    // ISO metric thread, made 0.3 mm bigger across (printed threads need a little room), with a 45° lead-in at the mouth
    const c=0.15,Rmaj=H.D/2+c,Rmin=(H.D-1.0825*H.P)/2+c;
    parts.push({thread:{Rmaj,Rmin,P:H.P},to:deep,d:H.D});
    parts.push({cone:[2*(Rmaj+0.3),2*Rmin],to:Rmaj+0.3-Rmin});
    return {parts,text:holeSet.size+' × '+H.P+' thread, '+(deep?deep+' mm deep':'right through')+(H.D<6?'. Threads this small are hard to print well: a heat-set insert or a tapped hole is stronger.':'')};
  }
  const main=t==='tap'?H.tap:H.clear;
  parts.push({d:main,to:deep});
  let text=(t==='tap'?'Pilot hole Ø':'Hole Ø')+main+' mm, '+(deep?deep+' mm deep':'right through');
  if(t==='csk'){const h=(H.csk-main)/2;parts.push({cone:[H.csk,main],to:h});text+=', countersink Ø'+H.csk+' mm';}
  if(t==='cbore'){const d=+(H.cap+0.6).toFixed(1),h=+(H.capH+0.3).toFixed(1);parts.push({d,to:h});text+=', counterbore Ø'+d+' × '+h+' mm deep';}
  if(t==='nut'){const af=+(H.nut+0.3).toFixed(1),h=+(H.nutH+0.3).toFixed(1);parts.push({d:af,hex:true,to:h});text+=', nut pocket '+af+' mm across flats × '+h+' mm deep';}
  return {parts,text};
}
// The space a screw takes up, as a solid along +Z from 0 to h (mm): its outline at any height is the ISO thread
// profile wrapped once round, and twisting that outline one turn per pitch as it rises makes the spiral (right-handed).
function threadCutter(w,K,{Rmaj,Rmin,P},h){
  const prof=u=>{u=((u%P)+P)%P;// distance along the axis within one pitch -> radius
    if(u<P/8)return Rmaj;if(u<7*P/16)return Rmaj-(Rmaj-Rmin)*(u-P/8)/(5*P/16);
    if(u<11*P/16)return Rmin;return Rmin+(Rmaj-Rmin)*(u-11*P/16)/(5*P/16);};
  const N=Math.max(36,Math.min(72,Math.round(Rmaj*12))),poly=[];
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2,r=prof(-a/(2*Math.PI)*P);poly.push([r*Math.cos(a),r*Math.sin(a)]);}
  return K(w.Manifold.extrude([poly],h,Math.ceil(h/P*12),360*h/P));
}
const holePanel=document.createElement('div');holePanel.id='holePanel';holePanel.className='panel';$('view').appendChild(holePanel);
holePanel.innerHTML=`<h3 style="margin:0 0 6px">Hole</h3>
<label>Screw size<select data-h="size">${Object.keys(HOLE_SIZES).map(k=>`<option>${k}</option>`).join('')}</select></label>
<label>Kind of hole<select data-h="type">${Object.entries(HOLE_TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
<label class="chk"><input type="checkbox" data-h="through"> <span class="thr">Right through</span></label>
<label class="dep">Depth (mm)<input data-h="depth" type="number" min="0.5" step="0.5"></label>
<div class="sizes"></div>
<div class="note">Then click on a face where the hole goes: it is drilled straight in. Snap to a guide point or midpoint for an exact place.</div>`;
function syncHolePanel(){
  const q=k=>holePanel.querySelector('[data-h='+k+']');
  q('size').value=holeSet.size;q('type').value=holeSet.type;q('through').checked=holeSet.through;q('depth').value=holeSet.depth;
  holePanel.querySelector('.thr').textContent=holeSet.type==='ins'?'Standard depth for the insert':'Right through';
  holePanel.querySelector('.dep').style.display=holeSet.through?'none':'block';
  holePanel.querySelector('.sizes').textContent=holeParts().text;
}
holePanel.addEventListener('input',e=>{
  const t=e.target,k=t.dataset.h;
  if(k==='size'||k==='type')holeSet[k]=t.value;else if(k==='through')holeSet.through=t.checked;else if(k==='depth'){const x=parseFloat(t.value);if(x>0)holeSet.depth=x;}
  store.set('hole',JSON.stringify(holeSet));syncHolePanel();if(tool.move&&lastE)tool.move(lastE,lastM);
});
holePanel.addEventListener('keydown',e=>e.stopPropagation());
tools.hole=()=>{
  let cur=null;
  holePanel.style.display='block';syncHolePanel();
  const t={label:'Depth',hint:'Pick the screw size and kind of hole in the panel, then click on a face where the hole goes · type a depth and Enter (or 0 for right through)',
    move(e,m){
      cur=inferPoint(m.x,m.y);setMarker(cur);preview.lines=[];
      if(!cur||!cur.face)return;
      const n=faceNormal(cur.face),[u,v]=basis(n),col=[0.9,0.2,0.1],{parts}=holeParts();
      const D=Math.max(...parts.map(p=>p.cone?p.cone[0]:p.d))/2000,N=parts.some(p=>p.hex&&p.d/2000===D)?6:32;
      const ring=[];for(let i=0;i<N;i++){const a=i/N*Math.PI*2;ring.push(add(cur.p,add(mul(u,Math.cos(a)*D),mul(v,Math.sin(a)*D))));}
      preview.lines=ring.map((p,i)=>[p,ring[(i+1)%N],col]);preview.lines.push([cur.p,add(cur.p,mul(n,-D)),col]);
    },
    async down(e,m){
      if(!cur||!cur.face)return flash('Click on a face of your model where the hole should go');
      const face=cur.face,p=cur.p,n=faceNormal(face),ids=componentOf(face.id),F=model.faces.filter(f=>ids.has(f.id)),snapF=clone(model.faces);
      const {parts,text,none}=holeParts();if(none)return flash(text,6000);
      // right through: as far as the part reaches behind the face, plus a little
      const through=(dot(n,p)-Math.min(...F.flatMap(f=>f.pts).map(v=>dot(n,v))))*1000+1;
      flash('Drilling…',8000);preview.lines=[];
      // Build the mesh on the main thread (fast — no WASM), then hand the heavy Manifold
      // boolean work to the geo worker so the UI stays responsive the whole time.
      const mesh=buildMesh(false,F);
      if(mesh.open){flash('That shape isn\'t a closed solid, so a hole can\'t be cut in it: Check Model shows the gaps',6000);return;}
      const th=Math.acos(clamp(n[2],-1,1))*180/Math.PI,ph=Math.atan2(n[1],n[0])*180/Math.PI;
      const S=1000;
      const col=(F.find(f=>f.color)||{}).color||null,flat=flatPlanes(F);
      for(const q of parts)if(q.to!=null&&!q.cone)flat.push({n,d:dot(n,p)-q.to/1000,color:col});
      const gid=face.g||null;
      try{
        // Off-thread: solidOf → threadCutter / cutter geometry → boolean subtract
        const result=await window.WFEnclosure._runInGeoWorker({
          type:'drill',
          bodyVerts:mesh.verts,
          bodyTris:mesh.tris.map(t=>[t[0],t[1],t[2]]),
          parts:parts.map(q=>({thread:q.thread||null,cone:q.cone||null,d:q.d||null,hex:!!q.hex,to:q.to??null})),
          through,
          pos:[p[0]*S,p[1]*S,p[2]*S],
          rotation:[th,ph]
        });
        // Back on the main thread: reconstruct polygon faces from the returned triangle mesh
        const{T,P,numProp}=result;
        const pts=[];for(let i=0;i<P.length;i+=numProp)pts.push([P[i]/S,P[i+1]/S,P[i+2]/S]);
        const tris=[];for(let i=0;i<T.length;i+=3)tris.push([pts[T[i]],pts[T[i+1]],pts[T[i+2]]]);
        const nf=facesFromTriangles(tris);
        for(const f of nf){
          if(gid)f.g=gid;const fn=faceNormal(f);
          const h=flat.find(h=>dot(h.n,fn)>0.9999&&Math.abs(dot(h.n,f.pts[0])-h.d)<1e-6);
          f.color=h&&h.color!==undefined?h.color:col;if(!h)f.soft=true;
        }
        model.faces=model.faces.filter(f=>!ids.has(f.id)).concat(nf);
        pushUndo(snapshot(snapF,model.edges),'Hole ('+holeSet.size+' '+({clear:'clearance',thread:'threaded',tap:'tapped',ins:'insert',csk:'countersunk',cbore:'counterbored',nut:'nut trap'})[holeSet.type]+')');
        selection.clear();selChanged();commitChange();flash(holeSet.size+': '+text,5000);
      }catch(er){console.error('EvenUCan: hole failed',er);model.faces=snapF;markDirty();flash('Could not drill the hole: '+(er&&er.message||er),6000);}
    },
    vcb(s){const L=parseLen(s);if(!(L>=0))return flash('Type a depth, e.g. 6 (or 0 for right through)');
      if(L===0)holeSet.through=true;else{holeSet.through=false;holeSet.depth=+(L*1000).toFixed(2);}
      store.set('hole',JSON.stringify(holeSet));syncHolePanel();flash(holeSet.through?'Right through':'Depth '+fmt(L));},
    cancel(){preview.lines=[];return false;}
  };
  return t;
};
// ---- (1.9.38) Box helpers: stand-offs for heat-set inserts, and ready-made mounts for common boards. All sizes in mm.
// Insert sizes: hole near the top of the usual range (printed holes come out a little small), depth = insert length + 1.0
// (M2-M3) or + 1.5 (M4-M5). Solid Wall rule: the wall round the hole is at least the hole's radius, so the stand-off is at
// least twice the hole wide.
const INSERTS={
  M2:    {hole:3.25,boss:6.5, add:1.0,lens:[3,4],       len:4,  range:[6.2,6.5]},
  'M2.5':{hole:3.7, boss:7.5, add:1.0,lens:[3.5,4,5.7], len:4,  range:[7.0,7.5]},
  M3:    {hole:4.1, boss:8.5, add:1.0,lens:[3,4,5,5.7,6],len:5.7,range:[8.0,9.0]},
  M4:    {hole:5.5, boss:11,  add:1.5,lens:[4,6,8.1],   len:8.1,range:[10.5,11.5]},
  M5:    {hole:6.5, boss:13,  add:1.5,lens:[6,8,9.5],   len:9.5,range:[12.5,13.5]}
};
const BOARD_INSERT_LEN={M2:3,'M2.5':4,M3:4,M4:6,M5:6};// short inserts keep board stand-offs low
const insertDepth=(s,len)=>+(len+INSERTS[s].add).toFixed(2);
const boardInsertDepth=s=>insertDepth(s,BOARD_INSERT_LEN[s]);
const minBoss=s=>+(2*INSERTS[s].hole).toFixed(2);
// a board's mounting hole -> the screw (and insert) it takes; holes under 1.95 mm are too small for any insert
const screwForHole=d=>!(d>=1.95)?null:d<2.45?'M2':d<2.95?'M2.5':d<3.7?'M3':d<4.7?'M4':'M5';
// Boards: L along x (the length), W along y, origin at the bottom-left corner. holes [x,y,dia]. Ports: side (xmin/xmax/ymin/ymax),
// u = centre along that side, pw x ph = the opening to cut, zc = its centre above the top of the board (the app's port sizes).
const BOARDS=[
  {id:'esp32s3',name:'ESP32-S3-DevKitC-1',L:62.74,W:25.4,pcb:1.6,below:8.5,holes:[],lib:'b-esp32s3',
    ports:[{kind:'2× USB-C',side:'xmin',u:12.7,pw:22,ph:8,zc:1.6}],src:'Espressif PCB drawing, ESP32-S3-DevKitC-1 v1.1 (no mounting holes)'},
  {id:'devkitc',name:'ESP32 DevKitC V4 (WROOM-32)',L:48.26,W:27.94,pcb:1.6,below:8.5,holes:[],
    ports:[{kind:'Micro-USB',side:'xmin',u:13.97,pw:10,ph:5,zc:1.5}],src:'Espressif ESP32-DevKitC V4 dimensions drawing (no mounting holes; the module\'s antenna sticks out 6 mm past the far end)'},
  {id:'c3mini',name:'ESP32-C3 SuperMini',L:22.52,W:18,pcb:1.0,below:3,holes:[],
    ports:[{kind:'USB-C',side:'xmin',u:9,pw:10,ph:4.5,zc:1.6}],src:'Maker\'s published drawing (NologoTech) - no official datasheet drawing; thickness not published'},
  {id:'xiao',name:'Seeed Studio XIAO ESP32 (C3 / S3 / C6)',L:21,W:17.8,pcb:1.2,below:3,holes:[],
    ports:[{kind:'USB-C',side:'xmin',u:8.9,pw:10,ph:4.5,zc:1.6}],src:'Seeed Studio wiki: 21 × 17.8 mm (thickness not published)'},
  {id:'uno',name:'Arduino Uno R3',L:68.58,W:53.34,pcb:1.6,below:3,holes:[[13.97,2.54,3.2],[15.24,50.8,3.2],[66.04,7.62,3.2],[66.04,35.56,3.2]],
    ports:[{kind:'USB-B',side:'xmin',u:38.1,pw:13.5,ph:12,zc:5.5,approx:true}],src:'Arduino Uno R3 board files (hole positions); USB position approximate'},
  {id:'nano',name:'Arduino Nano',L:43.18,W:17.78,pcb:1.6,below:8.5,holes:[[1.27,1.27,1.8],[41.91,1.27,1.8],[1.27,16.51,1.8],[41.91,16.51,1.8]],lib:'p-cm-nano',
    ports:[{kind:'Mini-USB',side:'xmin',u:8.89,pw:9,ph:5,zc:2}],src:'Arduino Nano PCB guide (docs.arduino.cc); 1.8 mm holes are too small for inserts, so it gets a cradle'},
  {id:'pico',name:'Raspberry Pi Pico / Pico W',L:51,W:21,pcb:1.0,below:3,holes:[[2,4.8,2.1],[2,16.2,2.1],[49,4.8,2.1],[49,16.2,2.1]],
    ports:[{kind:'Micro-USB',side:'xmin',u:10.5,pw:9,ph:4,zc:1.5}],src:'Raspberry Pi Pico datasheet (51 × 21 mm, 2.1 mm holes on 47 × 11.4 mm)'},
  {id:'pi4',name:'Raspberry Pi 4 Model B',L:85,W:56,pcb:1.4,below:3,holes:[[3.5,3.5,2.7],[61.5,3.5,2.7],[3.5,52.5,2.7],[61.5,52.5,2.7]],lib:'p-cm-rpi4',
    ports:[{kind:'USB-C power',side:'ymin',u:11.2,pw:10,ph:4.5,zc:2}],src:'Raspberry Pi 4 mechanical drawing (same holes and outline as the Pi 5)'},
  {id:'pi5',name:'Raspberry Pi 5',L:85,W:56,pcb:1.4,below:3,holes:[[3.5,3.5,2.7],[61.5,3.5,2.7],[3.5,52.5,2.7],[61.5,52.5,2.7]],
    ports:[{kind:'USB-C power',side:'ymin',u:11.2,pw:10,ph:4.5,zc:2}],src:'Raspberry Pi 5 mechanical drawing'},
  {id:'zero2w',name:'Raspberry Pi Zero 2 W',L:65,W:30,pcb:1.4,below:3,holes:[[3.5,3.5,2.75],[61.5,3.5,2.75],[3.5,26.5,2.75],[61.5,26.5,2.75]],
    ports:[{kind:'Micro-USB power',side:'ymin',u:54,pw:9,ph:4,zc:1.5}],src:'Raspberry Pi Zero 2 W mechanical drawing'},
  {id:'d1mini',name:'Wemos / LOLIN D1 mini',L:34.2,W:25.6,pcb:1.0,below:8.5,holes:[],
    ports:[{kind:'USB (Type-C on v4, Micro on older)',side:'xmin',u:12.8,pw:10,ph:5,zc:1.6,approx:true}],src:'wemos.cc: 34.2 × 25.6 mm (no mounting holes; USB position approximate)'}
];
// Boards in the Parts Library that aren't in the list above (your own boards too) can be mounted the same way.
function allBoards(){
  const out=BOARDS.slice(),have=new Set(BOARDS.map(b=>b.lib).filter(Boolean));
  let lib=[];try{lib=window.WFEnclosure&&WFEnclosure.parts?WFEnclosure.parts():[];}catch(e){lib=[];}
  for(const p of lib){
    if(!p||p.type!=='board'||!(p.pcb>0)||have.has(p.id))continue;
    const F=p.features||[];
    out.push({id:'lib:'+p.id,name:p.name,L:+p.w,W:+p.d,pcb:+p.pcb,below:Math.max(+p.below||0,2),fromLib:true,
      holes:F.filter(f=>f.t==='hole').map(f=>[+f.x,+f.y,+f.dia]),
      ports:F.filter(f=>f.t==='port').map(f=>({kind:f.kind||'Port',side:f.side,u:+f.u,pw:+f.pw||10,ph:+f.ph||5,zc:+f.zc||2})),src:'Your Parts Library'});
  }
  return out;
}
const SIDE_WORD={xmin:'left short end',xmax:'right short end',ymin:'front long edge',ymax:'back long edge'};
// The face's own frame: +Z out of the face, ex/ey along it (the same turn the solid engine gets), optionally turned 90°.
function bhFrame(n,rot){
  const th=Math.acos(clamp(n[2],-1,1)),ph=Math.atan2(n[1],n[0]);
  let ex=[Math.cos(th)*Math.cos(ph),Math.cos(th)*Math.sin(ph),-Math.sin(th)],ey=[-Math.sin(ph),Math.cos(ph),0];
  if(rot){const t=ex;ex=ey;ey=mul(t,-1);}
  return {th:th*180/Math.PI,ph:ph*180/Math.PI,ex,ey,n,rot:!!rot};
}
const bhW=(F,p,a,b,z)=>add(p,mul(add(add(mul(F.ex,a),mul(F.ey,b)),mul(F.n,z||0)),0.001));
// Adds what make() builds (in mm, face frame) to the part that was clicked (join) or as its own grouped object.
async function bhCommit(face,p,make,undoName,o){
  if(!window.WFEnclosure)return {err:'The solid engine is not available'};
  const n=faceNormal(face),F=bhFrame(n,o.rot),S=1000,join=o.join!==false;
  const ids=join?componentOf(face.id):new Set(),PF=model.faces.filter(f=>ids.has(f.id)),snapF=clone(model.faces);
  const w=await WFEnclosure.engine(),M=w.Manifold,pool=[],K=x=>{pool.push(x);return x;};
  try{
    const L=make(M,K,join?-0.3:0);
    const place=s=>{let q=s;if(F.rot)q=K(q.rotate([0,0,90]));return K(K(q.rotate([0,F.th,F.ph])).translate([p[0]*S,p[1]*S,p[2]*S]));};
    let out=place(L.add);
    if(join){const body=solidOf(w,K,PF);if(!body)return {err:'That shape isn\'t a closed solid, so nothing can be joined to it: Check Model shows the gaps'};out=K(body.add(out));}
    if(L.sub)out=K(out.subtract(place(L.sub)));
    if(L.cut&&join)out=K(out.subtract(place(L.cut)));
    if(out.isEmpty())throw new Error('nothing would be left');
    const col=join?((PF.find(f=>f.color)||{}).color||null):null,flat=join?flatPlanes(PF):[];
    const ax={x:F.ex,y:F.ey,z:F.n};
    for(const [a,s,v] of L.planes){const e=ax[a],d=dot(e,p)+v/1000;flat.push(s>0?{n:e,d,color:col}:{n:mul(e,-1),d:-d,color:col});}
    const nf=facesOfSolid(out,flat,col,join?(face.g||null):nid());
    model.faces=model.faces.filter(f=>!ids.has(f.id)).concat(nf);
    pushUndo(snapshot(snapF,model.edges),undoName);selection.clear();selChanged();commitChange();
    return {faces:nf,frame:F};
  }catch(er){console.error('EvenUCan: '+undoName+' failed',er);model.faces=snapF;markDirty();return {err:er.message};}
  finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
}
const boxPlanes=(x0,y0,x1,y1)=>[['x',1,x1],['x',-1,x0],['y',1,y1],['y',-1,y0]];
// ---------- Stand-off tool
let soSet=(()=>{const d={size:'M3',len:5.7,custom:false,h:8,boss:8.5};try{return Object.assign(d,JSON.parse(store.get('standoff')||'{}'));}catch(e){return d;}})();
if(!INSERTS[soSet.size])soSet.size='M3';
function soCheck(s=soSet){
  const I=INSERTS[s.size],dep=insertDepth(s.size,s.len),wall=(s.boss-I.hole)/2,needBoss=minBoss(s.size),needH=+(dep+0.6).toFixed(1),probs=[];
  if(wall<I.hole/2-1e-9)probs.push('The wall round the hole would be only '+(+wall.toFixed(2))+' mm thick. It should be at least '+(+(I.hole/2).toFixed(2))+' mm (half the hole), or the plastic can split when the hot insert goes in.');
  if(s.h<needH-1e-9)probs.push('The insert hole is '+dep+' mm deep, so the stand-off needs to be at least '+needH+' mm tall.');
  const info=s.size+' insert: hole '+I.hole+' mm, '+dep+' mm deep, stand-off '+(+s.boss.toFixed(2))+' mm wide, '+(+s.h.toFixed(2))+' mm tall';
  const tip=(s.boss<I.range[0]||s.boss>I.range[1])&&!probs.length?'(The usual width for '+s.size+' is '+I.range[0]+' to '+I.range[1]+' mm.)':'';
  return {I,dep,needBoss,needH,probs,info,tip};
}
const standoffPanel=document.createElement('div');standoffPanel.id='standoffPanel';standoffPanel.className='panel';$('view').appendChild(standoffPanel);
standoffPanel.innerHTML=`<h3 style="margin:0 0 6px">Stand-off for a heat-set insert</h3>
<label>Screw size<select data-s="size">${Object.keys(INSERTS).map(k=>`<option>${k}</option>`).join('')}</select></label>
<label>Insert length<select data-s="len"></select></label>
<label class="cus">Your insert length (mm)<input data-s="clen" type="number" min="1" max="30" step="0.1"></label>
<label>Height above the face (mm)<input data-s="h" type="number" min="1" max="200" step="0.5"></label>
<label>Stand-off width (mm)<input data-s="boss" type="number" min="2" max="60" step="0.1"></label>
<div class="sizes"></div><div class="warn"></div><button type="button" class="fix">Fix it</button>
<div class="note">Then click a face, such as the floor of your box: a round post with the insert hole in its top is joined to that part.</div>`;
function syncStandoffPanel(){
  const q=k=>standoffPanel.querySelector('[data-s='+k+']'),I=INSERTS[soSet.size];
  q('size').value=soSet.size;
  q('len').innerHTML=I.lens.map(l=>`<option value="${l}">${l} mm${l===I.len?' (usual)':''}</option>`).join('')+'<option value="c">Other length...</option>';
  q('len').value=soSet.custom||!I.lens.includes(soSet.len)?'c':String(soSet.len);
  standoffPanel.querySelector('.cus').style.display=q('len').value==='c'?'block':'none';q('clen').value=soSet.len;
  q('h').value=soSet.h;q('boss').value=soSet.boss;
  const c=soCheck();standoffPanel.querySelector('.sizes').textContent=c.info+(c.tip?' '+c.tip:'');
  const wn=standoffPanel.querySelector('.warn'),fx=standoffPanel.querySelector('.fix');
  wn.textContent=c.probs.join(' ');wn.style.display=c.probs.length?'block':'none';fx.style.display=c.probs.length?'block':'none';
  fx.textContent='Fix it: '+[soSet.boss<c.needBoss-1e-9?'make it '+Math.max(c.needBoss,I.boss)+' mm wide':'',soSet.h<c.needH-1e-9?'make it '+c.needH+' mm tall':''].filter(Boolean).join(' and ');
}
function soFix(){const c=soCheck(),I=INSERTS[soSet.size];if(soSet.boss<c.needBoss-1e-9)soSet.boss=Math.max(c.needBoss,I.boss);if(soSet.h<c.needH-1e-9)soSet.h=c.needH;store.set('standoff',JSON.stringify(soSet));syncStandoffPanel();}
standoffPanel.addEventListener('change',e=>{
  const t=e.target,k=t.dataset.s;if(!k)return;
  if(k==='size'){const I=INSERTS[t.value];soSet.size=t.value;soSet.len=I.len;soSet.custom=false;soSet.boss=I.boss;const need=+(insertDepth(t.value,I.len)+0.6).toFixed(1);if(soSet.h<need)soSet.h=Math.ceil(need);}
  else if(k==='len'){if(t.value==='c')soSet.custom=true;else{soSet.custom=false;soSet.len=+t.value;}}
  else{const x=parseFloat(t.value);if(x>0){if(k==='clen')soSet.len=x;else soSet[k]=x;}}
  store.set('standoff',JSON.stringify(soSet));syncStandoffPanel();
});
standoffPanel.querySelector('.fix').onclick=soFix;
standoffPanel.addEventListener('keydown',e=>e.stopPropagation());
async function placeStandoff(face,p,s=soSet){
  const c=soCheck(s);if(c.probs.length)return {err:'Fix the size first: '+c.probs[0]};
  const r=s.boss/2,hr=c.I.hole/2,h=s.h,dep=c.dep;
  const res=await bhCommit(face,p,(M,K,z0)=>({add:K(M.cylinder(h-z0,r,r,48).translate([0,0,z0])),
    sub:K(M.cylinder(dep+0.3,hr,hr,48).translate([0,0,h-dep])),planes:[['z',1,h],['z',1,h-dep]]}),'Stand-off ('+s.size+' insert)',{join:true});
  if(!res.err)res.info=c.info;
  return res;
}
const bhRing=(F,p,a,b,z,r,col,N=32)=>{const R=[];for(let i=0;i<N;i++){const t=i/N*Math.PI*2;R.push(bhW(F,p,a+r*Math.cos(t),b+r*Math.sin(t),z));}return R.map((q,i)=>[q,R[(i+1)%N],col]);};
tools.standoff=()=>{
  let cur=null;standoffPanel.style.display='block';syncStandoffPanel();
  return {label:'',hint:'Pick the screw size, insert length and height in the panel, then click a face (such as the box floor) where the stand-off goes',
    move(e,m){cur=inferPoint(m.x,m.y);setMarker(cur);preview.lines=[];if(!cur||!cur.face)return;
      const F=bhFrame(faceNormal(cur.face)),c=soCheck(),col=c.probs.length?[0.9,0.2,0.1]:[0.44,0.28,0.91];
      preview.lines=[...bhRing(F,cur.p,0,0,0,soSet.boss/2,col),...bhRing(F,cur.p,0,0,soSet.h,soSet.boss/2,col),...bhRing(F,cur.p,0,0,soSet.h,c.I.hole/2,col),[cur.p,bhW(F,cur.p,0,0,soSet.h),col]];},
    async down(){
      if(!cur||!cur.face)return flash('Click on a face of your model, such as the floor of your box');
      const face=cur.face,p=cur.p;preview.lines=[];flash('Adding the stand-off…',8000);
      const r=await placeStandoff(face,p);
      flash(r.err?'Could not add the stand-off: '+r.err:r.info+'. Added and joined to the part.',r.err?7000:5000);},
    cancel(){preview.lines=[];return false;}};
};
// ---------- Board mount tool
let bmSet=(()=>{const d={id:'esp32s3',below:null,join:false,ghost:true,port:false,rot:false};try{return Object.assign(d,JSON.parse(store.get('boardmount')||'{}'));}catch(e){return d;}})();
const bmBoard=(id=bmSet.id)=>allBoards().find(b=>b.id===id)||BOARDS[0];
// What gets built, in board terms (origin at the board's centre, mm). Plate 1.2 mm; the board sits zB above the face.
function boardPlan(B,o={}){
  const T=1.2,below=o.below!=null?o.below:B.below,holes=B.holes.map(([x,y,d])=>({x:x-B.L/2,y:y-B.W/2,d,s:screwForHole(d)})).filter(h=>h.s);
  const kind=holes.length>=2?'standoffs':'cradle';let zB=T+below,raised=false;
  if(kind==='standoffs'){const need=Math.max(...holes.map(h=>boardInsertDepth(h.s)))+0.6;if(zB<need){zB=+need.toFixed(2);raised=true;}}
  return {T,below,holes,kind,zB:+zB.toFixed(2),raised,gap:0.3,rail:1.6};
}
function boardText(B,P){
  const pt=B.ports[0],sizes=[...new Set(P.holes.map(h=>h.s))];
  let t=B.L+' × '+B.W+' mm board, '+B.pcb+' mm thick. ';
  if(P.kind==='standoffs')t+=P.holes.length+' stand-offs for '+sizes.join('/')+' heat-set inserts ('+sizes.map(s=>'hole '+INSERTS[s].hole+' mm, '+boardInsertDepth(s)+' mm deep, '+INSERTS[s].boss+' mm wide').join('; ')+') on a thin base. ';
  else t+=(B.holes.length?'Its holes are too small for inserts, so it gets':'No mounting holes, so it gets')+' a cradle: a base with side rails, ledges under the ends and a 0.3 mm gap all round. ';
  t+='The board sits '+P.zB+' mm above the face'+(P.raised?' (raised so the inserts fit)':'')+'. ';
  if(pt)t+='USB: '+pt.kind+' on the '+SIDE_WORD[pt.side]+' (orange in the outline): that is where the cut-out goes'+(pt.approx?' (position approximate: check it against your board)':'')+'.';
  return t;
}
const boardPanel=document.createElement('div');boardPanel.id='boardPanel';boardPanel.className='panel';$('view').appendChild(boardPanel);
boardPanel.innerHTML=`<h3 style="margin:0 0 6px">Board mount</h3>
<label>Board<select data-b="id"></select></label>
<label>Room under the board for pins (mm)<input data-b="below" type="number" min="0" max="40" step="0.5"></label>
<label class="chk"><input type="checkbox" data-b="join"> Join it to the part I click</label>
<label class="chk"><input type="checkbox" data-b="ghost"> Show the board as a see-through outline</label>
<label class="chk"><input type="checkbox" data-b="port"> Also cut the USB opening in the box wall</label>
<button type="button" class="turn">Turn 90°</button>
<div class="sizes"></div><div class="note src"></div>
<div class="note">Then click the floor of your box where the middle of the board should go.</div>`;
function syncBoardPanel(){
  const q=k=>boardPanel.querySelector('[data-b='+k+']'),all=allBoards(),B=bmBoard();bmSet.id=B.id;
  const own=all.filter(b=>!b.fromLib),lib=all.filter(b=>b.fromLib),opt=b=>`<option value="${b.id.replace(/"/g,'&quot;')}">${b.name.replace(/[&<]/g,c=>c==='&'?'&amp;':'&lt;')}</option>`;
  q('id').innerHTML=`<optgroup label="Common boards">${own.map(opt).join('')}</optgroup>`+(lib.length?`<optgroup label="From your Parts Library">${lib.map(opt).join('')}</optgroup>`:'');
  q('id').value=B.id;q('below').value=bmSet.below!=null?bmSet.below:B.below;
  q('join').checked=!!bmSet.join;q('ghost').checked=!!bmSet.ghost;q('port').checked=!!bmSet.port;q('port').disabled=!bmSet.join||!B.ports.length;
  boardPanel.querySelector('.sizes').textContent=boardText(B,boardPlan(B,{below:bmSet.below}));
  boardPanel.querySelector('.src').textContent='Sizes from: '+B.src+'.'+(bmSet.join?'':' It is made as its own object that moves as one; tick "Join" (or press U later) to make it part of the box.');
}
boardPanel.addEventListener('change',e=>{
  const t=e.target,k=t.dataset.b;if(!k)return;
  if(k==='id'){bmSet.id=t.value;bmSet.below=null;}else if(k==='below'){const x=parseFloat(t.value);if(x>=0)bmSet.below=x;}else{bmSet[k]=t.checked;if(k==='join'&&!t.checked)bmSet.port=false;}
  store.set('boardmount',JSON.stringify(bmSet));syncBoardPanel();
});
boardPanel.querySelector('.turn').onclick=()=>{bmSet.rot=!bmSet.rot;store.set('boardmount',JSON.stringify(bmSet));flash(bmSet.rot?'Board turned 90°':'Board turned back');};
boardPanel.addEventListener('keydown',e=>e.stopPropagation());
// Outline lines (world) for the preview and the see-through ghost.
function boardLines(B,P,F,p,z){
  const g=[0.12,0.62,0.3],o=[1,0.5,0],L2=B.L/2,W2=B.W/2,c=[[-L2,-W2],[L2,-W2],[L2,W2],[-L2,W2]],out=[];
  for(const zz of z==null?[P.zB,P.zB+B.pcb]:[z])for(let i=0;i<4;i++)out.push([bhW(F,p,...c[i],zz),bhW(F,p,...c[(i+1)%4],zz),g]);
  if(z==null)for(const q of c)out.push([bhW(F,p,...q,P.zB),bhW(F,p,...q,P.zB+B.pcb),g]);
  const zt=z==null?P.zB+B.pcb:z;
  for(const h of P.holes)out.push(...bhRing(F,p,h.x,h.y,zt,h.d/2,g,16));
  const pt=B.ports[0];
  if(pt){const s=pt.side,ax=s[0]==='x',sg=s.endsWith('max')?1:-1,u0=pt.u-pt.pw/2,u1=pt.u+pt.pw/2;
    const at=uu=>ax?[sg*L2,uu-W2]:[uu-L2,sg*W2],a=at(u0),b=at(u1),m=at(pt.u),tip=ax?[m[0]+sg*6,m[1]]:[m[0],m[1]+sg*6];
    out.push([bhW(F,p,...a,zt),bhW(F,p,...b,zt),o],[bhW(F,p,...m,zt),bhW(F,p,...tip,zt),o]);}
  return out;
}
async function placeBoard(face,p,id=bmSet.id,o=bmSet){
  const B=bmBoard(id),P=boardPlan(B,{below:o.below}),join=!!o.join,lines=[];
  const res=await bhCommit(face,p,(M,K,z0)=>{
    const box=(x0,y0,x1,y1,za,zb)=>K(M.cube([x1-x0,y1-y0,zb-za]).translate([x0,y0,za]));
    const parts=[],planes=[['z',1,P.T]];let sub=null,cut=null;if(z0===0)planes.push(['z',-1,0]);
    const L2=B.L/2,W2=B.W/2;
    if(P.kind==='standoffs'){
      const m=Math.max(...P.holes.map(h=>INSERTS[h.s].boss/2)),xs=P.holes.map(h=>h.x),ys=P.holes.map(h=>h.y);
      const x0=Math.min(...xs)-m,x1=Math.max(...xs)+m,y0=Math.min(...ys)-m,y1=Math.max(...ys)+m;
      parts.push(box(x0,y0,x1,y1,z0,P.T));planes.push(...boxPlanes(x0,y0,x1,y1),['z',1,P.zB]);
      for(const h of P.holes){const I=INSERTS[h.s],dep=boardInsertDepth(h.s);
        parts.push(K(M.cylinder(P.zB-z0,I.boss/2,I.boss/2,48).translate([h.x,h.y,z0])));
        const c=K(M.cylinder(dep+0.3,I.hole/2,I.hole/2,48).translate([h.x,h.y,P.zB-dep]));sub=sub?K(sub.add(c)):c;planes.push(['z',1,P.zB-dep]);}
    }else{
      // rails along the long sides, short corner stubs at the ends (the USB end stays open), ledges under the two ends
      const long=B.L>=B.W,g=P.gap,r=P.rail,top=P.zB+B.pcb+1,A=long?L2:W2,Bw=long?W2:L2;
      const usbSide=B.ports[0]&&B.ports[0].side,endUsb=sg=>usbSide===(long?(sg>0?'xmax':'xmin'):(sg>0?'ymax':'ymin'));
      const bx=(a0,b0,a1,b1,za,zb)=>{const [x0,y0,x1,y1]=long?[a0,b0,a1,b1]:[b0,a0,b1,a1];planes.push(...boxPlanes(x0,y0,x1,y1));return box(x0,y0,x1,y1,za,zb);};
      const oa=A+g+r,ob=Bw+g+r;
      parts.push(bx(-oa,-ob,oa,ob,z0,P.T));
      for(const s of [-1,1])parts.push(bx(-oa,s>0?Bw+g:-ob,oa,s>0?ob:-Bw-g,z0,top));
      for(const s of [-1,1]){const st=endUsb(s)?2.5:Math.min(4,Bw*0.4);
        for(const t of [-1,1])parts.push(bx(s>0?A+g:-oa,t>0?Bw+g-st:-Bw-g,s>0?oa:-A-g,t>0?Bw+g:-Bw-g+st,z0,top));
        const lw=Bw-3.5>2?Bw-3.5:2;parts.push(bx(s>0?A-2.5:-A,-lw,s>0?A:-A+2.5,lw,z0,P.zB));}
      planes.push(['z',1,P.zB],['z',1,top]);
    }
    const pt=B.ports[0];
    if(o.port&&join&&pt){const s=pt.side,ax=s[0]==='x',sg=s.endsWith('max')?1:-1,zc=P.zB+B.pcb+pt.zc,start=(ax?L2:W2)+P.gap+P.rail+0.2;
      const uc=pt.u-(ax?W2:L2);
      cut=ax?box(sg>0?start:-start-100,uc-pt.pw/2,sg>0?start+100:-start,uc+pt.pw/2,zc-pt.ph/2,zc+pt.ph/2)
            :box(uc-pt.pw/2,sg>0?start:-start-100,uc+pt.pw/2,sg>0?start+100:-start,zc-pt.ph/2,zc+pt.ph/2);}
    let add=parts[0];for(const q of parts.slice(1))add=K(add.add(q));
    return {add,sub,cut,planes};
  },'Board mount ('+B.name+')',{join,rot:o.rot});
  if(!res.err){res.plan=P;res.board=B;if(o.ghost){lines.push(...boardLines(B,P,res.frame,p));setGhosts(lines,res.faces);}}
  return res;
}
tools.boardmount=()=>{
  let cur=null;boardPanel.style.display='block';syncBoardPanel();
  return {label:'',hint:'Pick your board in the panel, then click the floor of your box where the middle of the board should go (Turn 90° in the panel turns it)',
    move(e,m){cur=inferPoint(m.x,m.y);setMarker(cur);preview.lines=[];if(!cur||!cur.face)return;
      const B=bmBoard(),P=boardPlan(B,{below:bmSet.below});preview.lines=boardLines(B,P,bhFrame(faceNormal(cur.face),bmSet.rot),cur.p,0);},
    async down(){
      if(!cur||!cur.face)return flash('Click on the floor of your box (or any flat face) where the board should go');
      const face=cur.face,p=cur.p;preview.lines=[];flash('Making the board mount…',8000);
      const r=await placeBoard(face,p);
      flash(r.err?'Could not make the board mount: '+r.err:'Board mount for the '+r.board.name+' added. '+boardText(r.board,r.plan),r.err?7000:9000);},
    cancel(){preview.lines=[];return false;}};
};
// ---- Make Lid panel (like holePanel): click top face of ANY box to get a matching lid
let lidOpts=(()=>{try{return Object.assign({wall:2,floor:1.5,type:'snap'},JSON.parse(store.get('lid')||'{}'));}catch(e){return {wall:2,floor:1.5,type:'snap'};}})();
const lidPanel=document.createElement('div');lidPanel.id='lidPanel';lidPanel.className='panel';$('view').appendChild(lidPanel);
lidPanel.innerHTML=`<h3 style="margin:0 0 6px">Lid</h3>
<label>Wall (mm)<input data-l="wall" type="number" min="1" max="5" step="0.5"></label>
<label>Lid plate (mm)<input data-l="floor" type="number" min="1" max="4" step="0.5"></label>
<label>Fit<select data-l="type"><option value="snap">Snap clips</option><option value="press">Plain press fit</option></select></label>
<div class="note">Then click the TOP face of the box you want a lid for.</div>`;
function syncLidPanel(){
  const q=k=>lidPanel.querySelector('[data-l='+k+']');
  q('wall').value=lidOpts.wall;q('floor').value=lidOpts.floor;q('type').value=lidOpts.type;
}
lidPanel.addEventListener('input',e=>{
  const t=e.target,k=t.dataset.l;if(!k)return;
  if(k==='wall'||k==='floor'){const x=parseFloat(t.value);if(x>0)lidOpts[k]=x;}
  else lidOpts[k]=t.value;
  store.set('lid',JSON.stringify(lidOpts));syncLidPanel();
});
lidPanel.addEventListener('keydown',e=>e.stopPropagation());
tools.makelid=()=>{
  lidPanel.style.display='block';syncLidPanel();
  const col=[0.4,0.6,0.9];
  // Returns all faces belonging to the same box as 'face'.
  // Uses group ID when available; falls back to componentOf filtered by the clicked face's XY footprint.
  const getBoxFaces=face=>{
    if(face.g!=null)return model.faces.filter(f=>f.g===face.g);
    const ids=componentOf(face.id);
    const allC=model.faces.filter(f=>ids.has(f.id));
    const fxs=face.pts.map(v=>v[0]),fys=face.pts.map(v=>v[1]);
    const fx0=Math.min(...fxs),fx1=Math.max(...fxs),fy0=Math.min(...fys),fy1=Math.max(...fys);
    const mx=Math.max((fx1-fx0)*0.5,0.015),my=Math.max((fy1-fy0)*0.5,0.015);
    return allC.filter(f=>{const vs=f.pts,cx=vs.reduce((s,v)=>s+v[0],0)/vs.length,cy=vs.reduce((s,v)=>s+v[1],0)/vs.length;return cx>=fx0-mx&&cx<=fx1+mx&&cy>=fy0-my&&cy<=fy1+my;});
  };
  return {
    label:'Lid',hint:'Click any face of your box — the lid will be sized to match it',
    move(e,m){
      const pt=inferPoint(m.x,m.y);setMarker(pt);preview.lines=[];
      if(!pt||!pt.face||pt.face.g==null)return;
      const F=model.faces.filter(f=>f.g===pt.face.g);
      if(!F.length)return;
      const vs=F.flatMap(f=>f.pts);
      const xs=vs.map(v=>v[0]),ys=vs.map(v=>v[1]),zs=vs.map(v=>v[2]);
      const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),z1=Math.max(...zs);
      if((x1-x0)*1000<4||(y1-y0)*1000<4)return;
      const c=[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
      preview.lines=c.map((p,i)=>[p,c[(i+1)%4],col]);
    },
    async down(e,m){
      const pt=inferPoint(m.x,m.y);
      if(!pt||!pt.face)return flash('Click a face of the box');
      const F=getBoxFaces(pt.face);
      if(F.length<4)return flash('Could not read the box — try clicking a different face');
      const vs=F.flatMap(f=>f.pts);
      const xs=vs.map(v=>v[0]),ys=vs.map(v=>v[1]),zs=vs.map(v=>v[2]);
      const x0=Math.min(...xs),x1=Math.max(...xs);
      const y0=Math.min(...ys),y1=Math.max(...ys);
      const z0=Math.min(...zs),z1=Math.max(...zs);
      const tw=Math.max(1,Math.min(5,lidOpts.wall));
      const lf=Math.max(1,Math.min(4,lidOpts.floor));
      // Outer dims (meters) → mm interior
      const W=(x1-x0)*1000-2*tw,D=(y1-y0)*1000-2*tw,H=(z1-z0)*1000-lf;
      if(W<4||D<4||H<2)return flash('Box too small — '+((x1-x0)*1000).toFixed(1)+'×'+((y1-y0)*1000).toFixed(1)+'×'+((z1-z0)*1000).toFixed(1)+' mm',6000);
      const st={wall:tw,floor:lf,lid:lidOpts.type==='press'?'press':'snap',groove:false,gasket:false,ears:false,...(pt.face.g==null?{corner_r:0}:{})};
      flash('Building lid for '+((x1-x0)*1000).toFixed(1)+'×'+((y1-y0)*1000).toFixed(1)+'×'+((z1-z0)*1000).toFixed(1)+' mm box…',8000);
      preview.lines=[];
      try{
        const EW=window.WFEnclosure;
        const L={W,D,H,st,items:[]};
        const r=await EW.buildSolids(L);
        // Manifold mm → WF world (m); lid placed next to box, printed flat on bed
        const midX=(x0+x1)/2,midY=(y0+y1)/2,gap=0.008;
        const off_x=(x1-x0)+gap;
        const lidT=p=>[midX+(p[0]-W/2)/1000+off_x,midY-(p[1]-D/2)/1000,z0+p[2]/1000];
        const mkTris=(mesh,T)=>{const o=[];for(let i=0;i<mesh.T.length;i+=3)o.push([T(mesh.P[mesh.T[i]]),T(mesh.P[mesh.T[i+1]]),T(mesh.P[mesh.T[i+2]])]);return o;};
        const lidFaces=facesFromTriangles(mkTris(r.lid,lidT));
        const gL=nid();
        for(const f of lidFaces){f.g=gL;f.color='#9fb8d6';}
        EW.softEdges(lidFaces);
        // Snap fit: cut the matching click slots into the existing box
        let boxCutOk=false;
        if(st.lid==='snap'){
          try{
            // Build a no-snap base to get a cutter solid: cutter = base_no_snap minus base_with_snap
            const rNS=await EW.buildSolids({W,D,H,st:{...st,lid:'press'},items:[]});
            // Transform: buildSolids mm (inner origin) → scene metres
            // scene = (x0+(mm+tw)/1000, y0+(mm+tw)/1000, z0+(mm+lf)/1000)
            const baseT=p=>[x0+(p[0]+tw)/1000,y0+(p[1]+tw)/1000,z0+(p[2]+lf)/1000];
            const cutterTris=mkTris(rNS.base,baseT);
            const boxTris=mkTris(r.base,baseT);
            // Convert to WF faces, build Manifold solids, subtract to get snap-slot cutter
            const cutterFaces=facesFromTriangles(cutterTris);
            const slottedFaces=facesFromTriangles(boxTris);
            const w=await EW.engine(),pool2=[],K2=x=>{pool2.push(x);return x;};
            try{
              const mCutter=solidOf(w,K2,cutterFaces);
              const mSlotted=solidOf(w,K2,slottedFaces);
              const mBox=solidOf(w,K2,F);
              if(mCutter&&mSlotted&&mBox){
                // snapCuts = the material the snap slots removed: no-snap minus with-snap
                const snapCuts=K2(mCutter.subtract(mSlotted));
                if(!snapCuts.isEmpty()){
                  const mBoxCut=K2(mBox.subtract(snapCuts));
                  if(!mBoxCut.isEmpty()){
                    const origColor=(F.find(f=>f.color)||{}).color||null;
                    const origG=F[0].g!=null?F[0].g:null;
                    const flat=flatPlanes(F);
                    const newBoxFaces=facesOfSolid(mBoxCut,flat,origColor,origG);
                    EW.softEdges(newBoxFaces);
                    // Replace box faces in model
                    const boxIds=new Set(F.map(f=>f.id));
                    model.faces=model.faces.filter(f=>!boxIds.has(f.id)).concat(newBoxFaces);
                    boxCutOk=true;
                  }
                }
              }
            }finally{for(const x of pool2)try{x.delete();}catch(e2){}}
          }catch(e2){console.warn('Snap slot cut failed (lid still added):',e2);}
        }
        pushUndo(null,'Make Lid');
        for(const f of lidFaces)model.faces.push(f);
        commitChange();WF.zoomExtents();
        const slotMsg=st.lid==='snap'?(boxCutOk?' with snap slots cut into box':''):'' ;
        flash('Lid added'+slotMsg+' — '+((x1-x0)*1000).toFixed(1)+'×'+((y1-y0)*1000).toFixed(1)+' mm.',4000);
      }catch(e){console.error(e);flash('Could not build the lid: '+(e&&e.message||e),7000);}
    },
    cancel(){lidPanel.style.display='none';preview.lines=[];return false;}
  };
};
// (for tests, add-ons and the Enclosure Wizard)
window.EvenUCanBoxHelpers={INSERTS,BOARDS,BOARD_INSERT_LEN,allBoards,insertDepth,boardInsertDepth,minBoss,screwForHole,soCheck,boardPlan,
  get standoff(){return soSet;},get boardmount(){return bmSet;},
  placeStandoff:(faceId,p,s)=>placeStandoff(model.faces.find(f=>f.id===faceId),p,Object.assign({},soSet,s||{})),
  placeBoard:(faceId,p,id,o)=>placeBoard(model.faces.find(f=>f.id===faceId),p,id,Object.assign({},bmSet,{below:null},o||{}))};
tools.flat=()=>({label:'',hint:'Click the face that should go down on the bed: its object turns over to lie flat on it, ready to print',
  move(e,m){const h=pickFace(screenRay(m.x,m.y));setHover(h?h.face:null);},
  down(e,m){const h=pickFace(screenRay(m.x,m.y));if(!h)return flash('Click a face of the object');setHover(null);layFlat(h.face);}
});
$('bGroup').onclick=groupSelected;$('bUngroup').onclick=ungroupSelected;
$('bCheck').onclick=()=>{if(check)closeCheck();else openCheck();};
// Printer build size panel
const bedPanel=$('bedPanel');
$('bPrinter').onclick=()=>{
  if(bedPanel.style.display==='block'){bedPanel.style.display='none';return;}
  $('bedX').value=bed.x;$('bedY').value=bed.y;$('bedZ').value=bed.z;$('bedPreset').value='';bedPanel.style.display='block';
};
$('bedPreset').onchange=()=>{const v=$('bedPreset').value;if(!v)return;const [x,y,z]=v.split(',');$('bedX').value=x;$('bedY').value=y;$('bedZ').value=z;};
$('bedCancel').onclick=()=>{bedPanel.style.display='none';};
$('bedSave').onclick=()=>{
  const x=+$('bedX').value,y=+$('bedY').value,z=+$('bedZ').value;
  if(!(x>=10&&y>=10&&z>=10&&x<=2000&&y<=2000&&z<=2000))return flash('Enter sizes between 10 and 2000 mm');
  bed={x,y,z};store.set('bed',JSON.stringify(bed));bedPanel.style.display='none';
  buildGrid();updateStats();
  if(!model.faces.length&&!model.edges.length)homeCam();
  camDirty();flash('Printer set to '+bedText());
};
bedPanel.addEventListener('keydown',e=>{if(e.key==='Enter')$('bedSave').click();else if(e.key==='Escape')$('bedCancel').click();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
const bP=$('proj');
const syncPersp=()=>{bP.value=cam.ortho?'ortho':'persp';};
bP.onchange=()=>{cam.ortho=bP.value==='ortho';bP.blur();camDirty();};
const uSel=$('units');
uSel.onchange=()=>{units=uSel.value;store.set('units',units);buildGrid();updateStats();if(!model.faces.length&&!model.edges.length){homeCam();camDirty();}uSel.blur();requestDraw();flash('Units: '+uSel.options[uSel.selectedIndex].text);};
document.querySelectorAll('#menubar button').forEach(b=>b.addEventListener('mouseup',()=>b.blur()));
