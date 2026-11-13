// ---------------------------------------------------------------- math
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const dist=(a,b)=>len(sub(a,b));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const X=[1,0,0],Y=[0,1,0],Z=[0,0,1];
const AXES={x:X,y:Y,z:Z};
const clean=p=>p.map(v=>{const r=Math.round(v*1e6)/1e6;return r===0?0:r;});
const key=p=>Math.round(p[0]*1e5)+','+Math.round(p[1]*1e5)+','+Math.round(p[2]*1e5);
const clone=o=>JSON.parse(JSON.stringify(o));

function loopNormal(pts){
  const n=[0,0,0];
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];
    n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
  return norm(n);
}
const faceNormal=f=>loopNormal(f.pts);
const loops=f=>[f.pts,...f.holes];
function basis(n){
  const u=Math.abs(n[2])>0.9?norm(sub(X,mul(n,n[0]))):norm(cross(Z,n));
  return [u,cross(n,u)];
}
const to2=(p,o,u,v)=>{const d=sub(p,o);return [dot(d,u),dot(d,v)];};
function pip(P,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>P[1])!==(b[1]>P[1])&&P[0]<(b[0]-a[0])*(P[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function dSeg2(P,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;
  let t=L?((P[0]-a[0])*dx+(P[1]-a[1])*dy)/L:0;t=clamp(t,0,1);
  return Math.hypot(P[0]-a[0]-t*dx,P[1]-a[1]-t*dy);
}
const nearBoundary=(P,poly)=>poly.some((a,i)=>dSeg2(P,a,poly[(i+1)%poly.length])<1e-5);
function insideFace(F,p,strict){
  const n=faceNormal(F),[u,v]=basis(n),o=F.pts[0],P=to2(p,o,u,v);
  const outer=F.pts.map(q=>to2(q,o,u,v));
  if(strict&&nearBoundary(P,outer))return false;
  if(!pip(P,outer))return false;
  for(const h of F.holes){const H=h.map(q=>to2(q,o,u,v));if(strict&&nearBoundary(P,H))return false;if(pip(P,H))return false;}
  return true;
}
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function segX(a,b,c,d){
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b),e=1e-12;
  return ((o1>e&&o2<-e)||(o1<-e&&o2>e))&&((o3>e&&o4<-e)||(o3<-e&&o4>e));
}
function rayLineClosest(ro,rd,p0,D){
  const w=sub(p0,ro),a=dot(D,D),b=dot(D,rd),c=dot(rd,rd),d=dot(D,w),e=dot(rd,w),den=a*c-b*b;
  if(Math.abs(den)<1e-12)return 0;
  return (b*e-c*d)/den;
}
function rayPlane(ray,p,n){
  const den=dot(ray.d,n);if(Math.abs(den)<1e-9)return null;
  const t=dot(sub(p,ray.o),n)/den;if(t<0)return null;
  return add(ray.o,mul(ray.d,t));
}
const projPlane=(p,pl)=>sub(p,mul(pl.n,dot(sub(p,pl.p),pl.n)));
function rotateAbout(p,c,A,ang){
  const v=sub(p,c),cs=Math.cos(ang),sn=Math.sin(ang);
  return add(c,add(add(mul(v,cs),mul(cross(A,v),sn)),mul(A,dot(A,v)*(1-cs))));
}

// ---------------------------------------------------------------- triangulation (ear clipping with holes)
// (Perf-r1) rebuild() keeps each face's triangulation in f._tc. The property is non-enumerable, so it never goes
// into JSON (undo steps, autosave, saved files) or into copies; the code that changes a face's outline in place
// deletes it. As a safety net the cache also keeps a cheap fingerprint of the corners (order-sensitive, one per
// axis) and is only used while that still matches, so a change that forgets to clear it can't show a stale face.
function faceSig(f){let x=0,y=0,z=0,k=0;for(const L of [f.pts,...f.holes]){k+=0.5;for(const p of L){k++;const w=Math.sin(k*12.9898)*43758.5453;x+=p[0]*w;y+=p[1]*(w+1.37);z+=p[2]*(w-2.71);}}return [x,y,z,k];}
function tcGet(f){const c=f._tc;if(!c)return null;const g=faceSig(f);return g[0]===c.s[0]&&g[1]===c.s[1]&&g[2]===c.s[2]&&g[3]===c.s[3]?c.t:null;}
function tcSet(f,t){Object.defineProperty(f,'_tc',{value:{t,s:faceSig(f)},writable:true,configurable:true,enumerable:false});}
function triangulate(f){
  const n=faceNormal(f),[u,v]=basis(n),o=f.pts[0],V=[],P=[];
  const area=idx=>{let s=0;for(let i=0;i<idx.length;i++){const a=P[idx[i]],b=P[idx[(i+1)%idx.length]];s+=a[0]*b[1]-b[0]*a[1];}return s/2;};
  // Corners lying exactly on a straight run (A→B→C in line) are left out: ear clipping can get stuck on
  // them. Exports put them back where a neighbouring face needs them (see buildMesh).
  const straight=L=>{
    const Q=L.map(p=>to2(p,o,u,v));
    const keep=L.filter((_,i)=>{const A=Q[(i+L.length-1)%L.length],B=Q[i],C=Q[(i+1)%L.length];
      const ac2=(C[0]-A[0])**2+(C[1]-A[1])**2,d=(B[0]-A[0])*(C[0]-B[0])+(B[1]-A[1])*(C[1]-B[1]);
      return !(d>0&&Math.abs(orient(A,B,C))<=1e-9*ac2);});
    return keep.length>=3?keep:L;
  };
  const mk=(L,ccw)=>{const idx=straight(L).map(p=>{V.push(p);P.push(to2(p,o,u,v));return V.length-1;});if((area(idx)>0)!==ccw)idx.reverse();return idx;};
  let poly=mk(f.pts,true);
  const holes=f.holes.map(h=>mk(h,false));
  const maxX=h=>Math.max(...h.map(i=>P[i][0]));
  holes.sort((a,b)=>maxX(b)-maxX(a));
  const same=(a,b)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
  holes.forEach((h,hi)=>{
    let mi=0;h.forEach((vi,i)=>{if(P[vi][0]>P[h[mi]][0])mi=i;});
    const M=P[h[mi]],ls=[poly,...holes.slice(hi)];
    const d2=i=>{const q=P[poly[i]];return (q[0]-M[0])**2+(q[1]-M[1])**2;};
    const order=poly.map((_,i)=>i).sort((a,b)=>d2(a)-d2(b));
    let bi=order[0];
    search:for(const ci of order){
      const B=P[poly[ci]];
      for(const L of ls)for(let i=0;i<L.length;i++){
        const c=P[L[i]],d=P[L[(i+1)%L.length]];
        if(same(c,M)||same(c,B)||same(d,M)||same(d,B))continue;
        if(segX(M,B,c,d))continue search;
      }
      bi=ci;break;
    }
    // A vertex used by an earlier bridge appears twice in the outline: join to the copy whose
    // inside corner faces the hole, or the new bridge crosses the old one.
    {
      const B=P[poly[bi]],ang=(p)=>Math.atan2(p[1]-B[1],p[0]-B[0]),TAU=Math.PI*2,norm=a=>((a%TAU)+TAU)%TAU;
      const am=ang(M);
      for(let ci=0;ci<poly.length;ci++){
        if(!same(P[poly[ci]],B))continue;
        const a1=ang(P[poly[(ci+1)%poly.length]]),a2=ang(P[poly[(ci+poly.length-1)%poly.length]]);
        if(norm(am-a1)<norm(a2-a1)){bi=ci;break;}
      }
    }
    const hs=h.slice(mi).concat(h.slice(0,mi));hs.push(h[mi]);
    poly=poly.slice(0,bi+1).concat(hs,[poly[bi]],poly.slice(bi+1));
  });
  const tris=[];let idx=poly.slice(),guard=0;
  while(idx.length>3&&guard++<20000){
    let found=false;
    for(let i=0;i<idx.length;i++){
      const a=idx[(i+idx.length-1)%idx.length],b=idx[i],c=idx[(i+1)%idx.length];
      const A=P[a],B=P[b],C=P[c];
      if(orient(A,B,C)<=1e-14)continue;
      let ok=true;
      for(const j of idx){
        if(j===a||j===b||j===c)continue;const Q=P[j];
        if(same(Q,A)||same(Q,B)||same(Q,C))continue;
        if(orient(A,B,Q)>=-1e-14&&orient(B,C,Q)>=-1e-14&&orient(C,A,Q)>=-1e-14){ok=false;break;}
      }
      if(!ok)continue;
      tris.push(a,b,c);idx.splice(i,1);found=true;break;
    }
    if(!found){tris.push(idx[idx.length-1],idx[0],idx[1]);idx.splice(0,1);}
  }
  if(idx.length===3)tris.push(idx[0],idx[1],idx[2]);
  return {V,tris};
}

// ---------------------------------------------------------------- model
let model={faces:[],edges:[],guides:[]};
let nextId=1;const nid=()=>nextId++;
let selection=new Set();
let undoStack=[],redoStack=[];
let docName='Untitled',docDirty=false,fileHandle=null;
// Storage keys (and the Metadata/opensketch.json name inside saved .3mf files) keep the app's original
// name so settings, autosave and files saved before the rename still load.
const store={get(k){try{return localStorage.getItem('opensketch.'+k);}catch(e){return null;}},// intentional: storage blocked reads as "nothing saved"
  set(k,v){try{localStorage.setItem('opensketch.'+k,v);}catch(e){console.warn('EvenUCan: could not store "'+k+'"',e);}},
  // like set, but says whether it worked (for the autosave and anything that must warn the user)
  trySet(k,v){try{localStorage.setItem('opensketch.'+k,v);return true;}catch(e){console.error('EvenUCan: could not store "'+k+'"',e);return false;}}};
// ---- Electronics side of a project (r1): the Enclosure Wizard, ESPHome answers and the user's own parts live in
// their own storage keys (written by the Enclosure script below). These gather them for saving and put them back.
const ELEC_KEYS={wizard:'enclosure.wizard',esphome:'esphome.form',parts:'parts',intent:'intent'};
// A phone topic saved in this browser by an older build (not an EvenUCan topic) is forgotten, so a fresh one is made.
try{const tk='opensketch.intent_inputs.ntfy_topic',tv=localStorage.getItem(tk);if(tv!=null&&!/^evenucan-/.test(tv))localStorage.removeItem(tk);}catch(e){}
const parseKey=k=>{const raw=store.get(k);if(raw==null)return null;try{return JSON.parse(raw);}catch(e){console.error('EvenUCan: stored "'+k+'" is not readable',e);return null;}};
// (r2) The "What do I want to build?" idea: {desc, analysis, inputKeys} in 'intent'; each answer the user gave
// (an OpenWeatherMap key, a town, an ntfy topic…) in its own key, 'intent_inputs.<key>'. Saved together as one object.
function intentState(){
  const it=parseKey(ELEC_KEYS.intent);if(!it||typeof it!=='object')return null;
  const keys=Array.isArray(it.inputKeys)?it.inputKeys:[],inputs={};
  for(const k of keys){const v=store.get('intent_inputs.'+k);if(v!=null)inputs[k]=v;}
  return {desc:String(it.desc||''),analysis:it.analysis||null,inputKeys:keys,inputs,platform:it.platform||null,platformOverride:!!it.platformOverride,missingAdded:Array.isArray(it.missingAdded)?it.missingAdded:[]};
}
function restoreIntent(t){
  if(!t||typeof t!=='object')return true;
  let ok=store.trySet(ELEC_KEYS.intent,JSON.stringify({desc:String(t.desc||''),analysis:t.analysis||null,inputKeys:Array.isArray(t.inputKeys)?t.inputKeys:[],
    platform:t.platform||null,platformOverride:!!t.platformOverride,missingAdded:Array.isArray(t.missingAdded)?t.missingAdded:[]}));
  if(t.inputs&&typeof t.inputs==='object')for(const k in t.inputs)if(/^[a-z0-9_]{1,40}$/i.test(k)&&!(k==='ntfy_topic'&&!/^evenucan-/.test(String(t.inputs[k]))))ok=store.trySet('intent_inputs.'+k,String(t.inputs[k]))&&ok;
  return ok;
}
// withParts: also the user's own parts that the wizard uses (for files; the autosave doesn't need them, they stay in 'parts')
function elecState(withParts){
  const wizard=parseKey(ELEC_KEYS.wizard),esphome=parseKey(ELEC_KEYS.esphome),intent=intentState();
  if(!wizard&&!esphome&&!intent)return null;
  const e={wizard,esphome};
  // (r3) the platform chosen and the parts the AI looked up are also at the top level, so other tools can read them
  if(intent){e.intent=intent;e.intent_platform=intent.platform;e.intent_platform_override=intent.platformOverride;e.intent_missing_parts_added=intent.missingAdded;}
  if(withParts&&wizard){
    const ids=new Set([...(Array.isArray(wizard.items)?wizard.items.map(i=>i&&i.pid):[]),wizard.battery,wizard.charger,wizard.swPart].filter(Boolean));
    const own=parseKey(ELEC_KEYS.parts);
    e.parts=Array.isArray(own)?own.filter(p=>p&&ids.has(p.id)):[];
  }
  return e;
}
// Puts a saved project's electronics back. Parts are merged into the user's own parts (the file's copy of a part
// replaces one with the same id, since the box was designed around it); the rest of the user's parts are kept.
function restoreElec(e){
  if(!e||typeof e!=='object')return;
  let ok=true;
  // (r3) parts the AI looked up go back into the user's own parts too (as with e.parts, the file's copy wins)
  const looked=Array.isArray(e.intent_missing_parts_added)?e.intent_missing_parts_added:e.intent&&Array.isArray(e.intent.missingAdded)?e.intent.missingAdded:[];
  if(looked.length)e=Object.assign({},e,{parts:[...(Array.isArray(e.parts)?e.parts:[]),...looked.filter(p=>p&&p.id&&!(Array.isArray(e.parts)&&e.parts.some(q=>q&&q.id===p.id)))]});
  if(e.wizard&&Array.isArray(e.wizard.items))ok=store.trySet(ELEC_KEYS.wizard,JSON.stringify(e.wizard))&&ok;
  if(e.esphome&&typeof e.esphome==='object')ok=store.trySet(ELEC_KEYS.esphome,JSON.stringify(e.esphome))&&ok;
  if(e.intent)ok=restoreIntent(e.intent)&&ok;
  if(Array.isArray(e.parts)&&e.parts.length){
    const own=parseKey(ELEC_KEYS.parts);
    // never write over saved parts that exist but can't be read (they would be lost)
    if(own===null&&store.get(ELEC_KEYS.parts)!=null){ok=false;console.error('EvenUCan: saved parts unreadable, the file\'s parts were not merged');}
    else{
      const list=Array.isArray(own)?own:[];
      for(const p of e.parts){if(!p||!p.id)continue;const i=list.findIndex(q=>q&&q.id===p.id);if(i>=0)list[i]=p;else list.push(p);}
      ok=store.trySet(ELEC_KEYS.parts,JSON.stringify(list))&&ok;
    }
  }
  // the Enclosure script keeps its own copy: tell it to read the keys again
  try{if(window.WFEnclosure&&window.WFEnclosure.reloadState)window.WFEnclosure.reloadState();}
  catch(err){ok=false;console.error('EvenUCan: could not refresh the Enclosure Wizard',err);}
  return ok;
}
// ---- Storage warnings (r1): a red bar that stays until closed or until the autosave works again.
let autosaveOK=true;
function storageWarn(msg){
  let b=$('wfStoreWarn');
  if(!b){b=document.createElement('div');b.id='wfStoreWarn';b.setAttribute('role','alert');
    b.style.cssText='position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:70;background:#b3261e;color:#fff;padding:8px 12px 8px 14px;border-radius:6px;box-shadow:0 2px 12px #0006;max-width:min(760px,calc(100vw - 32px));font-weight:600;display:flex;gap:10px;align-items:center';
    b.innerHTML='<span></span><button title="Hide" style="background:none;border:1px solid #fff8;color:#fff;border-radius:4px;cursor:pointer;padding:0 6px">✕</button>';
    b.querySelector('button').onclick=()=>{b.style.display='none';};document.body.appendChild(b);}
  b.firstChild.textContent=msg;b.style.display='flex';
}
function storageWarnHide(){const b=$('wfStoreWarn');if(b)b.style.display='none';}
function autosave(){
  const ok=store.trySet('autosave',JSON.stringify({name:docName,units,camera:cam,faces:model.faces,edges:model.edges,guides:model.guides,electronics:elecState(false)}));
  if(!ok&&autosaveOK){storageWarn('⚠ Autosave failed – this browser\'s storage is full. Save your file now with Ctrl+S, or your latest changes could be lost.');flash('⚠ Autosave failed — storage is full. Save your file manually with Ctrl+S.',8000);}
  else if(ok&&!autosaveOK)storageWarnHide();
  autosaveOK=ok;
}
// One look at startup at how full storage is (the browser's estimate where it has one, and how much of the
// roughly 5 MB a browser gives a page's settings the app has used).
async function checkStorageSpace(){
  try{
    let used=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);used+=k.length+(localStorage.getItem(k)||'').length;}
    if(used>4e6)return storageWarn('⚠ This browser\'s storage for EvenUCan is nearly full ('+(used/1048576).toFixed(1)+' MB of about 5 MB). Autosave may stop working: save your work as a file (Ctrl+S) and remove parts with big photos you don\'t need.');
    if(navigator.storage&&navigator.storage.estimate){const est=await navigator.storage.estimate();
      if(est&&est.quota&&est.quota-(est.usage||0)<2*1048576)storageWarn('⚠ This computer has less than 2 MB of browser storage left. Autosave may stop working: save your work as a file (Ctrl+S).');}
  }catch(e){console.warn('EvenUCan: storage check skipped',e);}
}
let units=store.get('units')||'mm';
const gridStep=()=>({mm:0.01,cm:0.01,m:1,in:0.0254,ft:0.3048})[units];
// Camera that frames the area around the origin at a sensible scale for the current units.
// Printer build volume in mm (centred on the origin), remembered per browser, not per drawing.
let bed=(()=>{try{const b=JSON.parse(store.get('bed'));if(b&&b.x>0&&b.y>0&&b.z>0)return b;}catch(e){/* intentional: default bed */}return {x:120,y:120,z:120};})();
function homeCam(){
  if(units==='mm'||units==='cm'){const m=Math.max(bed.x,bed.y)/1000;cam.target=[0,0,bed.z/4000];cam.dist=m*1.9;}
  else{const s=gridStep();cam.target=[0,0,s];cam.dist=s*25;}
}
let curColor='#c8a27a';
let lockAxis=null;
// The flat surface new shapes go on when they are not drawn on a face: the ground, or a side picked on the view cube.
let workPlane={name:"ground",n:Z,u:X,v:Y};
const DEF_FRONT=[0.93,0.92,0.88],BACK=[0.52,0.61,0.74],EDGE=[0.04,0.04,0.05],SEL_EDGE=[0.1,0.33,0.95];

