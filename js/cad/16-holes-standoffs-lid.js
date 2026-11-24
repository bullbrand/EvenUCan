// EvenUCan 3D drawing app - 16-holes-standoffs-lid.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

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
const holeParts=function holeParts(){
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
};
// The space a screw takes up, as a solid along +Z from 0 to h (mm): its outline at any height is the ISO thread
// profile wrapped once round, and twisting that outline one turn per pitch as it rises makes the spiral (right-handed).
const threadCutter=function threadCutter(w,K,{Rmaj,Rmin,P},h){
  const prof=u=>{u=((u%P)+P)%P;// distance along the axis within one pitch -> radius
    if(u<P/8)return Rmaj;if(u<7*P/16)return Rmaj-(Rmaj-Rmin)*(u-P/8)/(5*P/16);
    if(u<11*P/16)return Rmin;return Rmin+(Rmaj-Rmin)*(u-11*P/16)/(5*P/16);};
  const N=Math.max(36,Math.min(72,Math.round(Rmaj*12))),poly=[];
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2,r=prof(-a/(2*Math.PI)*P);poly.push([r*Math.cos(a),r*Math.sin(a)]);}
  return K(w.Manifold.extrude([poly],h,Math.ceil(h/P*12),360*h/P));
};
const holePanel=document.createElement('div');holePanel.id='holePanel';holePanel.className='panel';$cad('view').appendChild(holePanel);
holePanel.innerHTML=`<h3 style="margin:0 0 6px">Hole</h3>
<label>Screw size<select data-h="size">${Object.keys(HOLE_SIZES).map(k=>`<option>${k}</option>`).join('')}</select></label>
<label>Kind of hole<select data-h="type">${Object.entries(HOLE_TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
<label class="chk"><input type="checkbox" data-h="through"> <span class="thr">Right through</span></label>
<label class="dep">Depth (mm)<input data-h="depth" type="number" min="0.5" step="0.5"></label>
<div class="sizes"></div>
<div class="note">Then click on a face where the hole goes: it is drilled straight in. Snap to a guide point or midpoint for an exact place.</div>`;
const syncHolePanel=function syncHolePanel(){
  const q=k=>holePanel.querySelector('[data-h='+k+']');
  q('size').value=holeSet.size;q('type').value=holeSet.type;q('through').checked=holeSet.through;q('depth').value=holeSet.depth;
  holePanel.querySelector('.thr').textContent=holeSet.type==='ins'?'Standard depth for the insert':'Right through';
  holePanel.querySelector('.dep').style.display=holeSet.through?'none':'block';
  holePanel.querySelector('.sizes').textContent=holeParts().text;
};
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
      const face=cur.face,p=cur.p,n=faceNormal(face),ids=componentOf(face.id),F=model.faces.filter(f=>ids.has(f.id)),snapF=cloneCad(model.faces);
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
      }catch(er){console.error('EvenUCan: hole failed',er);model.faces=snapF;markDirtyCad();flash('Could not drill the hole: '+(er&&er.message||er),6000);}
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
const allBoards=function allBoards(){
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
};
const SIDE_WORD={xmin:'left short end',xmax:'right short end',ymin:'front long edge',ymax:'back long edge'};
// The face's own frame: +Z out of the face, ex/ey along it (the same turn the solid engine gets), optionally turned 90°.
const bhFrame=function bhFrame(n,rot){
  const th=Math.acos(clamp(n[2],-1,1)),ph=Math.atan2(n[1],n[0]);
  let ex=[Math.cos(th)*Math.cos(ph),Math.cos(th)*Math.sin(ph),-Math.sin(th)],ey=[-Math.sin(ph),Math.cos(ph),0];
  if(rot){const t=ex;ex=ey;ey=mul(t,-1);}
  return {th:th*180/Math.PI,ph:ph*180/Math.PI,ex,ey,n,rot:!!rot};
};
const bhW=(F,p,a,b,z)=>add(p,mul(add(add(mul(F.ex,a),mul(F.ey,b)),mul(F.n,z||0)),0.001));
// Adds what make() builds (in mm, face frame) to the part that was clicked (join) or as its own grouped object.
const bhCommit=async function bhCommit(face,p,make,undoName,o){
  if(!window.WFEnclosure)return {err:'The solid engine is not available'};
  const n=faceNormal(face),F=bhFrame(n,o.rot),S=1000,join=o.join!==false;
  const ids=join?componentOf(face.id):new Set(),PF=model.faces.filter(f=>ids.has(f.id)),snapF=cloneCad(model.faces);
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
  }catch(er){console.error('EvenUCan: '+undoName+' failed',er);model.faces=snapF;markDirtyCad();return {err:er.message};}
  finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
};
const boxPlanes=(x0,y0,x1,y1)=>[['x',1,x1],['x',-1,x0],['y',1,y1],['y',-1,y0]];
// ---------- Stand-off tool
let soSet=(()=>{const d={size:'M3',len:5.7,custom:false,h:8,boss:8.5};try{return Object.assign(d,JSON.parse(store.get('standoff')||'{}'));}catch(e){return d;}})();
if(!INSERTS[soSet.size])soSet.size='M3';
const soCheck=function soCheck(s=soSet){
  const I=INSERTS[s.size],dep=insertDepth(s.size,s.len),wall=(s.boss-I.hole)/2,needBoss=minBoss(s.size),needH=+(dep+0.6).toFixed(1),probs=[];
  if(wall<I.hole/2-1e-9)probs.push('The wall round the hole would be only '+(+wall.toFixed(2))+' mm thick. It should be at least '+(+(I.hole/2).toFixed(2))+' mm (half the hole), or the plastic can split when the hot insert goes in.');
  if(s.h<needH-1e-9)probs.push('The insert hole is '+dep+' mm deep, so the stand-off needs to be at least '+needH+' mm tall.');
  const info=s.size+' insert: hole '+I.hole+' mm, '+dep+' mm deep, stand-off '+(+s.boss.toFixed(2))+' mm wide, '+(+s.h.toFixed(2))+' mm tall';
  const tip=(s.boss<I.range[0]||s.boss>I.range[1])&&!probs.length?'(The usual width for '+s.size+' is '+I.range[0]+' to '+I.range[1]+' mm.)':'';
  return {I,dep,needBoss,needH,probs,info,tip};
};
const standoffPanel=document.createElement('div');standoffPanel.id='standoffPanel';standoffPanel.className='panel';$cad('view').appendChild(standoffPanel);
standoffPanel.innerHTML=`<h3 style="margin:0 0 6px">Stand-off for a heat-set insert</h3>
<label>Screw size<select data-s="size">${Object.keys(INSERTS).map(k=>`<option>${k}</option>`).join('')}</select></label>
<label>Insert length<select data-s="len"></select></label>
<label class="cus">Your insert length (mm)<input data-s="clen" type="number" min="1" max="30" step="0.1"></label>
<label>Height above the face (mm)<input data-s="h" type="number" min="1" max="200" step="0.5"></label>
<label>Stand-off width (mm)<input data-s="boss" type="number" min="2" max="60" step="0.1"></label>
<div class="sizes"></div><div class="warn"></div><button type="button" class="fix">Fix it</button>
<div class="note">Then click a face, such as the floor of your box: a round post with the insert hole in its top is joined to that part.</div>`;
const syncStandoffPanel=function syncStandoffPanel(){
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
};
const soFix=function soFix(){const c=soCheck(),I=INSERTS[soSet.size];if(soSet.boss<c.needBoss-1e-9)soSet.boss=Math.max(c.needBoss,I.boss);if(soSet.h<c.needH-1e-9)soSet.h=c.needH;store.set('standoff',JSON.stringify(soSet));syncStandoffPanel();};
standoffPanel.addEventListener('change',e=>{
  const t=e.target,k=t.dataset.s;if(!k)return;
  if(k==='size'){const I=INSERTS[t.value];soSet.size=t.value;soSet.len=I.len;soSet.custom=false;soSet.boss=I.boss;const need=+(insertDepth(t.value,I.len)+0.6).toFixed(1);if(soSet.h<need)soSet.h=Math.ceil(need);}
  else if(k==='len'){if(t.value==='c')soSet.custom=true;else{soSet.custom=false;soSet.len=+t.value;}}
  else{const x=parseFloat(t.value);if(x>0){if(k==='clen')soSet.len=x;else soSet[k]=x;}}
  store.set('standoff',JSON.stringify(soSet));syncStandoffPanel();
});
standoffPanel.querySelector('.fix').onclick=soFix;
standoffPanel.addEventListener('keydown',e=>e.stopPropagation());
const placeStandoff=async function placeStandoff(face,p,s=soSet){
  const c=soCheck(s);if(c.probs.length)return {err:'Fix the size first: '+c.probs[0]};
  const r=s.boss/2,hr=c.I.hole/2,h=s.h,dep=c.dep;
  const res=await bhCommit(face,p,(M,K,z0)=>({add:K(M.cylinder(h-z0,r,r,48).translate([0,0,z0])),
    sub:K(M.cylinder(dep+0.3,hr,hr,48).translate([0,0,h-dep])),planes:[['z',1,h],['z',1,h-dep]]}),'Stand-off ('+s.size+' insert)',{join:true});
  if(!res.err)res.info=c.info;
  return res;
};
const bhRing=(F,p,a,b,z,r,col,N=32)=>{const R=[];for(let i=0;i<N;i++){const t=i/N*Math.PI*2;R.push(bhW(F,p,a+r*Math.cos(t),b+r*Math.sin(t),z));}return R.map((q,i)=>[q,R[(i+1)%N],col]);};
// Stand-offs placed one after another snap into a line: 2nd level with 1st (or straight up/across from it),
// 3rd at a right angle that makes a square (both axes shown), and the 4th completes the rectangle.
const SO_GUIDE=[0.2,0.6,1.0],SO_EDGE=[0.44,0.28,0.91];
// Two directions in the face, as level as possible in the world (X/Y on a floor; level and up on a wall)
const soAxes=function soAxes(n){
  let a1=sub([1,0,0],mul(n,dot(n,[1,0,0])));
  if(len(a1)<0.1)a1=sub([0,1,0],mul(n,dot(n,[0,1,0])));
  a1=norm(a1);return [a1,norm(cross(n,a1))];
};
// Where the next stand-off goes, given the mouse point and the stand-offs placed so far in this run
const soSnap=function soSnap(m,n,run){
  const L=Math.max(bed.x,bed.y)/1000,g=[];
  if(!run||!run.pts.length)return {P:m,guides:g,sq:false};
  const pts=run.pts,P1=pts[0];
  if(pts.length===1){
    const [a1,a2]=soAxes(n),d=sub(m,P1),x=dot(d,a1),y=dot(d,a2);
    const useA=Math.abs(x)>=Math.abs(y),ax=useA?a1:a2,t=useA?x:y;
    g.push([add(P1,mul(ax,-L)),add(P1,mul(ax,L)),SO_GUIDE]);
    return {P:add(P1,mul(ax,t)),guides:g,sq:false};
  }
  if(pts.length===2){
    const P2=pts[1],e=sub(P2,P1),Lk=len(e),u=norm(cross(n,e));
    let s=dot(sub(m,P2),u),sq=false;
    if(Math.abs(Math.abs(s)-Lk)<0.15*Lk){s=Math.sign(s)*Lk;sq=true;}
    g.push([add(P1,mul(u,-L)),add(P1,mul(u,L)),SO_GUIDE],[add(P2,mul(u,-L)),add(P2,mul(u,L)),SO_GUIDE]);
    return {P:add(P2,mul(u,s)),guides:g,sq};
  }
  if(pts.length===3){
    const P4=add(P1,sub(pts[2],pts[1]));
    g.push([pts[2],P4,SO_GUIDE],[P4,P1,SO_GUIDE]);
    return {P:P4,guides:g,sq:true};
  }
  return {P:m,guides:g,sq:false};
};
tools.standoff=()=>{
  let cur=null,run=null;// run: {n, d, pts} for the stand-offs placed one after another on the same face
  standoffPanel.style.display='block';syncStandoffPanel();
  const runFor=(n,p)=>run&&run.pts.length<4&&Math.abs(dot(n,run.n)-1)<1e-6&&Math.abs(dot(n,p)-run.d)<1e-4?run:null;
  const hintFor=k=>k===0?'Pick the screw size, insert length and height in the panel, then click a face (such as the box floor) where the stand-off goes':
    k===1?'Stand-off 2 snaps level with stand-off 1 · click to place it':
    k===2?'Stand-off 3 snaps to a right angle, to make a square · click to place it':
    k===3?'Stand-off 4 completes the rectangle · click to place it':'Pick the screw size, insert length and height in the panel, then click a face (such as the box floor) where the stand-off goes';
  return {label:'',hint:hintFor(0),
    move(e,m){cur=lidRedirect(inferPoint(m.x,m.y));setMarker(cur);preview.lines=[];if(!cur||!cur.face)return;
      const n=faceNormal(cur.face),r=runFor(n,cur.p),k=r?r.pts.length:0;
      const sn=soSnap(cur.p,n,r),F=bhFrame(n),c=soCheck(),col=c.probs.length?[0.9,0.2,0.1]:SO_EDGE,P=sn.P;
      const edges=r?r.pts.map((q,i)=>i<r.pts.length-1?[q,r.pts[i+1],SO_EDGE]:null).filter(Boolean):[];
      if(r&&r.pts.length===3)edges.push([r.pts[2],sn.P,SO_EDGE],[sn.P,r.pts[0],SO_EDGE]);
      preview.lines=[...edges,...sn.guides,...bhRing(F,P,0,0,0,soSet.boss/2,col),...bhRing(F,P,0,0,soSet.h,soSet.boss/2,col),...bhRing(F,P,0,0,soSet.h,c.I.hole/2,col),[P,bhW(F,P,0,0,soSet.h),col]];
      setHintCad(hintFor(k));},
    async down(e,m){
      if(!cur||!cur.face)return flash('Click on a face of your model, such as the floor of your box');
      const face=cur.face,n=faceNormal(face);
      if(!runFor(n,cur.p))run={n,d:dot(n,cur.p),pts:[]};
      const sn=soSnap(cur.p,n,run),P=sn.P;preview.lines=[];flash('Adding the stand-off…',8000);
      const r=await placeStandoff(face,P);
      if(r.err)return flash('Could not add the stand-off: '+r.err,7000);
      run.pts.push(P);const k=run.pts.length;
      flash(r.info+'. Stand-off '+k+' of 4'+(k<4?' · the next one snaps to this line':' · rectangle complete'),5000);
      if(k===4)run=null;
    },
    cancel(){preview.lines=[];return false;}};
};
// ---------- Board mount tool
let bmSet=(()=>{const d={id:'esp32s3',below:null,join:false,ghost:true,port:false,rot:false};try{return Object.assign(d,JSON.parse(store.get('boardmount')||'{}'));}catch(e){return d;}})();
const bmBoard=(id=bmSet.id)=>allBoards().find(b=>b.id===id)||BOARDS[0];
// What gets built, in board terms (origin at the board's centre, mm). Plate 1.2 mm; the board sits zB above the face.
const boardPlan=function boardPlan(B,o={}){
  const T=1.2,below=o.below!=null?o.below:B.below,holes=B.holes.map(([x,y,d])=>({x:x-B.L/2,y:y-B.W/2,d,s:screwForHole(d)})).filter(h=>h.s);
  const kind=holes.length>=2?'standoffs':'cradle';let zB=T+below,raised=false;
  if(kind==='standoffs'){const need=Math.max(...holes.map(h=>boardInsertDepth(h.s)))+0.6;if(zB<need){zB=+need.toFixed(2);raised=true;}}
  return {T,below,holes,kind,zB:+zB.toFixed(2),raised,gap:0.3,rail:1.6};
};
const boardText=function boardText(B,P){
  const pt=B.ports[0],sizes=[...new Set(P.holes.map(h=>h.s))];
  let t=B.L+' × '+B.W+' mm board, '+B.pcb+' mm thick. ';
  if(P.kind==='standoffs')t+=P.holes.length+' stand-offs for '+sizes.join('/')+' heat-set inserts ('+sizes.map(s=>'hole '+INSERTS[s].hole+' mm, '+boardInsertDepth(s)+' mm deep, '+INSERTS[s].boss+' mm wide').join('; ')+') on a thin base. ';
  else t+=(B.holes.length?'Its holes are too small for inserts, so it gets':'No mounting holes, so it gets')+' a cradle: a base with side rails, ledges under the ends and a 0.3 mm gap all round. ';
  t+='The board sits '+P.zB+' mm above the face'+(P.raised?' (raised so the inserts fit)':'')+'. ';
  if(pt)t+='USB: '+pt.kind+' on the '+SIDE_WORD[pt.side]+' (orange in the outline): that is where the cut-out goes'+(pt.approx?' (position approximate: check it against your board)':'')+'.';
  return t;
};
const boardPanel=document.createElement('div');boardPanel.id='boardPanel';boardPanel.className='panel';$cad('view').appendChild(boardPanel);
boardPanel.innerHTML=`<h3 style="margin:0 0 6px">Board mount</h3>
<label>Board<select data-b="id"></select></label>
<label>Room under the board for pins (mm)<input data-b="below" type="number" min="0" max="40" step="0.5"></label>
<label class="chk"><input type="checkbox" data-b="join"> Join it to the part I click</label>
<label class="chk"><input type="checkbox" data-b="ghost"> Show the board as a see-through outline</label>
<label class="chk"><input type="checkbox" data-b="port"> Also cut the USB opening in the box wall</label>
<button type="button" class="turn">Turn 90°</button>
<div class="sizes"></div><div class="note src"></div>
<div class="note">Then click the floor of your box where the middle of the board should go.</div>`;
const syncBoardPanel=function syncBoardPanel(){
  const q=k=>boardPanel.querySelector('[data-b='+k+']'),all=allBoards(),B=bmBoard();bmSet.id=B.id;
  const own=all.filter(b=>!b.fromLib),lib=all.filter(b=>b.fromLib),opt=b=>`<option value="${b.id.replace(/"/g,'&quot;')}">${b.name.replace(/[&<]/g,c=>c==='&'?'&amp;':'&lt;')}</option>`;
  q('id').innerHTML=`<optgroup label="Common boards">${own.map(opt).join('')}</optgroup>`+(lib.length?`<optgroup label="From your Parts Library">${lib.map(opt).join('')}</optgroup>`:'');
  q('id').value=B.id;q('below').value=bmSet.below!=null?bmSet.below:B.below;
  q('join').checked=!!bmSet.join;q('ghost').checked=!!bmSet.ghost;q('port').checked=!!bmSet.port;q('port').disabled=!bmSet.join||!B.ports.length;
  boardPanel.querySelector('.sizes').textContent=boardText(B,boardPlan(B,{below:bmSet.below}));
  boardPanel.querySelector('.src').textContent='Sizes from: '+B.src+'.'+(bmSet.join?'':' It is made as its own object that moves as one; tick "Join" (or press U later) to make it part of the box.');
};
boardPanel.addEventListener('change',e=>{
  const t=e.target,k=t.dataset.b;if(!k)return;
  if(k==='id'){bmSet.id=t.value;bmSet.below=null;}else if(k==='below'){const x=parseFloat(t.value);if(x>=0)bmSet.below=x;}else{bmSet[k]=t.checked;if(k==='join'&&!t.checked)bmSet.port=false;}
  store.set('boardmount',JSON.stringify(bmSet));syncBoardPanel();
});
boardPanel.querySelector('.turn').onclick=()=>{bmSet.rot=!bmSet.rot;store.set('boardmount',JSON.stringify(bmSet));flash(bmSet.rot?'Board turned 90°':'Board turned back');};
boardPanel.addEventListener('keydown',e=>e.stopPropagation());
// Outline lines (world) for the preview and the see-through ghost.
const boardLines=function boardLines(B,P,F,p,z){
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
};
const placeBoard=async function placeBoard(face,p,id=bmSet.id,o=bmSet){
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
};
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
// Lids made this session. A stand-off picked on a lid goes on the lid's inside face (the one that faces the box when assembled).
const lidGroups=new Set();
const lidRedirect=function lidRedirect(c){
  if(!c||!c.face||!lidGroups.has(c.face.g))return c;
  const inside=model.faces.filter(f=>f.g===c.face.g&&faceNormal(f)[2]>0.999);
  if(!inside.length)return c;
  const area=f=>{const xs=f.pts.map(v=>v[0]),ys=f.pts.map(v=>v[1]);return (Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));};
  const face=inside.sort((a,b)=>area(b)-area(a))[0];
  return {...c,face,p:[c.p[0],c.p[1],face.pts[0][2]]};
};
let lidOpts=(()=>{try{return Object.assign({wall:2,floor:1.5,type:'snap'},JSON.parse(store.get('lid')||'{}'));}catch(e){return {wall:2,floor:1.5,type:'snap'};}})();
const lidPanel=document.createElement('div');lidPanel.id='lidPanel';lidPanel.className='panel';$cad('view').appendChild(lidPanel);
lidPanel.innerHTML=`<h3 style="margin:0 0 6px">Lid</h3>
<label>Wall (mm)<input data-l="wall" type="number" min="1" max="5" step="0.5"></label>
<label>Lid plate (mm)<input data-l="floor" type="number" min="1" max="4" step="0.5"></label>
<label>Fit<select data-l="type"><option value="snap">Snap clips</option><option value="press">Plain press fit</option></select></label>
<div class="note">Then click the TOP face of the box you want a lid for.</div>`;
const syncLidPanel=function syncLidPanel(){
  const q=k=>lidPanel.querySelector('[data-l='+k+']');
  q('wall').value=lidOpts.wall;q('floor').value=lidOpts.floor;q('type').value=lidOpts.type;
};
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
        const gL=nid();lidGroups.add(gL);
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
        // Turn the lid over so its outside (the top) lies on the bed, and drop it onto the bed (z = 0).
        {const spanArea=f=>{const xs=f.pts.map(v=>v[0]),ys=f.pts.map(v=>v[1]);return (Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));};
         const top=lidFaces.filter(f=>faceNormal(f)[2]>0.999).sort((a,b)=>spanArea(b)-spanArea(a))[0];
         if(top){const ids=new Set(lidFaces.map(f=>f.id)),b=bounds(ids),c=mul(add(b.mn,b.mx),0.5);
           xformIds(ids,p=>rotateAbout(p,c,X,Math.PI));
           const b2=bounds(ids);xformIds(ids,p=>[p[0],p[1],p[2]-b2.mn[2]]);}}
        // Lay the box and the lid out together on the plate, so both fit
        arrangeOnBed({quiet:true,keepGhosts:true});
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
$cad('bGroup').onclick=groupSelected;$cad('bUngroup').onclick=ungroupSelected;
$cad('bCheck').onclick=()=>{if(check)closeCheck();else openCheck();};
// Printer build size panel
const bedPanel=$cad('bedPanel');
$cad('bPrinter').onclick=()=>{
  if(bedPanel.style.display==='block'){bedPanel.style.display='none';return;}
  $cad('bedX').value=bed.x;$cad('bedY').value=bed.y;$cad('bedZ').value=bed.z;$cad('bedPreset').value='';bedPanel.style.display='block';
};
$cad('bedPreset').onchange=()=>{const v=$cad('bedPreset').value;if(!v)return;const [x,y,z]=v.split(',');$cad('bedX').value=x;$cad('bedY').value=y;$cad('bedZ').value=z;};
$cad('bedCancel').onclick=()=>{bedPanel.style.display='none';};
$cad('bedSave').onclick=()=>{
  const x=+$cad('bedX').value,y=+$cad('bedY').value,z=+$cad('bedZ').value;
  if(!(x>=10&&y>=10&&z>=10&&x<=2000&&y<=2000&&z<=2000))return flash('Enter sizes between 10 and 2000 mm');
  bed={x,y,z};store.set('bed',JSON.stringify(bed));bedPanel.style.display='none';
  buildGrid();updateStats();
  if(!model.faces.length&&!model.edges.length)homeCam();
  camDirty();flash('Printer set to '+bedText());
};
bedPanel.addEventListener('keydown',e=>{if(e.key==='Enter')$cad('bedSave').click();else if(e.key==='Escape')$cad('bedCancel').click();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
const bP=$cad('proj');
const syncPersp=()=>{bP.value=cam.ortho?'ortho':'persp';};
bP.onchange=()=>{cam.ortho=bP.value==='ortho';bP.blur();camDirty();};
const uSel=$cad('units');
uSel.onchange=()=>{units=uSel.value;store.set('units',units);buildGrid();updateStats();if(!model.faces.length&&!model.edges.length){homeCam();camDirty();}uSel.blur();requestDraw();flash('Units: '+uSel.options[uSel.selectedIndex].text);};
document.querySelectorAll('#menubar button').forEach(b=>b.addEventListener('mouseup',()=>b.blur()));
// ---- Cut-outs: ports, power jacks, switches and buttons, cut through a wall. Sizes in mm (a little bigger than the part, for printing).
const CUTOUTS={
  usbc:{name:'USB-C port',shape:'slot',w:9.4,h:3.4},
  microusb:{name:'Micro-USB port',shape:'slot',w:8.2,h:3.0},
  usba:{name:'USB-A port',shape:'rect',w:12.6,h:4.8},
  barrel:{name:'Power jack (DC barrel, 5.5 mm plug)',shape:'round',d:8.5},
  din:{name:'DIN plug (5-pin socket)',shape:'round',d:14.5},
  jack35:{name:'3.5 mm audio jack',shape:'round',d:6.5},
  rocker:{name:'Rocker power switch',shape:'rect',w:13,h:20},
  round6:{name:'Round button or LED (6 mm)',shape:'round',d:6.2}
};
const CUT_DEPTH=8;// mm: the cut reaches this far into the wall (enough for walls up to about 5 mm)
const cutSizeText=c=>c.shape==='round'?'Ø '+c.d+' mm':c.w+' × '+c.h+' mm';
let cutKey=(()=>{try{const k=store.get('cutout');return CUTOUTS[k]?k:'usbc';}catch(e){return 'usbc';}})();
// Vertical (1) or horizontal (0) for rectangles and slots. Round holes don't change.
let cutTurn=(()=>{try{return store.get('cutturn')==='1'?1:0;}catch(e){return 0;}})();
window.cutTurnOn=()=>cutTurn===1;
window.cutTurnToggle=()=>{cutTurn=1-cutTurn;try{store.set('cutturn',String(cutTurn));}catch(e){/* remembering is optional */}flash('Cut-outs: '+(cutTurn?'vertical':'horizontal'),3000);if(window.EvenUCanRibbonRefresh)window.EvenUCanRibbonRefresh();};
// The cutter in mm, standing on the face plane (z=0) and reaching CUT_DEPTH into the wall
const cutterOf=function cutterOf(M,K,c,depth){
  const Hp=depth+0.5,z=-depth;
  const cyl=(x,y,r)=>K(K(M.cylinder(Hp,r,r,48,false)).translate([x,y,z]));
  const box=(w,h)=>K(K(M.cube([w,h,Hp],false)).translate([-w/2,-h/2,z]));
  if(c.shape==='round')return cyl(0,0,c.d/2);
  if(c.shape==='rect')return box(c.w,c.h);
  const r=c.h/2,dx=(c.w-c.h)/2;// slot: a bar with a round end on each side
  let s=K(box(c.w-c.h,c.h).add(cyl(-dx,0,r)));
  return K(s.add(cyl(dx,0,r)));
};
const cutoutCut=async function cutoutCut(face,p){
  const c=CUTOUTS[cutKey];
  if(!window.WFEnclosure)return {err:'The solid engine is not available'};
  const ids=componentOf(face.id),PF=model.faces.filter(f=>ids.has(f.id)),snapF=cloneCad(model.faces);
  const F=bhFrame(faceNormal(face),false),S=1000;
  const w=await WFEnclosure.engine(),M=w.Manifold,pool=[],K=x=>{pool.push(x);return x;};
  try{
    const body=solidOf(w,K,PF);if(!body)return {err:'That shape isn\'t a closed solid: Check Model shows the gaps'};
    // Horizontal means level with the ground (on a wall); vertical is 90 degrees from that. On a flat top or bottom face, 'level' is the face's own X.
    const cut=cutterOf(M,K,c,CUT_DEPTH),nn=faceNormal(face),hz=[-nn[1],nn[0],0],
      ang=(Math.hypot(hz[0],hz[1])>1e-6?Math.atan2(dot(hz,F.ey),dot(hz,F.ex))*180/Math.PI:0)+(cutTurn?90:0),
      cutR=K(cut.rotate([0,0,ang]));
    const pc=K(K(cutR.rotate([0,F.th,F.ph])).translate([p[0]*S,p[1]*S,p[2]*S]));
    const out=K(body.subtract(pc));
    if(out.isEmpty()||body.volume()-out.volume()<1e-6)return {err:'Nothing was cut there. Click on a wall, where something is behind it'};
    const col=(PF.find(f=>f.color)||{}).color||null,flat=flatPlanes(PF);
    const nf=facesOfSolid(out,flat,col,face.g||null);
    model.faces=model.faces.filter(f=>!ids.has(f.id)).concat(nf);
    pushUndo(snapshot(snapF,model.edges),'Cut-out: '+c.name);selection.clear();selChanged();commitChange();
    return {};
  }catch(er){console.error('EvenUCan: cut-out failed',er);model.faces=snapF;markDirtyCad();return {err:er.message};}
  finally{for(const x of pool)try{x.delete();}catch(e){/* intentional: freeing engine memory */}}
};
// ---- Cut-out picker (like the Board mount picker): choose the hole and the direction, then click a wall.
const cutPanel=document.createElement('div');cutPanel.id='cutPanel';cutPanel.className='panel';$cad('view').appendChild(cutPanel);
const cutCss=document.createElement('style');
cutCss.textContent='#cutPanel{width:250px;box-sizing:border-box}#cutPanel label{display:block;margin:5px 0;font-size:12.5px}#cutPanel select{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:12.5px;margin-top:3px}#cutPanel button{margin-top:6px;font:inherit;font-size:12.5px;padding:4px 10px;border:1px solid var(--line);border-radius:4px;background:#f4f6fb;cursor:pointer}#cutPanel button:disabled{opacity:.5;cursor:default}#cutPanel .sizes{margin-top:6px;padding:6px 8px;background:#f1f5fb;border-radius:5px;font-size:12px;color:#1a3fa0;line-height:1.35}#cutPanel .note{margin-top:6px;font-size:11.5px;color:var(--muted);line-height:1.35}[data-theme="dark"] #cutPanel button{background:#2a3140;color:inherit}[data-theme="dark"] #cutPanel .sizes{background:#22304a;color:#9fc3ff}';
document.head.appendChild(cutCss);
cutPanel.innerHTML=`<h3 style="margin:0 0 6px">Access Hole Tool</h3>
<label>Hole to cut<select data-c="id"></select></label>
<button type="button" class="turn"></button>
<div class="sizes"></div>
<div class="note">Then click a wall of your box where the hole goes. Ctrl+Z undoes it.</div>`;
const syncCutPanel=function syncCutPanel(){
  const q=k=>cutPanel.querySelector('[data-c='+k+']'),btn=cutPanel.querySelector('.turn');
  const grp=(label,keys)=>`<optgroup label="${label}">`+keys.map(k=>`<option value="${k}">${CUTOUTS[k].name}</option>`).join('')+'</optgroup>';
  q('id').innerHTML=grp('Ports',['usbc','microusb','usba'])+grp('Power and switches',['barrel','din','rocker'])+grp('Buttons and audio',['jack35','round6']);
  q('id').value=cutKey;
  const c=CUTOUTS[cutKey],rot=c.shape!=='round',dir=cutTurn?'vertical':'horizontal';
  btn.textContent=rot?'Direction: '+dir:'Direction: not used for round holes';btn.disabled=!rot;
  cutPanel.querySelector('.sizes').textContent=c.name+': '+cutSizeText(c)+(rot?', '+dir+' (horizontal = level with the ground on a wall)':'')+'. Cut '+CUT_DEPTH+' mm deep.';
};
cutPanel.addEventListener('change',e=>{if(e.target.dataset.c!=='id')return;cutKey=e.target.value;try{store.set('cutout',cutKey);}catch(er){/* remembering is optional */}syncCutPanel();});
cutPanel.querySelector('.turn').onclick=()=>{window.cutTurnToggle();syncCutPanel();};
cutPanel.addEventListener('keydown',e=>e.stopPropagation());
tools.cutout=()=>{
  cutPanel.style.display='block';syncCutPanel();
  let cur=null;
  return {label:'',hint:'Pick the hole and the direction in the panel, then click the wall where it goes',
    move(e,m){cur=inferPoint(m.x,m.y);setMarker(cur);preview.lines=[];if(!cur||!cur.face)return;
      const c=CUTOUTS[cutKey],F=bhFrame(faceNormal(cur.face),false),r=Math.max(c.w||0,c.h||0,c.d||0)/2/1000;
      preview.lines=bhRing(F,cur.p,0,0,0,r,[0.9,0.2,0.1],32);},
    async down(){
      const c=CUTOUTS[cutKey];
      if(!cur||!cur.face)return flash('Click on a wall where the '+c.name+' goes');
      const face=cur.face,p=cur.p;preview.lines=[];flash('Cutting…',8000);
      const r=await cutoutCut(face,p);
      if(r.err)flash('Could not cut: '+r.err,6000);else flash(c.name+' cut in'+(cutTurn&&c.shape!=='round'?' (vertical)':'')+'. Ctrl+Z undoes it if it is in the wrong place.',5000);
    },
    cancel(){preview.lines=[];return false;}};
};
