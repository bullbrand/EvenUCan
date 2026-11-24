// EvenUCan 3D drawing app - 01-core-math-model.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

const $cad=id=>document.getElementById(id);
const escCad=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));// text -> safe HTML (the Ctrl+K palette and the update banner use it)
// Perf-r1: debounce autosave/check/stats, triangulation cache
// ================================================================ maintenance changelog
// 1.9.25-r1 (2 Nov 2026) – reliability pass on top of 1.9.25. Surgical changes only:
//  1. Complete project save: saved .3mf files are now version 2. Besides the drawing, Metadata/opensketch.json
//     carries "electronics": the Enclosure Wizard settings, the ESPHome answers and the user's own parts the
//     wizard uses (see elecState / restoreElec). Version 1 files still open exactly as before (drawing only).
//     The autosave also keeps the wizard + ESPHome answers, and puts them back on startup if they went missing.
//  2. Autosave failure warning: if the browser's storage is full the autosave no longer fails silently; a red
//     bar says so (once, until autosave works again). A startup check warns if storage is nearly full.
//  3. Parts library: the web parts library is still only read when "Browse parts…" is first used, now with a
//     "Loading parts…" indicator; its search list is built once and reused; when the page is served over
//     http(s) the JSON files next to it are fetched instead of asking for them (file:// keeps the file picker).
//  4. Errors that matter (autosave restore, broken saved parts/wizard settings, geometry operations, opening
//     files, reading the parts library) are now logged to the console and, where the user is affected, shown.
//     Catches that deliberately ignore harmless failures are marked "// intentional".
// 1.9.25-r2 (2 Nov 2026) – Project Intent Wizard ("💡 What do I want to build?" in the Enclosure Wizard):
//  1. The user describes the gadget in plain words; their AI (the AI menu's provider) returns the kinds of parts
//     needed as JSON. Each is found among the built-in parts, the user's own parts, a few common modules
//     (SSD1306 OLED, BME280, PIR, buttons, LEDs…) and then the parts library; the Enclosure Wizard is filled in,
//     the wiring worked out and the ESPHome file written (intentWizard section in the Enclosure script).
//  2. Anything the code needs (an OpenWeatherMap key, a town, an ntfy.sh topic) is asked for and kept in
//     'intent_inputs.<key>'. A weather project gets a ready-made ESPHome weather block: OpenWeatherMap fetch,
//     the forecast on an SSD1306 OLED and a daily message to the phone by ntfy.sh (weatherYaml), without the AI.
//     The idea and answers also go to "Make it with AI" (esphWithAI) so it writes the rest of the behaviour.
//  3. Version 2 project files (and the autosave) carry the idea and the answers as electronics.intent.
//  4. Fix: with two or more I2C parts only the first reached the ESPHome file (planWiring listed only it).
//  5. Fix: the ESPHome LED strip option is rgb_order (channel_colors made ESPHome reject the file).
// 1.9.25-r3 (2 Nov 2026) – the Project Intent Wizard works for any project, on three platforms:
//  1. INTENT_PROMPT is general (any gadget) and the AI also suggests a platform: ESP32 + ESPHome, Arduino (Nano)
//     or Raspberry Pi (4), with platform_reason, code_description, code_libraries and a why for each part.
//  2. Platform buttons under the answer (the AI's pick preselected). Another choice swaps the board (PLATFORMS,
//     CTRL_PARTS: Nano / Pi 4 with pin data) and drops Wi-Fi parts and internet questions on the Arduino, with a
//     note, without asking the AI again (pfMatches). planWiring uses a board's own I2C pins (part.i2c).
//  3. A part not found gets "⚠ Not found in library" and "🔍 Look this up" (lookupPart): after a blocking
//     permission dialog the AI gives the typical size, pins, holes and sockets from its own knowledge (not the
//     internet); the result is shown first and, if accepted, added to the user's parts as approximate (AI lookup).
//  4. Arduino sketches (generateArduinoCode) and Raspberry Pi Python programs (generatePiCode), written by the
//     user's AI (callAI) from the idea, the parts and the wiring's pins, only when asked; Copy and Download. The
//     Wiring window's tab is "ESPHome YAML" for an ESP32 and "Code" otherwise.
//  5. Example ideas under the description box (Weather station, RV level checker, Plant watering reminder,
//     Motion alarm, Pet feeder timer).
//  6. Version 2 files carry intent_platform, intent_platform_override and intent_missing_parts_added; opening a
//     file (or the autosave) puts the looked-up parts back into the user's own parts.
// 1.9.25-r4 (2 Nov 2026) – Welcome window (openWelcome, in the intent wizard's window):
//  1. Shown on a fresh, empty start and after New: "💡 I have an idea for a gadget" or "✏️ I want to draw something
//     myself". "Don't show this when I open a new file" is kept as welcome_seen. "💡 Start a project" in the
//     menu bar always opens it; the Enclosure Wizard's "What do I want to build?" stays as a second way in.
//  2. The idea in three steps: the words (with example chips that also tick Step 2), what it should do, and the
//     board the user has (or "not sure"). Steps 2 and 3 are optional; together they make the description sent
//     to the wizard's own AI call (intentAnalyse), and a board the user has is preselected over the AI's pick.
//     Then the wizard's thinking and results steps, and "Looks good" opens the Enclosure Wizard.
//  3. Keyboard: Tab stays inside the window, Enter on a button, Ctrl+Enter for Next in the idea box, Esc closes.
// 1.9.90 (9 Nov 2026):
//  1. "What problem would you like to solve?" screen now shows on fresh start (openWelcome opens the
//     ask step, not the welcome step, so the conversational screen is always the first thing seen).
//  2. Battery sleep is now MANDATORY in every battery build: the AI prompt requires deep_sleep in
//     every ESPHome config and always chooses low-power components.
//  3. "Make it with AI" button in the ESPHome section moved above the "What should it do?" label
//     and textarea, so it is easier to find.
//  4. 💾 Projects button added to the main menubar so projects are always one click away.
// 1.9.37 (4 Nov 2026):
//  1. (Desktop bridge for NVIDIA and page/image fetching: removed from the web-only build.)
//  2. Welcome: "About the AI helper" (what it does, free keys, what is sent, set up / test a key), "Carry on
//     without AI" (example projects or ticked parts -> the same box/wiring/code flow), the "needs a key" dead ends
//     replaced by a choice, and a no-AI starter sketch/program on the Code tab with the pins filled in.
//  3. Wiring picture: controller in the middle, labels only on used pins outside the boards (leader lines, no
//     overlaps), wires coloured by job with a key, focus on a wire/part/list row with a big label, one wire at a
//     time, wheel/pinch zoom, drag to pan, Fit; Save picture draws the whole view.

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
const cloneCad=o=>JSON.parse(JSON.stringify(o));