const snapshot=(faces,edges)=>JSON.stringify({faces:faces||model.faces,edges:edges||model.edges,guides:model.guides});
// Each undo step keeps a name for the History panel: undoNames[i] goes with undoStack[i] (the model before that step).
let undoNames=[],redoNames=[],histTrimmed=false,histEl=null;
const STEP_NAMES={line:'Line',rect:'Rectangle',circle:'Circle',arc:'Arc',polygon:'Polygon',solid:'3D shape',push:'Push/Pull',move:'Move',rotate:'Rotate',round:'Round / Chamfer',offset:'Offset',follow:'Follow Me',slice:'Slice',erase:'Erase',paint:'Paint',tape:'Guide point',center:'Centre point'};
function pushUndo(s,name){
  undoStack.push(s||snapshot());undoNames.push(name||STEP_NAMES[toolName]||'Change');
  // Up to 300 steps, and no more than about 300 MB of them (big models, e.g. with threads, make big steps).
  let size=undoStack.reduce((n,x)=>n+x.length,0);
  while(undoStack.length>1&&(undoStack.length>300||size>150e6)){size-=undoStack[0].length;undoStack.shift();undoNames.shift();histTrimmed=true;}
  redoStack=[];redoNames=[];histChanged();
}
function dropUndo(){undoStack.pop();undoNames.pop();histChanged();}// a step that turned out not to change anything
function clearHistory(){undoStack=[];redoStack=[];undoNames=[];redoNames=[];histTrimmed=false;histChanged();}
function restore(s){const d=JSON.parse(s);model={faces:d.faces,edges:d.edges||[],guides:d.guides||[]};fixIds();}
function fixIds(){let m=0;for(const x of [...model.faces,...model.edges,...model.guides])m=Math.max(m,x.id);nextId=Math.max(nextId,m+1);}
// Go to the model as it was after the first k steps: back with undo, or forward again through steps undone.
function goToStep(k){
  if(tool.cancel)tool.cancel();
  if(k===undoStack.length)return;
  let cur=snapshot();
  while(undoStack.length>k){redoStack.push(cur);redoNames.push(undoNames.pop());cur=undoStack.pop();}
  while(undoStack.length<k&&redoStack.length){undoStack.push(cur);undoNames.push(redoNames.pop());cur=redoStack.pop();}
  restore(cur);selection.clear();commitChange();histChanged();
}
function undo(){if(!undoStack.length){if(tool.cancel)tool.cancel();return flash('Nothing to undo');}goToStep(undoStack.length-1);}
function redo(){if(!redoStack.length){if(tool.cancel)tool.cancel();return flash('Nothing to redo');}goToStep(undoStack.length+1);}
function commitChange(){markDirty();setDirty(true);scheduleAutosave();scheduleStats();if(check)scheduleCheck();if(model.faces.length&&window.cubeIntroOff)window.cubeIntroOff();}
// (Perf-r1) A drag commits on every mouse move: the autosave (the whole model as JSON), the Print check and the
// size readout wait until the edits pause. flushAutosave writes a waiting autosave at once (save, export, leaving).
let _autosaveTimer=null,_checkTimer=null,_statsTimer=null;
function scheduleAutosave(){clearTimeout(_autosaveTimer);_autosaveTimer=setTimeout(()=>{_autosaveTimer=null;autosave();},1500);}
function flushAutosave(){if(_autosaveTimer===null)return;clearTimeout(_autosaveTimer);_autosaveTimer=null;autosave();}
function scheduleCheck(){clearTimeout(_checkTimer);_checkTimer=setTimeout(()=>{_checkTimer=null;if(check)runCheck();},600);}
function scheduleStats(){clearTimeout(_statsTimer);_statsTimer=setTimeout(()=>{_statsTimer=null;updateStats();},80);}
function setDirty(v){docDirty=v;document.title=(v?'• ':'')+docName+' – EvenUCan';if(window.wfUpdateStrip)window.wfUpdateStrip();}

