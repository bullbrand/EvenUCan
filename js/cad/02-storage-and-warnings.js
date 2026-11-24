// EvenUCan 3D drawing app - 02-storage-and-warnings.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- Storage warnings (r1): a red bar that stays until closed or until the autosave works again.
let autosaveOK=true;
const storageWarn=function storageWarn(msg){
  let b=$cad('wfStoreWarn');
  if(!b){b=document.createElement('div');b.id='wfStoreWarn';b.setAttribute('role','alert');
    b.style.cssText='position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:70;background:#b3261e;color:#fff;padding:8px 12px 8px 14px;border-radius:6px;box-shadow:0 2px 12px #0006;max-width:min(760px,calc(100vw - 32px));font-weight:600;display:flex;gap:10px;align-items:center';
    b.innerHTML='<span></span><button title="Hide" style="background:none;border:1px solid #fff8;color:#fff;border-radius:4px;cursor:pointer;padding:0 6px">✕</button>';
    b.querySelector('button').onclick=()=>{b.style.display='none';};document.body.appendChild(b);}
  b.firstChild.textContent=msg;b.style.display='flex';
};
const storageWarnHide=function storageWarnHide(){const b=$cad('wfStoreWarn');if(b)b.style.display='none';};
const autosave=function autosave(){
  const ok=store.trySet('autosave',JSON.stringify({name:docName,units,camera:cam,faces:model.faces,edges:model.edges,guides:model.guides,plates:(typeof platesSave==='function'?platesSave():null),electronics:elecState(false)}));
  if(!ok&&autosaveOK){storageWarn('⚠ Autosave failed – this browser\'s storage is full. Save your file now with Ctrl+S, or your latest changes could be lost.');flash('⚠ Autosave failed — storage is full. Save your file manually with Ctrl+S.',8000);}
  else if(ok&&!autosaveOK)storageWarnHide();
  autosaveOK=ok;
  if(ok&&window.projAutoSave)window.projAutoSave();   // a named project is also kept up to date in its file
};
// One look at startup at how full storage is (the browser's estimate where it has one, and how much of the
// roughly 5 MB a browser gives a page's settings the app has used).
const checkStorageSpace=async function checkStorageSpace(){
  try{
    let used=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);used+=k.length+(localStorage.getItem(k)||'').length;}
    if(used>4e6)return storageWarn('⚠ This browser\'s storage for EvenUCan is nearly full ('+(used/1048576).toFixed(1)+' MB of about 5 MB). Autosave may stop working: save your work as a file (Ctrl+S) and remove parts with big photos you don\'t need.');
    if(navigator.storage&&navigator.storage.estimate){const est=await navigator.storage.estimate();
      if(est&&est.quota&&est.quota-(est.usage||0)<2*1048576)storageWarn('⚠ This computer has less than 2 MB of browser storage left. Autosave may stop working: save your work as a file (Ctrl+S).');}
  }catch(e){console.warn('EvenUCan: storage check skipped',e);}
};
let units=store.get('units')||'mm';
const gridStep=()=>({mm:0.01,cm:0.01,m:1,in:0.0254,ft:0.3048})[units];
// Camera that frames the area around the origin at a sensible scale for the current units.
// Printer build volume in mm (centred on the origin), remembered per browser, not per drawing.
let bed=(()=>{try{const b=JSON.parse(store.get('bed'));if(b&&b.x>0&&b.y>0&&b.z>0)return b;}catch(e){/* intentional: default bed */}return {x:120,y:120,z:120};})();
const homeCam=function homeCam(){
  if(units==='mm'||units==='cm'){const m=Math.max(bed.x,bed.y)/1000;cam.target=[0,0,bed.z/4000];cam.dist=m*1.9;}
  else{const s=gridStep();cam.target=[0,0,s];cam.dist=s*25;}
};
let curColor='#c8a27a';
let lockAxis=null;
// The flat surface new shapes go on when they are not drawn on a face: the ground, or a side picked on the view cube.
let workPlane={name:"ground",n:Z,u:X,v:Y};
const DEF_FRONT=[0.93,0.92,0.88],BACK=[0.52,0.61,0.74],EDGE=[0.04,0.04,0.05],SEL_EDGE=[0.1,0.33,0.95];