const loopNormal=function loopNormal(pts){
  const n=[0,0,0];
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];
    n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
  return norm(n);
};
const faceNormal=f=>loopNormal(f.pts);
const loops=f=>[f.pts,...f.holes];
const basis=function basis(n){
  const u=Math.abs(n[2])>0.9?norm(sub(X,mul(n,n[0]))):norm(cross(Z,n));
  return [u,cross(n,u)];
};
const to2=(p,o,u,v)=>{const d=sub(p,o);return [dot(d,u),dot(d,v)];};
const pip=function pip(P,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>P[1])!==(b[1]>P[1])&&P[0]<(b[0]-a[0])*(P[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
};
const dSeg2=function dSeg2(P,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;
  let t=L?((P[0]-a[0])*dx+(P[1]-a[1])*dy)/L:0;t=clamp(t,0,1);
  return Math.hypot(P[0]-a[0]-t*dx,P[1]-a[1]-t*dy);
};
const nearBoundary=(P,poly)=>poly.some((a,i)=>dSeg2(P,a,poly[(i+1)%poly.length])<1e-5);
const insideFace=function insideFace(F,p,strict){
  const n=faceNormal(F),[u,v]=basis(n),o=F.pts[0],P=to2(p,o,u,v);
  const outer=F.pts.map(q=>to2(q,o,u,v));
  if(strict&&nearBoundary(P,outer))return false;
  if(!pip(P,outer))return false;
  for(const h of F.holes){const H=h.map(q=>to2(q,o,u,v));if(strict&&nearBoundary(P,H))return false;if(pip(P,H))return false;}
  return true;
};
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const segX=function segX(a,b,c,d){
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b),e=1e-12;
  return ((o1>e&&o2<-e)||(o1<-e&&o2>e))&&((o3>e&&o4<-e)||(o3<-e&&o4>e));
};
const rayLineClosest=function rayLineClosest(ro,rd,p0,D){
  const w=sub(p0,ro),a=dot(D,D),b=dot(D,rd),c=dot(rd,rd),d=dot(D,w),e=dot(rd,w),den=a*c-b*b;
  if(Math.abs(den)<1e-12)return 0;
  return (b*e-c*d)/den;
};
const rayPlane=function rayPlane(ray,p,n){
  const den=dot(ray.d,n);if(Math.abs(den)<1e-9)return null;
  const t=dot(sub(p,ray.o),n)/den;if(t<0)return null;
  return add(ray.o,mul(ray.d,t));
};
const projPlane=(p,pl)=>sub(p,mul(pl.n,dot(sub(p,pl.p),pl.n)));
const rotateAbout=function rotateAbout(p,c,A,ang){
  const v=sub(p,c),cs=Math.cos(ang),sn=Math.sin(ang);
  return add(c,add(add(mul(v,cs),mul(cross(A,v),sn)),mul(A,dot(A,v)*(1-cs))));
};