function addFace(pts,nHint,color){
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
}
function loopCrosses(F,pts){
  const n=faceNormal(F),[u,v]=basis(n),o=F.pts[0],t=q=>to2(q,o,u,v);
  const A=pts.map(t);
  for(const L of loops(F)){const B=L.map(t);
    for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++)
      if(segX(A[i],A[(i+1)%A.length],B[j],B[(j+1)%B.length]))return true;}
  return false;
}
function insertPt(pts,p){
  const k=key(p);const i=pts.findIndex(q=>key(q)===k);if(i>=0)return i;
  for(let j=0;j<pts.length;j++){
    const a=pts[j],b=pts[(j+1)%pts.length],D=sub(b,a),L2=dot(D,D);if(L2<1e-12)continue;
    const s=dot(sub(p,a),D)/L2;if(s<=0||s>=1)continue;
    if(dist(add(a,mul(D,s)),p)<1e-5){pts.splice(j+1,0,p);return j+1;}
  }
  return -1;
}
// A line drawn across a face from edge to edge divides it in two.
function trySplit(a,b){
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
}
// Missing corners: wherever two loose lines meet in an L (corner C, ends A and B),
// the point A+B-C completes the square/rectangle/parallelogram.
let compCache=null;
function completions(){
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
}
// Open edges: face edges used by only one face (the rim of a hole), as [from,to] in that face's winding.
function openEdges(){
  const cnt=new Map(),list=[];
  const ek=(ka,kb)=>ka<kb?ka+'|'+kb:kb+'|'+ka;
  for(const f of model.faces)for(const L of loops(f))for(let i=0;i<L.length;i++){
    const p=L[i],q=L[(i+1)%L.length],k=ek(key(p),key(q));cnt.set(k,(cnt.get(k)||0)+1);list.push([p,q,k]);
  }
  return list.filter(e=>cnt.get(e[2])===1).map(e=>[e[0],e[1]]);
}
function onSeg3(p,a,b){const D=sub(b,a),L2=dot(D,D);if(L2<1e-12)return false;const s=clamp(dot(sub(p,a),D)/L2,0,1);return dist(add(a,mul(D,s)),p)<1e-5;}
// The open edge that segment a-b was traced along, if any.
function openEdgeUnder(a,b){for(const [p,q] of openEdges())if(onSeg3(a,p,q)&&onSeg3(b,p,q))return [p,q];return null;}
// Find a flat loop through edge a-b made of open face edges and loose lines, and fill it with a face.
function closeLoop(a,b,newEdgeId){
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
}
// Where 2D segments a-b and c-d meet: list of [t on a-b, w on c-d] (crossings, touches and collinear overlaps).
function segHits(a,b,c,d){
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
}
// Make everything on one flat surface "stick together" like SketchUp: lines are cut where they cross,
// and overlapping faces are rebuilt as separate regions, so each piece can be erased or pushed on its own.
function planarize(n,o){
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
}
// Planarize the flat surface a new line a-b lies on.
function planarizeSeg(a,b){
  const f=model.faces.find(f=>{const n=faceNormal(f);return Math.abs(dot(sub(a,f.pts[0]),n))<1e-6&&Math.abs(dot(sub(b,f.pts[0]),n))<1e-6;});
  if(f)planarize(faceNormal(f),f.pts[0]);
  else if(Math.abs(a[2]-b[2])<1e-9)planarize(Z,[0,0,a[2]]);
}
// Join two faces in the same plane that share a line (used when that line is erased).
function mergeFaces(A,B){
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
}
function pushPull(id,d){pushPullMany([id],d);}
// Push or pull several faces together by the same distance, each along its own normal. Where two of them share a
// line (a shape split by lines into strips), no wall is made between them, so they rise as one solid.
function pushPullMany(ids,d){
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
}
function componentOf(fid){
  const byKey=new Map();
  for(const f of model.faces)for(const L of loops(f))for(const p of L){const k=key(p);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(f);}
  const start=model.faces.find(f=>f.id===fid),gid=start&&start.g;
  const seen=new Set([fid]),q=[start];
  // Connected faces of the same group (or, for loose geometry, other loose faces): groups never join up with neighbours.
  while(q.length){const f=q.pop();if(!f)continue;
    for(const L of loops(f))for(const p of L)for(const g of byKey.get(key(p))||[])if(!seen.has(g.id)&&g.g===gid){seen.add(g.id);q.push(g);}}
  return gid?expandGroups(seen):seen;
}
function vertsOf(ids){
  const s=new Set();
  for(const f of model.faces)if(ids.has(f.id))for(const L of loops(f))for(const p of L)s.add(key(p));
  for(const e of model.edges)if(ids.has(e.id)){s.add(key(e.a));s.add(key(e.b));}
  return s;
}
function touching(vset){
  const s=new Set();
  for(const f of model.faces)if(loops(f).some(L=>L.some(p=>vset.has(key(p)))))s.add(f.id);
  for(const e of model.edges)if(vset.has(key(e.a))||vset.has(key(e.b)))s.add(e.id);
  return s;
}
function xform(vset,fn){
  const m=p=>vset.has(key(p))?clean(fn(p)):p;
  for(const f of model.faces){f.pts=f.pts.map(m);f.holes=f.holes.map(h=>h.map(m));delete f._tc;}
  for(const e of model.edges){e.a=m(e.a);e.b=m(e.b);}
}
function copyEntities(srcF,srcE,ids,fn){
  // Each copy of a group becomes its own new group.
  const gmap=new Map(),ng=g=>{if(!g)return undefined;if(!gmap.has(g))gmap.set(g,nid());return gmap.get(g);};
  for(const f of srcF)if(ids.has(f.id))model.faces.push({id:nid(),pts:f.pts.map(p=>clean(fn(p))),holes:f.holes.map(h=>h.map(p=>clean(fn(p)))),color:f.color,g:ng(f.g),soft:f.soft||undefined});
  for(const e of srcE)if(ids.has(e.id))model.edges.push({id:nid(),a:clean(fn(e.a)),b:clean(fn(e.b)),g:ng(e.g)});
}
// ---- Groups: faces/lines sharing a `g` value select and move as one unit and never merge with other geometry.
const groupable=()=>[...model.faces,...model.edges];
// Add every member of any group that one of these ids belongs to.
function expandGroups(ids){
  const gs=new Set();for(const x of groupable())if(ids.has(x.id)&&x.g)gs.add(x.g);
  if(!gs.size)return ids;
  const out=new Set(ids);for(const x of groupable())if(x.g&&gs.has(x.g))out.add(x.id);
  return out;
}
const hasGroup=ids=>groupable().some(x=>ids.has(x.id)&&x.g);
// Move/rotate only these entities' own points, so a group stays rigid and doesn't drag touching geometry.
function xformIds(ids,fn){
  const m=p=>clean(fn(p));
  for(const f of model.faces)if(ids.has(f.id)){f.pts=f.pts.map(m);f.holes=f.holes.map(h=>h.map(m));delete f._tc;}
  for(const e of model.edges)if(ids.has(e.id)){e.a=m(e.a);e.b=m(e.b);}
}
const groupCount=()=>new Set(groupable().map(x=>x.g).filter(Boolean)).size;
function isPlanar(pts){const n=loopNormal(pts);return len(n)>0.5&&pts.every(p=>Math.abs(dot(sub(p,pts[0]),n))<1e-5);}