const snapshot=(faces,edges)=>JSON.stringify({faces:faces||model.faces,edges:edges||model.edges,guides:model.guides});
// Each undo step keeps a name for the History panel: undoNames[i] goes with undoStack[i] (the model before that step).
let undoNames=[],redoNames=[],histTrimmed=false,histEl=null;
const STEP_NAMES={line:'Line',rect:'Rectangle',circle:'Circle',arc:'Arc',polygon:'Polygon',solid:'3D shape',push:'Push/Pull',move:'Move',rotate:'Rotate',round:'Round / Chamfer',offset:'Offset',follow:'Follow Me',slice:'Slice',erase:'Erase',paint:'Paint',tape:'Guide point',center:'Centre point'};
const pushUndo=function pushUndo(s,name){
  undoStack.push(s||snapshot());undoNames.push(name||STEP_NAMES[toolNameCad]||'Change');
  // Up to 300 steps, and no more than about 300 MB of them (big models, e.g. with threads, make big steps).
  let size=undoStack.reduce((n,x)=>n+x.length,0);
  while(undoStack.length>1&&(undoStack.length>300||size>150e6)){size-=undoStack[0].length;undoStack.shift();undoNames.shift();histTrimmed=true;}
  redoStack=[];redoNames=[];histChanged();
};
const dropUndo=function dropUndo(){undoStack.pop();undoNames.pop();histChanged();};// a step that turned out not to change anything
const clearHistory=function clearHistory(){undoStack=[];redoStack=[];undoNames=[];redoNames=[];histTrimmed=false;histChanged();};
const restore=function restore(s){const d=JSON.parse(s);model={faces:d.faces,edges:d.edges||[],guides:d.guides||[]};fixIds();};
const fixIds=function fixIds(){let m=0;for(const x of [...model.faces,...model.edges,...model.guides])m=Math.max(m,x.id);nextId=Math.max(nextId,m+1);};
// Go to the model as it was after the first k steps: back with undo, or forward again through steps undone.
const goToStep=function goToStep(k){
  if(tool.cancel)tool.cancel();
  if(k===undoStack.length)return;
  let cur=snapshot();
  while(undoStack.length>k){redoStack.push(cur);redoNames.push(undoNames.pop());cur=undoStack.pop();}
  while(undoStack.length<k&&redoStack.length){undoStack.push(cur);undoNames.push(redoNames.pop());cur=redoStack.pop();}
  restore(cur);selection.clear();commitChange();histChanged();
};
const undo=function undo(){if(!undoStack.length){if(tool.cancel)tool.cancel();return flash('Nothing to undo');}goToStep(undoStack.length-1);};
const redo=function redo(){if(!redoStack.length){if(tool.cancel)tool.cancel();return flash('Nothing to redo');}goToStep(undoStack.length+1);};
const commitChange=function commitChange(){markDirtyCad();setDirty(true);scheduleAutosave();scheduleStats();if(check)scheduleCheck();if(model.faces.length&&window.cubeIntroOff)window.cubeIntroOff();};
// (Perf-r1) A drag commits on every mouse move: the autosave (the whole model as JSON), the Print check and the
// size readout wait until the edits pause. flushAutosave writes a waiting autosave at once (save, export, leaving).
let _autosaveTimer=null,_checkTimer=null,_statsTimer=null;
const scheduleAutosave=function scheduleAutosave(){clearTimeout(_autosaveTimer);_autosaveTimer=setTimeout(()=>{_autosaveTimer=null;autosave();},1500);};
const flushAutosave=function flushAutosave(){if(_autosaveTimer===null)return;clearTimeout(_autosaveTimer);_autosaveTimer=null;autosave();};
const scheduleCheck=function scheduleCheck(){clearTimeout(_checkTimer);_checkTimer=setTimeout(()=>{_checkTimer=null;if(check)runCheck();},600);};
const scheduleStats=function scheduleStats(){clearTimeout(_statsTimer);_statsTimer=setTimeout(()=>{_statsTimer=null;updateStats();},80);};
const setDirty=function setDirty(v){docDirty=v;document.title=(v?'• ':'')+docName+' – EvenUCan';if(window.wfUpdateStrip)window.wfUpdateStrip();};
window.setDirty = setDirty;