// ---------------------------------------------------------------- triangulation (ear clipping with holes)
// (Perf-r1) rebuild() keeps each face's triangulation in f._tc. The property is non-enumerable, so it never goes
// into JSON (undo steps, autosave, saved files) or into copies; the code that changes a face's outline in place
// deletes it. As a safety net the cache also keeps a cheap fingerprint of the corners (order-sensitive, one per
// axis) and is only used while that still matches, so a change that forgets to clear it can't show a stale face.
const faceSig=function faceSig(f){let x=0,y=0,z=0,k=0;for(const L of [f.pts,...f.holes]){k+=0.5;for(const p of L){k++;const w=Math.sin(k*12.9898)*43758.5453;x+=p[0]*w;y+=p[1]*(w+1.37);z+=p[2]*(w-2.71);}}return [x,y,z,k];};
const tcGet=function tcGet(f){const c=f._tc;if(!c)return null;const g=faceSig(f);return g[0]===c.s[0]&&g[1]===c.s[1]&&g[2]===c.s[2]&&g[3]===c.s[3]?c.t:null;};
const tcSet=function tcSet(f,t){Object.defineProperty(f,'_tc',{value:{t,s:faceSig(f)},writable:true,configurable:true,enumerable:false});};
const triangulate=function triangulate(f){
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
};

// ---------------------------------------------------------------- model
let model={faces:[],edges:[],guides:[]};
let nextId=1;const nid=()=>nextId++;
let selection=new Set();
let undoStack=[],redoStack=[];
let docName='Untitled',docDirty=false,fileHandle=null;
// Storage keys (and the Metadata/opensketch.json name inside saved .3mf files) keep the app's original
// name so settings, autosave and files saved before the rename still load.
const _memStore=new Map();
const store={
  get(k){try{const v=localStorage.getItem('opensketch.'+k);return v!==null?v:(_memStore.has(k)?_memStore.get(k):null);}catch(e){return _memStore.has(k)?_memStore.get(k):null;}},
  set(k,v){try{localStorage.setItem('opensketch.'+k,v);}catch(e){_memStore.set(k,String(v));console.warn('EvenUCan: storage quota reached/blocked, using memory fallback for "'+k+'"',e);}},
  trySet(k,v){try{localStorage.setItem('opensketch.'+k,v);return true;}catch(e){_memStore.set(k,String(v));return true;}}
};
// ---- Electronics side of a project (r1): the Enclosure Wizard, ESPHome answers and the user's own parts live in
// their own storage keys (written by the Enclosure script below). These gather them for saving and put them back.
const ELEC_KEYS={wizard:'enclosure.wizard',esphome:'esphome.form',parts:'parts',intent:'intent'};
// A phone topic saved in this browser by an older build (not an EvenUCan topic) is forgotten, so a fresh one is made.
try{const tk='opensketch.intent_inputs.ntfy_topic',tv=localStorage.getItem(tk);if(tv!=null&&!/^evenucan-/.test(tv))localStorage.removeItem(tk);}catch(e){}
const parseKey=k=>{const raw=store.get(k);if(raw==null)return null;try{return JSON.parse(raw);}catch(e){console.error('EvenUCan: stored "'+k+'" is not readable',e);return null;}};
// (r2) The "What do I want to build?" idea: {desc, analysis, inputKeys} in 'intent'; each answer the user gave
// (an OpenWeatherMap key, a town, an ntfy topic…) in its own key, 'intent_inputs.<key>'. Saved together as one object.
const intentState=function intentState(){
  const it=parseKey(ELEC_KEYS.intent);if(!it||typeof it!=='object')return null;
  const keys=Array.isArray(it.inputKeys)?it.inputKeys:[],inputs={};
  for(const k of keys){const v=store.get('intent_inputs.'+k);if(v!=null)inputs[k]=v;}
  return {desc:String(it.desc||''),analysis:it.analysis||null,inputKeys:keys,inputs,platform:it.platform||null,platformOverride:!!it.platformOverride,missingAdded:Array.isArray(it.missingAdded)?it.missingAdded:[]};
};
const restoreIntent=function restoreIntent(t){
  if(!t||typeof t!=='object')return true;
  let ok=store.trySet(ELEC_KEYS.intent,JSON.stringify({desc:String(t.desc||''),analysis:t.analysis||null,inputKeys:Array.isArray(t.inputKeys)?t.inputKeys:[],
    platform:t.platform||null,platformOverride:!!t.platformOverride,missingAdded:Array.isArray(t.missingAdded)?t.missingAdded:[]}));
  if(t.inputs&&typeof t.inputs==='object')for(const k in t.inputs)if(/^[a-z0-9_]{1,40}$/i.test(k)&&!(k==='ntfy_topic'&&!/^evenucan-/.test(String(t.inputs[k]))))ok=store.trySet('intent_inputs.'+k,String(t.inputs[k]))&&ok;
  return ok;
};
// withParts: also the user's own parts that the wizard uses (for files; the autosave doesn't need them, they stay in 'parts')
const elecState=function elecState(withParts){
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
};
// Puts a saved project's electronics back. Parts are merged into the user's own parts (the file's copy of a part
// replaces one with the same id, since the box was designed around it); the rest of the user's parts are kept.
const restoreElec=function restoreElec(e){
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
};