// ---------------------------------------------------------------- units
const UNITS={mm:0.001,cm:0.01,m:1,in:0.0254,ft:0.3048};
function fmt(m){
  if(units==='ft'){
    const sign=m<0?'-':'';let a=Math.abs(m)/0.0254,ft=Math.floor(a/12+1e-9),inch=Math.round((a-ft*12)*100)/100;
    if(inch>=12){ft++;inch-=12;}
    return sign+(ft?ft+"' ":'')+inch+'"';
  }
  const dp={mm:1,cm:2,m:3,in:2}[units];
  return (+(m/UNITS[units]).toFixed(dp))+(units==='in'?'"':' '+units);
}
function parseLen(s){
  s=s.trim();
  let m=s.match(/^(-?\d*\.?\d+)\s*'\s*(?:(\d*\.?\d+)\s*"?)?$/);
  if(m){const f=parseFloat(m[1]);return (f*12+(m[2]?parseFloat(m[2]):0)*(f<0||m[1][0]==='-'?-1:1))*0.0254;}
  m=s.match(/^(-?\d*\.?\d+)\s*(mm|cm|m|in|ft|"|')?$/i);
  if(!m)return NaN;
  const u=(m[2]||'').toLowerCase();
  const f=u==='"'?0.0254:u==="'"?0.3048:u?UNITS[u]:UNITS[units];
  return parseFloat(m[1])*f;
}

// ---------------------------------------------------------------- camera
const cam={target:[0,0,1],dist:20,yaw:-1.0,pitch:0.27,fov:35*Math.PI/180,ortho:false};
const cv=$('gl');
let CB=null;
function camDirty(){CB=null;requestDraw();}
function getCB(){
  if(CB)return CB;
  const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
  const dir=[cp*Math.cos(cam.yaw),cp*Math.sin(cam.yaw),sp];
  const eye=add(cam.target,mul(dir,cam.dist)),f=mul(dir,-1),r=[-Math.sin(cam.yaw),Math.cos(cam.yaw),0],u=cross(r,f);
  const W=cv.clientWidth||1,H=cv.clientHeight||1,th=Math.tan(cam.fov/2);
  return CB={eye,f,r,u,W,H,th,asp:W/H,hh:cam.dist*th};
}
function screenRay(mx,my){
  const C=getCB(),x=mx/C.W*2-1,y=1-my/C.H*2;
  if(!cam.ortho)return {o:C.eye,d:norm(add(C.f,add(mul(C.r,x*C.th*C.asp),mul(C.u,y*C.th))))};
  const o=add(C.eye,add(mul(C.r,x*C.hh*C.asp),mul(C.u,y*C.hh)));
  return {o:sub(o,mul(C.f,cam.dist*50)),d:C.f};
}
function toScreen(p){
  const C=getCB(),d=sub(p,C.eye),z=dot(d,C.f);let x,y;
  if(!cam.ortho){if(z<1e-6)return null;x=dot(d,C.r)/(z*C.th*C.asp);y=dot(d,C.u)/(z*C.th);}
  else{x=dot(d,C.r)/(C.hh*C.asp);y=dot(d,C.u)/C.hh;}
  return [(x+1)/2*C.W,(1-y)/2*C.H];
}
function mvp(){
  const C=getCB(),{eye,f,r,u}=C;
  const view=[r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,eye),-dot(u,eye),dot(f,eye),1];
  // Keep the depth range snug around the scene (grid included) so small parts get full depth precision.
  const far=cam.dist*40+gridStep()*200;let proj;
  if(!cam.ortho){
    // Near cut-off from how close the camera really is to the model, so zooming in close never slices parts away.
    let near=Math.max(cam.dist/150,1e-5);
    const sb=sceneBox();
    if(sb){const q=[0,1,2].map(i=>Math.max(sb.mn[i]-eye[i],0,eye[i]-sb.mx[i]));near=Math.max(Math.min(near,len(q)*0.5),cam.dist/5000,1e-5);}
    const t=1/C.th;
    proj=[t/C.asp,0,0,0,0,t,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];}
  else{const hw=C.hh*C.asp;proj=[1/hw,0,0,0,0,1/C.hh,0,0,0,0,-1/far,0,0,0,0,1];}
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let rr=0;rr<4;rr++){let s=0;for(let k=0;k<4;k++)s+=proj[k*4+rr]*view[c*4+k];o[c*4+rr]=s;}
  return o;
}
function zoomAt(mx,my,factor){
  const ray=screenRay(mx,my);
  let p=null;const h=pickFace(ray);
  if(h)p=h.p;else{const g=rayPlane(ray,[0,0,0],Z);if(g)p=g;}
  if(!p||dist(p,getCB().eye)>cam.dist*10)p=cam.ortho?add(ray.o,mul(ray.d,cam.dist*51)):add(ray.o,mul(ray.d,cam.dist));
  const nd=clamp(cam.dist*factor,0.0003,1e5);factor=nd/cam.dist;
  cam.target=add(p,mul(sub(cam.target,p),factor));cam.dist=nd;camDirty();
  // Keep the camera's centre point on the surface in front of it, so the next zoom steps stay in proportion.
  const C=getCB(),cr=screenRay(C.W/2,C.H/2),hc=pickFace(cr);
  if(factor<1&&hc&&!cam.ortho&&hc.t<cam.dist){cam.target=hc.p;cam.dist=Math.max(hc.t,0.0003);camDirty();}
}
function setView(v){
  const P={iso:[-1.0,0.27],top:[-Math.PI/2,Math.PI/2-1e-4],front:[-Math.PI/2,0],right:[0,0],back:[Math.PI/2,0],left:[Math.PI,0]}[v];
  cam.yaw=P[0];cam.pitch=P[1];camDirty();
}
function zoomExtents(ids){// ids: fit only these (e.g. the selection)
  const pts=[];for(const f of model.faces)if(!ids||ids.has(f.id))for(const p of f.pts)pts.push(p);for(const e of model.edges)if(!ids||ids.has(e.id))pts.push(e.a,e.b);
  if(ids)for(const g of model.guides)if(ids.has(g.id))pts.push(g.p);
  if(!pts.length){homeCam();return camDirty();}
  const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const p of pts)for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}
  cam.target=mul(add(mn,mx),0.5);
  const r=Math.max(dist(mn,mx)/2,0.002),C=getCB();
  cam.dist=r/Math.sin(Math.min(cam.fov/2,Math.atan(C.th*C.asp)))*1.1;camDirty();
}