const addFace=function addFace(pts,nHint,color){
  pts=pts.map(clean);
  pts=pts.filter((p,i)=>dist(p,pts[(i+1)%pts.length])>1e-7);
  if(pts.length<3)return null;
  const n=loopNormal(pts);
  for(const F of model.faces){
    if(F.g||F.hidden)continue;// shapes drawn on a group don't cut into it
    const Fn=faceNormal(F);
    if(Math.abs(Math.abs(dot(Fn,n))-1)>1e-4)continue;
    if(Math.abs(dot(sub(pts[0],F.pts[0]),Fn))>1e-5)continue;
    if(!pts.every(p=>insideFace(F,p,true)))continue;
    if(loopCrosses(F,pts))continue;
    if(dot(Fn,n)<0)pts.reverse();
    F.holes.push(pts.slice().reverse());delete F._tc;
    const f={id:nid(),pts,holes:[],color:color||F.color||null};
    model.faces.push(f);return f;
  }
  if(nHint){if(dot(n,nHint)<0)pts.reverse();}
  else if(Math.abs(n[2])>0.999&&n[2]<0)pts.reverse();
  const f={id:nid(),pts,holes:[],color:color||null};
  model.faces.push(f);return f;
};
const loopCrosses=function loopCrosses(F,pts){
  const n=faceNormal(F),[u,v]=basis(n),o=F.pts[0],t=q=>to2(q,o,u,v);
  const A=pts.map(t);
  for(const L of loops(F)){const B=L.map(t);
    for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++)
      if(segX(A[i],A[(i+1)%A.length],B[j],B[(j+1)%B.length]))return true;}
  return false;
};
const insertPt=function insertPt(pts,p){
  const k=key(p);const i=pts.findIndex(q=>key(q)===k);if(i>=0)return i;
  for(let j=0;j<pts.length;j++){
    const a=pts[j],b=pts[(j+1)%pts.length],D=sub(b,a),L2=dot(D,D);if(L2<1e-12)continue;
    const s=dot(sub(p,a),D)/L2;if(s<=0||s>=1)continue;
    if(dist(add(a,mul(D,s)),p)<1e-5){pts.splice(j+1,0,p);return j+1;}
  }
  return -1;
};
// A line drawn across a face from edge to edge divides it in two.
const trySplit=function trySplit(a,b){
  for(const F of model.faces){
    if(F.holes.length||F.g||F.hidden)continue;
    const n=faceNormal(F);
    if(Math.abs(dot(sub(a,F.pts[0]),n))>1e-5||Math.abs(dot(sub(b,F.pts[0]),n))>1e-5)continue;
    if(!insideFace(F,mul(add(a,b),0.5),true))continue;
    const pts=F.pts.slice();
    if(insertPt(pts,a)<0||insertPt(pts,b)<0)continue;
    const ia=pts.findIndex(q=>key(q)===key(a)),ib=pts.findIndex(q=>key(q)===key(b)),nn=pts.length;
    if(ia===ib||(ia+1)%nn===ib||(ib+1)%nn===ia)continue;
    const L1=[],L2=[];
    for(let i=ia;;i=(i+1)%nn){L1.push(pts[i]);if(i===ib)break;}
    for(let i=ib;;i=(i+1)%nn){L2.push(pts[i]);if(i===ia)break;}
    F.pts=L1;delete F._tc;model.faces.push({id:nid(),pts:L2,holes:[],color:F.color||null});
    return true;
  }
  return false;
};
// Missing corners: wherever two loose lines meet in an L (corner C, ends A and B),
// the point A+B-C completes the square/rectangle/parallelogram.
let compCache=null;
const completions=function completions(){
  if(compCache)return compCache;
  const ends=new Map(),pos=new Map();
  const link=(p,q)=>{const k=key(p);pos.set(k,p);if(!ends.has(k))ends.set(k,[]);ends.get(k).push(q);};
  for(const e of model.edges){link(e.a,e.b);link(e.b,e.a);}
  const out=[],seen=new Set();
  for(const [kc,others] of ends){
    if(others.length<2)continue;
    const C=pos.get(kc);
    for(let i=0;i<others.length;i++)for(let j=i+1;j<others.length;j++){
      const A=others[i],B=others[j],u=sub(A,C),v=sub(B,C),lu=len(u),lv=len(v);
      // Only right-angle corners (squares/rectangles), so open circles and curves don't fill with hints.
      if(lu<1e-9||lv<1e-9||Math.abs(dot(u,v))/(lu*lv)>1e-4)continue;
      const D=clean(sub(add(A,B),C)),kd=key(D);
      if(ends.has(kd)||seen.has(kd))continue;
      seen.add(kd);
      out.push({p:D,A,B,label:Math.abs(lu-lv)<1e-6?'Completes Square':'Completes Rectangle'});
    }
  }
  return compCache=out;
};
// Open edges: face edges used by only one face (the rim of a hole), as [from,to] in that face's winding.
const openEdges=function openEdges(){
  const cnt=new Map(),list=[];
  const ek=(ka,kb)=>ka<kb?ka+'|'+kb:kb+'|'+ka;
  for(const f of model.faces)for(const L of loops(f))for(let i=0;i<L.length;i++){
    const p=L[i],q=L[(i+1)%L.length],k=ek(key(p),key(q));cnt.set(k,(cnt.get(k)||0)+1);list.push([p,q,k]);
  }
  return list.filter(e=>cnt.get(e[2])===1).map(e=>[e[0],e[1]]);
};
const onSeg3=function onSeg3(p,a,b){const D=sub(b,a),L2=dot(D,D);if(L2<1e-12)return false;const s=clamp(dot(sub(p,a),D)/L2,0,1);return dist(add(a,mul(D,s)),p)<1e-5;};
// The open edge that segment a-b was traced along, if any.
const openEdgeUnder=function openEdgeUnder(a,b){for(const [p,q] of openEdges())if(onSeg3(a,p,q)&&onSeg3(b,p,q))return [p,q];return null;};
// Find a flat loop through edge a-b made of open face edges and loose lines, and fill it with a face.
const closeLoop=function closeLoop(a,b,newEdgeId){
  const open=openEdges(),dir=new Set(),adj=new Map(),pos=new Map();
  for(const f of model.faces)for(const L of loops(f))for(let i=0;i<L.length;i++)dir.add(key(L[i])+'>'+key(L[(i+1)%L.length]));
  const link=(p,q,stray)=>{
    const kp=key(p),kq=key(q);pos.set(kp,p);pos.set(kq,q);
    for(const [x,y] of [[kp,kq],[kq,kp]]){if(!adj.has(x))adj.set(x,[]);adj.get(x).push({k:y,stray});}
  };
  for(const [p,q] of open)link(p,q,null);
  for(const e of model.edges)if(e.id!==newEdgeId)link(e.a,e.b,e.id);
  const ka=key(a),kb=key(b);pos.set(ka,a);pos.set(kb,b);
  const prev=new Map([[kb,null]]),queue=[kb];
  while(queue.length){
    const x=queue.shift();if(x===ka)break;
    for(const n of adj.get(x)||[]){
      if(x===kb&&n.k===ka)continue;
      if(prev.has(n.k))continue;
      prev.set(n.k,{from:x,stray:n.stray});queue.push(n.k);
    }
  }
  if(!prev.has(ka))return false;
  const path=[],strays=[];
  for(let x=ka;x!==kb;){const pr=prev.get(x);path.push(x);if(pr.stray)strays.push(pr.stray);x=pr.from;}
  path.push(kb);
  const keys=[ka,...path.reverse().slice(0,-1)];
  if(keys.length<3)return false;
  let pts=keys.map(k=>pos.get(k));
  if(!isPlanar(pts))return false;
  // Don't duplicate a face that already covers this area.
  const t=triangulate({pts,holes:[]}),n=loopNormal(pts);
  if(t.tris.length){
    const c=mul(add(add(t.V[t.tris[0]],t.V[t.tris[1]]),t.V[t.tris[2]]),1/3);
    for(const F of model.faces){
      const Fn=faceNormal(F);
      if(Math.abs(Math.abs(dot(Fn,n))-1)>1e-4||Math.abs(dot(sub(c,F.pts[0]),Fn))>1e-5)continue;
      if(insideFace(F,c,false)&&!pts.some(p=>insideFace(F,p,true)))return false;
    }
  }
  // Wind the new face opposite to its neighbours so the solid stays closed with outward faces.
  for(let i=0;i<keys.length;i++)if(dir.has(keys[i]+'>'+keys[(i+1)%keys.length])){pts.reverse();break;}
  model.edges=model.edges.filter(e=>!strays.includes(e.id)&&e.id!==newEdgeId);
  addFace(pts,loopNormal(pts));
  return true;
};
// Where 2D segments a-b and c-d meet: list of [t on a-b, w on c-d] (crossings, touches and collinear overlaps).
const segHits=function segHits(a,b,c,d){
  const EPS=1e-7,r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],q=[c[0]-a[0],c[1]-a[1]];
  const rr=r[0]*r[0]+r[1]*r[1],ss=s[0]*s[0]+s[1]*s[1],den=r[0]*s[1]-r[1]*s[0];
  if(rr<1e-20||ss<1e-20)return [];
  if(Math.abs(den)>1e-12*Math.sqrt(rr*ss)){
    const t=(q[0]*s[1]-q[1]*s[0])/den,w=(q[0]*r[1]-q[1]*r[0])/den,et=EPS/Math.sqrt(rr),ew=EPS/Math.sqrt(ss);
    return t>-et&&t<1+et&&w>-ew&&w<1+ew?[[clamp(t,0,1),clamp(w,0,1)]]:[];
  }
  if(Math.abs(q[0]*r[1]-q[1]*r[0])/Math.sqrt(rr)>EPS)return [];
  const out=[],tc=(q[0]*r[0]+q[1]*r[1])/rr,td=((d[0]-a[0])*r[0]+(d[1]-a[1])*r[1])/rr;
  const wa=((a[0]-c[0])*s[0]+(a[1]-c[1])*s[1])/ss,wb=((b[0]-c[0])*s[0]+(b[1]-c[1])*s[1])/ss;
  if(tc>0&&tc<1)out.push([tc,0]);if(td>0&&td<1)out.push([td,1]);
  if(wa>0&&wa<1)out.push([0,wa]);if(wb>0&&wb<1)out.push([1,wb]);
  return out;
};
// Make everything on one flat surface "stick together" like SketchUp: lines are cut where they cross,
// and overlapping faces are rebuilt as separate regions, so each piece can be erased or pushed on its own.
const planarize=function planarize(n,o){
  n=norm(n);const [u,v]=basis(n),onP=p=>Math.abs(dot(sub(p,o),n))<1e-6;
  // Grouped and hidden geometry is left alone: only loose shapes stick together.
  const F=model.faces.filter(f=>!f.g&&!f.hidden&&dot(faceNormal(f),n)>0.9999&&onP(f.pts[0]));
  const S=model.edges.filter(e=>!e.g&&onP(e.a)&&onP(e.b));
  if(F.length+S.length<2)return;
  const to=p=>{const d=sub(p,o);return [dot(d,u),dot(d,v)];};
  const segs=[];
  for(const f of F)for(const L of loops(f))for(let i=0;i<L.length;i++)segs.push([L[i],L[(i+1)%L.length]]);
  for(const e of S)segs.push([e.a,e.b]);
  const S2=segs.map(([a,b])=>[to(a),to(b)]),cuts=segs.map(()=>[]);
  for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++)
    for(const [t,w] of segHits(S2[i][0],S2[i][1],S2[j][0],S2[j][1])){cuts[i].push(t);cuts[j].push(w);}
  if(!cuts.some(c=>c.some(t=>t>1e-9&&t<1-1e-9)))return;// nothing crosses: leave as is
  const vid=new Map(),V3=[],V2=[];
  const vert=p=>{const k=key(p);if(!vid.has(k)){vid.set(k,V3.length);V3.push(p);V2.push(to(p));}return vid.get(k);};
  const ek2=(i,j)=>i<j?i+'_'+j:j+'_'+i,E=new Map();
  segs.forEach(([a,b],i)=>{
    const ts=[...new Set([0,1,...cuts[i].filter(t=>t>1e-9&&t<1-1e-9)])].sort((x,y)=>x-y);
    let prev=vert(a);
    for(let k=1;k<ts.length;k++){
      const cur=vert(ts[k]===1?b:clean(add(a,mul(sub(b,a),ts[k]))));
      if(cur!==prev)E.set(ek2(prev,cur),[prev,cur]);
      prev=cur;
    }
  });
  const edges=[...E.values()],adj=V3.map(()=>[]);
  for(const [i,j] of edges){adj[i].push(j);adj[j].push(i);}
  // Loose ends can't bound a region: set them aside before tracing regions.
  const alive=new Set(E.keys()),deg=adj.map(a=>a.length);
  for(let changed=true;changed;){
    changed=false;
    for(let x=0;x<V3.length;x++)if(deg[x]===1){
      const y=adj[x].find(y=>alive.has(ek2(x,y)));deg[x]=0;if(y===undefined)continue;
      alive.delete(ek2(x,y));deg[y]--;changed=true;
    }
  }
  const ang=(x,y)=>Math.atan2(V2[y][1]-V2[x][1],V2[y][0]-V2[x][0]);
  const nb=V3.map((_,x)=>adj[x].filter(y=>alive.has(ek2(x,y))).sort((p,q)=>ang(x,p)-ang(x,q)));
  const seen=new Set(),cycles=[];
  for(const kk of alive){
    const [i,j]=kk.split('_').map(Number);
    for(const [s,t] of [[i,j],[j,i]]){
      if(seen.has(s+'>'+t))continue;
      const cyc=[];let a=s,b=t,guard=0;
      while(!seen.has(a+'>'+b)&&guard++<1e5){seen.add(a+'>'+b);cyc.push(a);const L=nb[b],c=L[(L.indexOf(a)-1+L.length)%L.length];a=b;b=c;}
      cycles.push(cyc);
    }
  }
  const area=c=>{let s=0;for(let i=0;i<c.length;i++){const p=V2[c[i]],q=V2[c[(i+1)%c.length]];s+=p[0]*q[1]-q[0]*p[1];}return s/2;};
  const par=V3.map((_,i)=>i),find=x=>{while(par[x]!==x)x=par[x]=par[par[x]];return x;};
  for(const kk of alive){const [i,j]=kk.split('_').map(Number);par[find(i)]=find(j);}
  const pos=[],neg=[];
  for(const c of cycles){const A=area(c);if(Math.abs(A)<1e-14)continue;(A>0?pos:neg).push({c,A,comp:find(c[0]),holes:[]});}
  // A separate shape sitting inside a region is a hole in it (it gets its own face if it is filled).
  for(const h of neg){
    let best=null;
    for(const p of pos)if(p.comp!==h.comp&&(!best||p.A<best.A)&&pip(V2[h.c[0]],p.c.map(i=>V2[i])))best=p;
    if(best)best.holes.push(h);
  }
  const newFaces=[],boundary=new Set();
  for(const p of pos){
    const f={id:0,pts:p.c.map(i=>V3[i]),holes:p.holes.map(h=>h.c.map(i=>V3[i])),color:null};
    const t=triangulate(f);let bestA=-1,c=null;
    for(let i=0;i<t.tris.length;i+=3){const A=t.V[t.tris[i]],B=t.V[t.tris[i+1]],C=t.V[t.tris[i+2]],ar=len(cross(sub(B,A),sub(C,A)));if(ar>bestA){bestA=ar;c=mul(add(add(A,B),C),1/3);}}
    if(!c)continue;
    const src=F.find(g=>insideFace(g,c,false));if(!src)continue;// only areas that were filled before stay filled
    f.id=nid();f.color=src.color||null;newFaces.push(f);
    for(const L of loops(f))for(let i=0;i<L.length;i++)boundary.add(edgeKey(L[i],L[(i+1)%L.length]));
  }
  if(F.length&&!newFaces.length)return;// safety: never lose faces
  const old=new Set(F),oldS=new Set(S);
  model.faces=model.faces.filter(f=>!old.has(f)).concat(newFaces);
  model.edges=model.edges.filter(e=>!oldS.has(e));
  for(const [i,j] of edges){const k=edgeKey(V3[i],V3[j]);if(boundary.has(k))continue;boundary.add(k);model.edges.push({id:nid(),a:V3[i],b:V3[j]});}
  selection.clear();
};
// Planarize the flat surface a new line a-b lies on.
const planarizeSeg=function planarizeSeg(a,b){
  const f=model.faces.find(f=>{const n=faceNormal(f);return Math.abs(dot(sub(a,f.pts[0]),n))<1e-6&&Math.abs(dot(sub(b,f.pts[0]),n))<1e-6;});
  if(f)planarize(faceNormal(f),f.pts[0]);
  else if(Math.abs(a[2]-b[2])<1e-9)planarize(Z,[0,0,a[2]]);
};
// Join two faces in the same plane that share a line (used when that line is erased).
const mergeFaces=function mergeFaces(A,B){
  const dk=(a,b)=>key(a)+'>'+key(b),all=new Map();
  for(const f of [A,B])for(const L of loops(f))for(let i=0;i<L.length;i++)all.set(dk(L[i],L[(i+1)%L.length]),[L[i],L[(i+1)%L.length]]);
  const next=new Map(),pos=new Map();
  for(const [a,b] of all.values()){
    if(all.has(dk(b,a)))continue;
    if(next.has(key(a)))return false;
    next.set(key(a),key(b));pos.set(key(a),a);
  }
  const Ls=[],used=new Set();
  for(const s of next.keys()){
    if(used.has(s))continue;const L=[];let c=s;
    while(c!==undefined&&!used.has(c)){used.add(c);L.push(pos.get(c));c=next.get(c);}
    if(c!==s)return false;Ls.push(L);
  }
  if(!Ls.length)return false;
  // Drop in-line corner points left over from the split, unless something else still uses them.
  const keep=new Set();
  for(const f of model.faces)if(f!==A&&f!==B)for(const L of loops(f))for(const p of L)keep.add(key(p));
  for(const e of model.edges){keep.add(key(e.a));keep.add(key(e.b));}
  const simp=L=>L.filter((p,i)=>keep.has(key(p))||len(cross(sub(p,L[(i+L.length-1)%L.length]),sub(L[(i+1)%L.length],p)))>1e-12);
  const n=faceNormal(A),[u,v]=basis(n);
  const area=L=>{let s=0;for(let i=0;i<L.length;i++){const a=to2(L[i],L[0],u,v),b=to2(L[(i+1)%L.length],L[0],u,v);s+=a[0]*b[1]-b[0]*a[1];}return s/2;};
  const out=Ls.map(simp).filter(L=>L.length>=3).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
  if(!out.length)return false;
  model.faces=model.faces.filter(f=>f!==A&&f!==B);
  model.faces.push({id:nid(),pts:out[0],holes:out.slice(1),color:A.color||B.color||null,g:A.g});
  return true;
};
const pushPull=function pushPull(id,d){pushPullMany([id],d);};
// Push or pull several faces together by the same distance, each along its own normal. Where two of them share a
// line (a shape split by lines into strips), no wall is made between them, so they rise as one solid.
const pushPullMany=function pushPullMany(ids,d){
  const P=ids.map(id=>model.faces.find(f=>f.id===id)).filter(Boolean);if(!P.length||Math.abs(d)<1e-9)return;
  const ek=(a,b)=>{const ka=key(a),kb=key(b);return ka<kb?ka+'|'+kb:kb+'|'+ka;};
  const pset=new Set(P),emap=new Map(),inner=new Map();
  for(const S of model.faces){if(pset.has(S))continue;
    for(const L of loops(S))for(let i=0;i<L.length;i++){const k=ek(L[i],L[(i+1)%L.length]);if(!emap.has(k))emap.set(k,[]);emap.get(k).push(S);}}
  for(const F of P)for(const L of loops(F))for(let i=0;i<L.length;i++){const k=ek(L[i],L[(i+1)%L.length]);inner.set(k,(inner.get(k)||0)+1);}
  const added=[];
  for(const F of P){
  const N=faceNormal(F),t=mul(N,d);
  // Only faces of the same group (or loose faces with loose faces) are joined to or stretched.
  const nbr=k=>(emap.get(k)||[]).filter(S=>S.g===F.g),own=k=>inner.get(k)>1;
  const Ls=loops(F);let attached=false;
  for(const L of Ls)for(let i=0;i<L.length;i++){const k=ek(L[i],L[(i+1)%L.length]);if(!own(k)&&nbr(k).length)attached=true;}
  for(const L of Ls)for(let i=0;i<L.length;i++){
    const a=L[i],b=L[(i+1)%L.length],a2=clean(add(a,t)),b2=clean(add(b,t));
    if(own(ek(a,b)))continue;// shared with another face being pushed: no wall between them
    const qn=norm(cross(sub(b,a),N));
    let merged=false;
    // Neighbouring face in the same plane as the new side: stretch it instead of adding a new face.
    for(const S of nbr(ek(a,b))){
      if(S.holes.length)continue;
      if(Math.abs(Math.abs(dot(faceNormal(S),qn))-1)>1e-6)continue;
      const ka=key(a),kb=key(b),ia=S.pts.findIndex(p=>key(p)===ka),ib=S.pts.findIndex(p=>key(p)===kb);
      if(ia<0||ib<0)continue;
      S.pts[ia]=a2;S.pts[ib]=b2;delete S._tc;merged=true;break;
    }
    if(merged)continue;
    const q=[a,b,b2,a2],out=cross(sub(b,a),N),want=(attached&&d<0)?mul(out,-1):out;
    if(dot(loopNormal(q),want)<0)q.reverse();
    added.push({id:nid(),pts:q,holes:[],color:F.color||null,g:F.g});
  }
  const orig={pts:F.pts.slice(),holes:F.holes.map(h=>h.slice())};
  F.pts=F.pts.map(p=>clean(add(p,t)));F.holes=F.holes.map(h=>h.map(p=>clean(add(p,t))));delete F._tc;
  if(!attached){
    if(d<0){F.pts.reverse();F.holes.forEach(h=>h.reverse());delete F._tc;}
    const base={id:nid(),pts:orig.pts,holes:orig.holes,color:F.color||null,g:F.g};
    if(d>0){base.pts.reverse();base.holes.forEach(h=>h.reverse());}
    added.push(base);
  }
  }
  model.faces.push(...added);
  // Pushed all the way through to an opposite face: cut a hole.
  for(const F of P)if(!F.holes.length){
    const Fn=faceNormal(F);
    for(const B of model.faces){
      if(B===F||B.g!==F.g||dot(faceNormal(B),Fn)>-0.9999)continue;
      if(Math.abs(dot(sub(F.pts[0],B.pts[0]),Fn))>1e-5)continue;
      if(!F.pts.every(p=>insideFace(B,p,true)))continue;
      B.holes.push(F.pts.slice());delete B._tc;model.faces.splice(model.faces.indexOf(F),1);break;
    }
  }
};
const componentOf=function componentOf(fid){
  const byKey=new Map();
  for(const f of model.faces)for(const L of loops(f))for(const p of L){const k=key(p);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(f);}
  const start=model.faces.find(f=>f.id===fid),gid=start&&start.g;
  const seen=new Set([fid]),q=[start];
  // Connected faces of the same group (or, for loose geometry, other loose faces): groups never join up with neighbours.
  while(q.length){const f=q.pop();if(!f)continue;
    for(const L of loops(f))for(const p of L)for(const g of byKey.get(key(p))||[])if(!seen.has(g.id)&&g.g===gid){seen.add(g.id);q.push(g);}}
  return gid?expandGroups(seen):seen;
};
const vertsOf=function vertsOf(ids){
  const s=new Set();
  for(const f of model.faces)if(ids.has(f.id))for(const L of loops(f))for(const p of L)s.add(key(p));
  for(const e of model.edges)if(ids.has(e.id)){s.add(key(e.a));s.add(key(e.b));}
  return s;
};
const touching=function touching(vset){
  const s=new Set();
  for(const f of model.faces)if(loops(f).some(L=>L.some(p=>vset.has(key(p)))))s.add(f.id);
  for(const e of model.edges)if(vset.has(key(e.a))||vset.has(key(e.b)))s.add(e.id);
  return s;
};
const xform=function xform(vset,fn){
  const m=p=>vset.has(key(p))?clean(fn(p)):p;
  for(const f of model.faces){f.pts=f.pts.map(m);f.holes=f.holes.map(h=>h.map(m));delete f._tc;}
  for(const e of model.edges){e.a=m(e.a);e.b=m(e.b);}
};
const copyEntities=function copyEntities(srcF,srcE,ids,fn){
  // Each copy of a group becomes its own new group.
  const gmap=new Map(),ng=g=>{if(!g)return undefined;if(!gmap.has(g))gmap.set(g,nid());return gmap.get(g);};
  for(const f of srcF)if(ids.has(f.id))model.faces.push({id:nid(),pts:f.pts.map(p=>clean(fn(p))),holes:f.holes.map(h=>h.map(p=>clean(fn(p)))),color:f.color,g:ng(f.g),soft:f.soft||undefined});
  for(const e of srcE)if(ids.has(e.id))model.edges.push({id:nid(),a:clean(fn(e.a)),b:clean(fn(e.b)),g:ng(e.g)});
};