// ---------------------------------------------------------------- picking & inference
function pickFace(ray,faces,ex){
  let best=null;
  for(const f of faces||model.faces){
    if(f.hidden||ex&&ex.has(f.id))continue;
    const n=faceNormal(f),den=dot(ray.d,n);if(Math.abs(den)<1e-9)continue;
    const t=dot(sub(f.pts[0],ray.o),n)/den;if(t<=0||(best&&t>=best.t))continue;
    const p=add(ray.o,mul(ray.d,t));if(!insideFace(f,p,false))continue;
    best={t,p,face:f};
  }
  return best;
}
function pickEdge(mx,my){
  let best=null,bd=8;
  for(const e of model.edges){const a=toScreen(e.a),b=toScreen(e.b);if(!a||!b)continue;
    const d=dSeg2([mx,my],a,b);if(d<bd){bd=d;best=e;}}
  return best;
}
function pickGuide(mx,my){
  let best=null,bd=8;
  for(const g of model.guides){const s=toScreen(g.p);if(!s)continue;const d=Math.hypot(s[0]-mx,s[1]-my);if(d<bd){bd=d;best=g;}}
  return best;
}
function pickEntity(mx,my){const g=pickGuide(mx,my);if(g)return g.id;const e=pickEdge(mx,my);if(e)return e.id;const h=pickFace(screenRay(mx,my));return h?h.face.id:null;}
const SNAP=10;
// The corner, line end or guide point under the mouse, if any.
function cornerNear(mx,my,ex){
  let best=null,bd=SNAP;
  const consider=p=>{const s=toScreen(p);if(!s)return;const d=Math.hypot(s[0]-mx,s[1]-my);if(d<bd){bd=d;best=p;}};
  for(const f of model.faces){if(f.hidden||ex&&ex.has(f.id))continue;for(const L of loops(f))L.forEach(consider);}
  for(const e of model.edges){if(ex&&ex.has(e.id))continue;consider(e.a);consider(e.b);}
  for(const g of model.guides)consider(g.p);
  return best;
}
function inferPoint(mx,my,o){
  o=o||{};
  const ray=screenRay(mx,my),faces=o.faces||model.faces,ex=o.exclude;
  const fin=(p,type,extra)=>{
    const r=Object.assign({p:clean(o.plane?projPlane(p,o.plane):p),type},extra||{});
    if(!o.plane){const fh=pickFace(ray,faces,ex);if(fh&&Math.abs(dot(sub(r.p,fh.face.pts[0]),faceNormal(fh.face)))<1e-5)r.face=fh.face;}
    return r;
  };
  if(o.base&&lockAxis&&!o.plane){
    const D=AXES[lockAxis],P=cornerNear(mx,my,ex);
    // "From Point": hovering a corner while locked gives the point on the axis level with it (e.g. a post up to another part's height)
    if(P&&Math.abs(dot(sub(P,o.base),D))>1e-6)return fin(add(o.base,mul(D,dot(sub(P,o.base),D))),'axis',{axis:lockAxis,locked:true,label:'From Point',from:P});
    return fin(add(o.base,mul(D,rayLineClosest(ray.o,ray.d,o.base,D))),'axis',{axis:lockAxis,locked:true});
  }
  let best=null,bd=SNAP;
  // A corner or edge hidden behind a face can't be snapped to (as in SketchUp): otherwise the far edge of a thin post,
  // seen through it, steals the click and a rectangle meant for its side is drawn flat.
  const hidden=p=>{const s=toScreen(p);if(!s)return false;const r=screenRay(s[0],s[1]),h=pickFace(r,faces,ex);if(!h)return false;const tp=dot(sub(p,r.o),r.d);return h.t<tp-1e-6-tp*1e-4;};
  const consider=(p,type,label)=>{const s=toScreen(p);if(!s)return;const d=Math.hypot(s[0]-mx,s[1]-my);if(d<bd&&!hidden(p)){bd=d;best={p,type,label};}};
  const segs=[];
  if(!o.vertexOnly)consider([0,0,0],'endpoint');
  for(const f of faces){if(ex&&ex.has(f.id))continue;for(const L of loops(f))for(let i=0;i<L.length;i++){consider(L[i],'endpoint');segs.push([L[i],L[(i+1)%L.length]]);}}
  for(const e of model.edges){if(ex&&ex.has(e.id))continue;consider(e.a,'endpoint');consider(e.b,'endpoint');segs.push([e.a,e.b]);}
  for(const g of model.guides)consider(g.p,'guide');
  if(!o.vertexOnly)for(const c of completions())consider(c.p,'complete',c.label);
  if(o.extra){o.extra.forEach(p=>consider(p,'endpoint'));for(let i=1;i<o.extra.length;i++)segs.push([o.extra[i-1],o.extra[i]]);}
  if(best)return fin(best.p,best.type,{label:best.label});
  if(o.vertexOnly)return null;
  bd=SNAP-2;
  for(const [a,b] of segs)consider(mul(add(a,b),0.5),'midpoint');
  if(best)return fin(best.p,'midpoint');
  let eb=null;bd=7;
  for(const [a,b] of segs){
    const D=sub(b,a);if(dot(D,D)<1e-12)continue;
    const q=add(a,mul(D,clamp(rayLineClosest(ray.o,ray.d,a,D),0,1))),sp=toScreen(q);if(!sp)continue;
    const d=Math.hypot(sp[0]-mx,sp[1]-my);if(d<bd&&!hidden(q)){bd=d;eb=q;}
  }
  if(eb)return fin(eb,'edge');
  if(o.base&&!o.noAxes){
    // Snap to the red/green/blue direction by angle, as in SketchUp: the further the mouse is from the start,
    // the wider the catch, so moving roughly upwards draws straight up.
    const s0=toScreen(o.base),reach=s0?Math.hypot(mx-s0[0],my-s0[1]):0;
    let ab=null,bs=1;
    for(const name of ['x','y','z']){
      const D=AXES[name];
      if(!s0||Math.abs(dot(D,ray.d))>0.85)continue;// this axis points (nearly) at the viewer: no direction to follow on screen
      const q=add(o.base,mul(D,rayLineClosest(ray.o,ray.d,o.base,D))),sp=toScreen(q);if(!sp)continue;
      const tol=Math.max(SNAP,reach*0.2),r=Math.hypot(sp[0]-mx,sp[1]-my)/tol;
      if(r<bs&&dist(q,o.base)>1e-6){bs=r;ab={q,name};}
    }
    if(ab)return fin(ab.q,'axis',{axis:ab.name});
  }
  if(o.plane){const p=rayPlane(ray,o.plane.p,o.plane.n);return p?{p:clean(p),type:'plane'}:null;}
  const fh=pickFace(ray,faces,ex);
  if(fh)return {p:clean(fh.p),type:'face',face:fh.face};
  const gp=rayPlane(ray,o.base||[0,0,0],workPlane.n);
  return gp?{p:clean(gp),type:o.base?'plane':'ground'}:null;
}
const AXCOL={x:[0.85,0.1,0.1],y:[0.1,0.6,0.1],z:[0.1,0.25,0.95]};
const axisColor=inf=>inf&&inf.type==='axis'?AXCOL[inf.axis]:[0.1,0.1,0.1];

// ---------------------------------------------------------------- WebGL
// Opaque canvas: the view paints its own sky and ground, so it looks the same in every browser.
const gl=cv.getContext('webgl',{antialias:true,preserveDrawingBuffer:true,alpha:false});
if(!gl){document.body.innerHTML='<p style="padding:20px">Sorry, this browser does not support WebGL, which EvenUCan needs.</p>';return;}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
const faceProg=program(
`attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;attribute float aId;attribute float aSel;
uniform mat4 uMVP;uniform float uHover;
varying vec3 vNor;varying vec3 vCol;varying float vSel;varying float vHov;
void main(){gl_Position=uMVP*vec4(aPos,1.0);vNor=aNor;vCol=aCol;vSel=aSel;vHov=abs(aId-uHover)<0.5?1.0:0.0;}`,
`precision mediump float;
varying vec3 vNor;varying vec3 vCol;varying float vSel;varying float vHov;
uniform vec3 uSun;uniform vec3 uFill;uniform vec3 uBack;
void main(){vec3 n=normalize(vNor);vec3 c=vCol;
if(!gl_FrontFacing){n=-n;c=uBack;}
float l=0.46+0.44*max(dot(n,uSun),0.0)+0.16*max(dot(n,uFill),0.0);
vec3 col=c*l;
if(vSel>0.5){float s=mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),4.0);col=mix(col,vec3(0.18,0.38,0.95),s<1.0?0.65:0.18);}
if(vHov>0.5)col=mix(col,vec3(1.0,0.82,0.25),0.3);
gl_FragColor=vec4(min(col,vec3(1.0)),1.0);}`);
// Sky and ground, worked out per pixel from the view direction so the horizon sits where it really is.
// The ground grid and red/green axes are drawn here too, per pixel, so their thickness can be set in
// screen points (plain WebGL lines are stuck at 1 device pixel, which vanishes on high-DPI screens).
const SKY_VS=`attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.0,1.0);}`;
const SKY_COMMON=`varying vec2 vP;uniform vec3 uR;uniform vec3 uU;uniform vec3 uF;uniform vec2 uS;
uniform vec3 uEye;uniform vec2 uO;uniform float uOrtho;uniform float uStep;uniform float uPx;uniform vec3 uBed;
vec3 skyCol(){vec3 d=normalize(uF+uR*vP.x*uS.x+uU*vP.y*uS.y);float e=d.z;
vec3 sky=mix(vec3(0.80,0.88,0.95),vec3(0.42,0.62,0.85),smoothstep(0.0,0.55,e));
vec3 gnd=mix(vec3(0.82,0.82,0.78),vec3(0.70,0.71,0.67),smoothstep(0.0,0.6,-e));
return mix(gnd,sky,smoothstep(-0.003,0.003,e));}`;
const SKY_GRID_FS=`#extension GL_OES_standard_derivatives : enable
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
${SKY_COMMON}
float lineA(float c,float fw,float w){return 1.0-smoothstep(w*0.5-0.5,w*0.5+0.5,abs(c)/max(fw,1e-7));}
float gridA(vec2 c,float w){vec2 fw=fwidth(c);vec2 g=fract(c+0.5)-0.5;
 float a=max(lineA(g.x,fw.x,w),lineA(g.y,fw.y,w));
 return a*(1.0-smoothstep(0.06,0.25,max(fw.x,fw.y)));}
void main(){vec3 col=skyCol();
 vec3 d=uOrtho>0.5?uF:normalize(uF+uR*vP.x*uS.x+uU*vP.y*uS.y);
 vec3 o=uOrtho>0.5?uEye+uR*vP.x*uO.x+uU*vP.y*uO.y-uF*uO.y*400.0:uEye;
 if(abs(d.z)>1e-6){float t=-o.z/d.z;if(t>0.0){
  vec2 p=(o+d*t).xy,c=p/uStep;vec2 fw=fwidth(c);
  // Print bed: a lighter plate with a border; the grid is only drawn on it.
  vec2 hb=uBed.xy*0.5;float inside=step(abs(p.x),hb.x)*step(abs(p.y),hb.y);
  col=mix(col,vec3(0.90,0.91,0.91),inside*0.6);
  col=mix(col,vec3(0.52,0.54,0.55),gridA(c*10.0,uPx*0.8)*0.35*inside);
  col=mix(col,vec3(0.45,0.47,0.47),gridA(c,uPx)*0.55*inside);
  col=mix(col,vec3(0.30,0.32,0.33),gridA(c/10.0,uPx*1.5)*0.65*inside);
  vec2 eb=(abs(p)-hb)/uStep;float near=1.0-smoothstep(0.5,3.0,max(fw.x,fw.y));
  float border=max(lineA(eb.x,fw.x,uPx*2.2)*step(abs(p.y),hb.y),lineA(eb.y,fw.y,uPx*2.2)*step(abs(p.x),hb.x))*near;
  col=mix(col,vec3(0.22,0.25,0.30),border);float far=1.0-smoothstep(0.4,2.5,max(fw.x,fw.y));// fade axes toward the horizon
  float xa=lineA(c.y,fw.y,uPx*2.0)*(p.x<0.0?step(0.5,fract(c.x*0.5)):1.0)*far;
  float ya=lineA(c.x,fw.x,uPx*2.0)*(p.y<0.0?step(0.5,fract(c.y*0.5)):1.0)*far;
  col=mix(col,p.x<0.0?vec3(0.85,0.45,0.45):vec3(0.85,0.12,0.12),xa);
  col=mix(col,p.y<0.0?vec3(0.45,0.72,0.45):vec3(0.12,0.6,0.12),ya);
 }}
 gl_FragColor=vec4(col,1.0);}`;
const SKY_PLAIN_FS=`precision mediump float;${SKY_COMMON}void main(){gl_FragColor=vec4(skyCol(),1.0);}`;
let skyProg,gridInSky=false;
if(gl.getExtension('OES_standard_derivatives')){try{skyProg=program(SKY_VS,SKY_GRID_FS);gridInSky=true;}catch(err){console.warn(err);}}
if(!skyProg)skyProg=program(SKY_VS,SKY_PLAIN_FS);
const SK={buf:gl.createBuffer(),aP:gl.getAttribLocation(skyProg,'aP')};
for(const u of ['uR','uU','uF','uS','uEye','uO','uOrtho','uStep','uPx','uBed'])SK[u]=gl.getUniformLocation(skyProg,u);
gl.bindBuffer(gl.ARRAY_BUFFER,SK.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
function drawSky(){
  const C=getCB();gl.useProgram(skyProg);
  gl.uniform3fv(SK.uR,C.r);gl.uniform3fv(SK.uU,C.u);gl.uniform3fv(SK.uF,C.f);gl.uniform2f(SK.uS,C.th*C.asp,C.th);
  gl.uniform3fv(SK.uEye,C.eye);gl.uniform2f(SK.uO,C.hh*C.asp,C.hh);gl.uniform1f(SK.uOrtho,cam.ortho?1:0);
  gl.uniform1f(SK.uStep,gridStep());gl.uniform1f(SK.uPx,1.15*(window.devicePixelRatio||1));
  if(SK.uBed)gl.uniform3f(SK.uBed,bed.x/1000,bed.y/1000,bed.z/1000);
  gl.bindBuffer(gl.ARRAY_BUFFER,SK.buf);gl.enableVertexAttribArray(SK.aP);gl.vertexAttribPointer(SK.aP,2,gl.FLOAT,false,0,0);
  gl.disable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.enable(gl.DEPTH_TEST);
  gl.disableVertexAttribArray(SK.aP);
}
const lineProg=program(
`attribute vec3 aPos;attribute vec3 aCol;uniform mat4 uMVP;uniform vec3 uEye;uniform float uPull;varying vec3 vCol;
void main(){gl_Position=uMVP*vec4(aPos+(uEye-aPos)*uPull,1.0);vCol=aCol;}`,
`precision mediump float;varying vec3 vCol;void main(){gl_FragColor=vec4(vCol,1.0);}`);
const FL={},LL={};
for(const a of ['aPos','aNor','aCol','aId','aSel'])FL[a]=gl.getAttribLocation(faceProg,a);
for(const u of ['uMVP','uHover','uSun','uFill','uBack'])FL[u]=gl.getUniformLocation(faceProg,u);
for(const a of ['aPos','aCol'])LL[a]=gl.getAttribLocation(lineProg,a);
LL.uMVP=gl.getUniformLocation(lineProg,'uMVP');LL.uEye=gl.getUniformLocation(lineProg,'uEye');LL.uPull=gl.getUniformLocation(lineProg,'uPull');
const mkBuf=()=>gl.createBuffer();
const BF={pos:mkBuf(),nor:mkBuf(),col:mkBuf(),id:mkBuf(),sel:mkBuf()},BE={pos:mkBuf(),col:mkBuf(),n:0},BG={pos:mkBuf(),col:mkBuf(),n:0},BP={pos:mkBuf(),col:mkBuf(),n:0},BC={pos:mkBuf(),col:mkBuf(),n:0},BH={pos:mkBuf(),col:mkBuf(),n:0};
// Ghost lines: see-through outlines (e.g. the parts inside a generated enclosure). Never saved or exported.
// They belong to a group (the enclosure base): they are kept relative to four of its corners and redrawn
// wherever that group is now, so they move, turn and flip with it, and disappear when it is deleted or undone.
// (Before 1.9.36 they were fixed in space, so moving the box left them behind as stray "ghost lines".)
let ghostOn=true,ghostSrc=null;
function ghostAnchors(faces){
  const all=[];for(const f of faces||[])if(f&&f.id!=null)f.pts.forEach((p,i)=>all.push({id:f.id,i,p:p.slice()}));
  if(all.length<3)return null;
  const far=(sc)=>all.reduce((b,a)=>sc(a.p)>sc(b.p)?a:b,all[0]);
  const a0=all[0],a1=far(p=>dist(p,a0.p));if(dist(a1.p,a0.p)<1e-7)return null;
  const e1=norm(sub(a1.p,a0.p)),off=p=>{const v=sub(p,a0.p);return len(sub(v,mul(e1,dot(v,e1))));};
  const a2=far(off);if(off(a2.p)<1e-7)return null;
  const n=norm(cross(e1,sub(a2.p,a0.p))),a3=far(p=>Math.abs(dot(sub(p,a0.p),n)));
  return Math.abs(dot(sub(a3.p,a0.p),n))>1e-7?[a0,a1,a2,a3]:[a0,a1,a2];
}
function ghostFrame(q){
  const e1=norm(sub(q[1],q[0])),v=sub(q[2],q[0]),e2=norm(sub(v,mul(e1,dot(v,e1))));
  let e3=cross(e1,e2);
  if(q[3]){const w=sub(q[3],q[0]);e3=norm(sub(sub(w,mul(e1,dot(w,e1))),mul(e2,dot(w,e2))));}
  return [e1,e2,e3];
}
function setGhosts(lines,owner){
  const P=[],C=[];for(const [a,b,c] of lines||[]){P.push(...a,...b);C.push(...c,...c);}
  const anchors=P.length&&owner?ghostAnchors(owner):null;
  ghostSrc=P.length?{P,anchors,sig:null,cur:null}:null;
  upload(BH.col,C);BH.n=0;ghostOn=true;placeGhosts();requestDraw();
}
// Called before every redraw: cheap unless the owning group has moved since last time.
function placeGhosts(){
  const S=ghostSrc;if(!S){BH.n=0;return;}
  if(!S.anchors){if(S.sig!=='fixed'){upload(BH.pos,S.P);BH.n=S.P.length/3;S.cur=S.P;S.sig='fixed';}return;}
  const byId=new Map();for(const a of S.anchors)byId.set(a.id,null);
  for(const f of model.faces)if(byId.has(f.id))byId.set(f.id,f);
  const now=[];
  for(const a of S.anchors){const f=byId.get(a.id);if(!f||f.hidden||!f.pts[a.i]){if(S.sig!=='gone'){BH.n=0;S.cur=null;S.sig='gone';}return;}now.push(f.pts[a.i]);}
  const sig=now.map(p=>p.join(',')).join(';');if(sig===S.sig)return;S.sig=sig;
  // resized or reshaped: the outlines would no longer fit, so hide them rather than draw them wrong
  if(now.some((p,i)=>i&&Math.abs(dist(p,now[0])-dist(S.anchors[i].p,S.anchors[0].p))>1e-6+1e-4*dist(S.anchors[i].p,S.anchors[0].p))){BH.n=0;S.cur=null;return;}
  const o=S.anchors[0].p,F0=ghostFrame(S.anchors.map(a=>a.p)),F1=ghostFrame(now),Q=new Array(S.P.length);
  for(let k=0;k<S.P.length;k+=3){
    const v=[S.P[k]-o[0],S.P[k+1]-o[1],S.P[k+2]-o[2]],c=F0.map(e=>dot(v,e));
    for(let i=0;i<3;i++)Q[k+i]=now[0][i]+c[0]*F1[0][i]+c[1]*F1[1][i]+c[2]*F1[2][i];
  }
  upload(BH.pos,Q);BH.n=Q.length/3;S.cur=Q;
}
let faceCount=0;
function upload(b,arr){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);}
function attrib(loc,b,size){if(loc<0)return;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);}
const hex=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

function rebuild(){
  const P=[],N=[],C=[],I=[],S=[],EP=[],EC=[],HP=[],HC=[],HIDE=[0.62,0.63,0.66];
  model.faces.forEach((f,idx)=>{
    // Hidden faces: no fill, just a faint outline (drawn first so real edges on top win).
    if(f.hidden){for(const L of loops(f))for(let i=0;i<L.length;i++){HP.push(...L[i],...L[(i+1)%L.length]);HC.push(...HIDE,...HIDE);}return;}
    let t=tcGet(f);
    if(!t){try{t=triangulate(f);tcSet(f,t);}catch(err){return;}}
    const n=faceNormal(f),col=f.color?hex(f.color):DEF_FRONT,sel=selection.has(f.id)?1:0;
    for(const i of t.tris){const p=t.V[i];P.push(p[0],p[1],p[2]);N.push(n[0],n[1],n[2]);C.push(col[0],col[1],col[2]);I.push(idx);S.push(sel);}
    const ec=sel?SEL_EDGE:EDGE;
    // Soft faces (the facets of a curved surface) don't draw their own edges; flat neighbours outline them.
    if(!f.soft||sel)for(const L of loops(f))for(let i=0;i<L.length;i++){const a=L[i],b=L[(i+1)%L.length];EP.push(a[0],a[1],a[2],b[0],b[1],b[2]);EC.push(...ec,...ec);}
  });
  for(const e of model.edges){const ec=selection.has(e.id)?SEL_EDGE:EDGE;EP.push(...e.a,...e.b);EC.push(...ec,...ec);}
  EP.unshift(...HP);EC.unshift(...HC);
  // A selected group gets a blue bounding box, like SketchUp.
  const gsel=new Set(groupable().filter(x=>x.g&&selection.has(x.id)).map(x=>x.g));
  for(const g of gsel){
    const b=bounds(new Set(groupable().filter(x=>x.g===g).map(x=>x.id)));if(!b)continue;
    const pad=Math.max(...b.size)*0.02+1e-4,mn=b.mn.map(v=>v-pad),mx=b.mx.map(v=>v+pad);
    const c=(i,j,k)=>[i?mx[0]:mn[0],j?mx[1]:mn[1],k?mx[2]:mn[2]];
    for(const [p,q] of [[c(0,0,0),c(1,0,0)],[c(0,1,0),c(1,1,0)],[c(0,0,1),c(1,0,1)],[c(0,1,1),c(1,1,1)],[c(0,0,0),c(0,1,0)],[c(1,0,0),c(1,1,0)],[c(0,0,1),c(0,1,1)],[c(1,0,1),c(1,1,1)],[c(0,0,0),c(0,0,1)],[c(1,0,0),c(1,0,1)],[c(0,1,0),c(0,1,1)],[c(1,1,0),c(1,1,1)]]){
      EP.push(...p,...q);EC.push(...SEL_EDGE,...SEL_EDGE);
    }
  }
  upload(BF.pos,P);upload(BF.nor,N);upload(BF.col,C);upload(BF.id,I);upload(BF.sel,S);faceCount=P.length/3;
  upload(BE.pos,EP);upload(BE.col,EC);BE.n=EP.length/3;
  // Missing-corner hints: purple cross plus dotted lines from both ends of the L.
  const CP=[],CC=[],pc=[0.61,0.19,0.85];
  for(const c of completions()){
    const segs=[...crossLines(c.p,dist(c.A,c.p)*0.06,pc)];
    for(const S of [c.A,c.B])for(let i=0;i<12;i+=2)segs.push([add(S,mul(sub(c.p,S),i/12)),add(S,mul(sub(c.p,S),(i+1)/12)),pc]);
    for(const [a,b,col] of segs){CP.push(...a,...b);CC.push(...col,...col);}
  }
  // Centre points: bold orange cross inside a diamond, drawn on top of everything.
  for(const g of model.guides){
    const s=gridStep()*0.5,col=selection.has(g.id)?SEL_EDGE:GUIDE_COL,segs=crossLines(g.p,s,col);
    for(const o of [0,0.04,-0.04])segs.push([add(g.p,[-s,o*s,0]),add(g.p,[s,o*s,0]),col],[add(g.p,[o*s,-s,0]),add(g.p,[o*s,s,0]),col]);
    const d=[[s*0.6,0,0],[0,s*0.6,0],[-s*0.6,0,0],[0,-s*0.6,0]].map(v=>add(g.p,v));
    for(let i=0;i<4;i++)segs.push([d[i],d[(i+1)%4],col]);
    for(const [a,b,c] of segs){CP.push(...a,...b);CC.push(...c,...c);}
  }
  upload(BC.pos,CP);upload(BC.col,CC);BC.n=CP.length/3;
}
function buildGrid(){
  const s=gridStep(),n=20,E=n*s,P=[],C=[];
  const minor=[0.63,0.64,0.62],major=[0.48,0.50,0.50];
  const ax=(D,c,cl)=>{P.push(0,0,0,...mul(D,E*4));C.push(...c,...c);
    for(let k=0;k<E*4;k+=s){P.push(...mul(D,-k),...mul(D,-(k+s*0.5)));C.push(...cl,...cl);}};
  // When the ground shader draws the grid and red/green axes, only the blue (up) axis is a line here.
  if(!gridInSky){
    for(let i=-n;i<=n;i++){if(!i)continue;const c=i%10===0?major:minor;
      P.push(i*s,-E,0,i*s,E,0,-E,i*s,0,E,i*s,0);for(let k=0;k<4;k++)C.push(...c);}
    ax(X,[0.85,0.15,0.15],[0.9,0.6,0.6]);ax(Y,[0.15,0.6,0.15],[0.6,0.82,0.6]);
  }
  ax(Z,[0.15,0.25,0.9],[0.6,0.65,0.92]);
  // Build volume: a light outline box over the bed, showing the printer's maximum height.
  const bx=bed.x/2000,by=bed.y/2000,bz=bed.z/1000,vc=[0.45,0.55,0.70];
  const cn=[[-bx,-by],[bx,-by],[bx,by],[-bx,by]];
  for(let i=0;i<4;i++){const [x0,y0]=cn[i],[x1,y1]=cn[(i+1)%4];
    P.push(x0,y0,bz,x1,y1,bz,x0,y0,0,x0,y0,bz);C.push(...vc,...vc,...vc,...vc);}
  // The side picked on the view cube: a light blue grid on it, through the middle of the bed.
  if(workPlane.name!=='ground'){
    const {u,v}=workPlane,ext=w=>Math.abs(dot(w,X))>0.5?bx:Math.abs(dot(w,Y))>0.5?by:bz,wc=[0.62,0.74,0.96],lo=w=>Math.abs(dot(w,Z))>0.5?0:-ext(w);
    const eu=ext(u),ev=ext(v),stepM=Math.max(s,0.01);
    for(let a=lo(u);a<=eu+1e-9;a+=stepM){P.push(...add(mul(u,a),mul(v,lo(v))),...add(mul(u,a),mul(v,ev)));C.push(...wc,...wc);}
    for(let b=lo(v);b<=ev+1e-9;b+=stepM){P.push(...add(mul(v,b),mul(u,lo(u))),...add(mul(v,b),mul(u,eu)));C.push(...wc,...wc);}
  }
  upload(BG.pos,P);upload(BG.col,C);BG.n=P.length/3;
}
// pull: move lines this fraction of the way toward the camera, so edges win over their own faces
// without letting edges hidden behind the model show through.
function drawLines(B,M,pull){
  if(!B.n)return;
  gl.useProgram(lineProg);gl.uniformMatrix4fv(LL.uMVP,false,M);
  gl.uniform3fv(LL.uEye,getCB().eye);gl.uniform1f(LL.uPull,pull||0);
  attrib(LL.aPos,B.pos,3);attrib(LL.aCol,B.col,3);gl.drawArrays(gl.LINES,0,B.n);
  gl.disableVertexAttribArray(LL.aPos);gl.disableVertexAttribArray(LL.aCol);
}
let pending=false,dirtyGeom=true,hoverIdx=-10;
const preview={lines:[]};
function requestDraw(){if(!pending){pending=true;requestAnimationFrame(draw);}if(window.EvenUCanRibbonRefresh)window.EvenUCanRibbonRefresh();}
let geomVer=0;
function markDirty(){dirtyGeom=true;compCache=null;sceneBoxCache=undefined;geomVer++;requestDraw();if(window.wfUpdateStrip)window.wfUpdateStrip();}
// Bounding box of everything drawn (cached until the model changes); used for the camera's near cut-off.
let sceneBoxCache;
const sceneBox=()=>sceneBoxCache===undefined?(sceneBoxCache=bounds()):sceneBoxCache;
function draw(){
  pending=false;
  const dpr=window.devicePixelRatio||1,w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;CB=null;}
  if(dirtyGeom){rebuild();dirtyGeom=false;}
  gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0.8,0.86,0.92,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawSky();
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  const M=mvp();
  gl.depthMask(false);drawLines(BG,M);gl.depthMask(true);
  if(faceCount){
    gl.useProgram(faceProg);gl.uniformMatrix4fv(FL.uMVP,false,M);gl.uniform1f(FL.uHover,hoverIdx);
    gl.uniform3fv(FL.uSun,norm([0.35,-0.55,0.8]));gl.uniform3fv(FL.uFill,norm([-0.6,0.5,0.2]));gl.uniform3fv(FL.uBack,BACK);
    attrib(FL.aPos,BF.pos,3);attrib(FL.aNor,BF.nor,3);attrib(FL.aCol,BF.col,3);attrib(FL.aId,BF.id,1);attrib(FL.aSel,BF.sel,1);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.5,4);
    gl.drawArrays(gl.TRIANGLES,0,faceCount);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    for(const a of ['aPos','aNor','aCol','aId','aSel'])if(FL[a]>=0)gl.disableVertexAttribArray(FL[a]);
  }
  drawLines(BE,M,0.002);
  if(BC.n){gl.disable(gl.DEPTH_TEST);drawLines(BC,M);gl.enable(gl.DEPTH_TEST);}
  placeGhosts();
  if(BH.n&&ghostOn){gl.disable(gl.DEPTH_TEST);drawLines(BH,M);gl.enable(gl.DEPTH_TEST);}
  if(preview.lines.length){
    const P=[],C=[];for(const [a,b,c] of preview.lines){P.push(...a,...b);C.push(...c,...c);}
    upload(BP.pos,P);upload(BP.col,C);BP.n=P.length/3;
    gl.disable(gl.DEPTH_TEST);drawLines(BP,M);gl.enable(gl.DEPTH_TEST);
  }
  placeMarker();
  placeDims();
  drawCube();
  drawProblems();
}
// Print-check overlay: thick red gaps and orange inside-out faces, drawn on top so they can't be missed.
const ov=$('ov'),ovx=ov.getContext('2d');
function drawProblems(){
  const dpr=window.devicePixelRatio||1;
  if(ov.width!==cv.width||ov.height!==cv.height){ov.width=cv.width;ov.height=cv.height;}
  ovx.clearRect(0,0,ov.width,ov.height);
  if(!check)return;
  ovx.lineCap='round';ovx.lineJoin='round';
  const seg=(a,b)=>{const s=toScreen(a),t=toScreen(b);if(!s||!t)return false;ovx.moveTo(s[0]*dpr,s[1]*dpr);ovx.lineTo(t[0]*dpr,t[1]*dpr);return true;};
  // inside-out faces: orange outline
  ovx.beginPath();
  for(const f of model.faces)if(check.wrongFaces.has(f.id))for(const L of loops(f))for(let i=0;i<L.length;i++)seg(L[i],L[(i+1)%L.length]);
  ovx.strokeStyle='#ff8c00';ovx.lineWidth=3.5*dpr;ovx.stroke();
  // gaps: red line with a white edge, plus a dot so even tiny gaps show
  ovx.beginPath();for(const [a,b] of check.openSegs)seg(a,b);
  ovx.strokeStyle='#ffffff';ovx.lineWidth=7*dpr;ovx.stroke();
  ovx.strokeStyle='#e0141e';ovx.lineWidth=4*dpr;ovx.stroke();
  ovx.fillStyle='#e0141e';
  for(const [a,b] of check.openSegs){const s=toScreen(mul(add(a,b),0.5));if(!s)continue;ovx.beginPath();ovx.arc(s[0]*dpr,s[1]*dpr,4.5*dpr,0,Math.PI*2);ovx.fill();}
}

