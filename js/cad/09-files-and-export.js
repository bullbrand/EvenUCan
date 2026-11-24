// EvenUCan 3D drawing app - 09-files-and-export.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- files
const downloadBlob=function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);};
const download=(name,text,type)=>downloadBlob(name,new Blob([text],{type}));
// Save writes a normal .3mf that slicers (Cura, PrusaSlicer, Bambu…) open directly. A copy of the
// editable drawing rides along inside it (Metadata/opensketch.json), so reopening it here loses nothing.
const SAVE_TYPES=[{description:'3MF – opens in Cura and other slicers',accept:{'model/3mf':['.3mf']}}];
const OPEN_TYPES=[{description:'3D models (3MF, STL, EvenUCan)',accept:{'model/3mf':['.3mf'],'model/stl':['.stl'],'application/json':['.osk','.json']}}];
const EMBED='Metadata/opensketch.json';
const baseName=n=>(n||'Untitled').replace(/\.(3mf|stl|osk|json)$/i,'');
const saveFile=async function saveFile(as){
  if(tool.cancel)tool.cancel();
  flushAutosave();// (Perf-r1)
  if(!sizeOK())return;
  // version 2 (r1): the electronics (Enclosure Wizard, ESPHome answers, own parts the wizard uses) ride along too
  const data=JSON.stringify({app:'EvenUCan',version:2,units,camera:cam,faces:model.faces,edges:model.edges,guides:model.guides,plates:(typeof platesSave==='function'?platesSave():null),electronics:elecState(true)});
  const m=buildMesh(true),blob=make3MF(m,data);
  const done=name=>{setDirty(false);flash('Saved '+name+(m.open?' · The model has gaps: they are marked in red, see the Print check panel.':''),m.open?8000:3500);showProblemsIfAny();};
  // The name offered in the Save box: the file's own name once it has one, otherwise the PROJECT's name. "Untitled" and the
  // wizard's placeholder "Enclosure" do not count as names (two projects would both be offered Enclosure.3mf and overwrite
  // each other). With no project name either, the date and time make it unique.
  const _sugName=(()=>{
    let pn='';try{const it=window.WFEnclosure&&window.WFEnclosure._internal&&window.WFEnclosure._internal.intentNow&&window.WFEnclosure._internal.intentNow();pn=(it&&it.analysis&&it.analysis.name)||'';}catch(e){console.warn('EvenUCan: no project name for the save box',e);}
    let n=/^(untitled|enclosure)$/i.test(docName)?pn:docName;
    n=String(n||'').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
    if(!n){const d=new Date(),p=x=>String(x).padStart(2,'0');n='EvenUCan project '+d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+p(d.getMinutes());}
    return n;
  })();
  // Browser Native File System Access API with direct overwrite in Chrome / Edge
  if(window.showSaveFilePicker || (fileHandle && fileHandle.createWritable)){
    try{
      const isOverwrite = fileHandle && !as && /\.3mf$/i.test(fileHandle.name);
      if(!isOverwrite){
        fileHandle=await window.showSaveFilePicker({suggestedName:_sugName+'.3mf',types:SAVE_TYPES});
      }
      const w=await fileHandle.createWritable();
      await w.write(blob);
      await w.close();
      docName=baseName(fileHandle.name);
      setDirty(false);
      return done(fileHandle.name + (isOverwrite ? ' (saved directly to disk)' : ''));
    }catch(err){
      if(err.name==='AbortError')return;
      console.warn('showSaveFilePicker / createWritable failed, falling back to download:', err);
    }
  }
  downloadBlob(_sugName+'.3mf',blob);
  done(_sugName+'.3mf (downloaded to your computer)');
};
const loadData=function loadData(d,name){
  if(!d||!Array.isArray(d.faces))return flash('That is not a EvenUCan file');
  if(tool.cancel)tool.cancel();
  model={faces:d.faces,edges:d.edges||[],guides:d.guides||[]};fixIds();lastShape=null;clearHistory();selection.clear();if(d.plates)platesLoad(d.plates);else platesReset();
  if(d.camera){Object.assign(cam,d.camera);syncPersp();}
  if(d.units&&UNITS[d.units]){units=d.units;$cad('units').value=units;buildGrid();}
  docName=baseName(name);
  // version 1 files (and .osk/.json drawings) are geometry only: the current electronics stay as they are.
  // Version 2 files also bring their Enclosure Wizard / ESPHome settings and the parts they use.
  if((+d.version||1)>=2&&d.electronics){
    if(restoreElec(d.electronics))flash('Opened '+baseName(name)+' with its Enclosure Wizard and ESPHome settings',4000);
    else flash('⚠ The drawing opened, but its Enclosure Wizard settings could not all be loaded (the browser\'s storage may be full).',9000);
  }
  commitChange();setDirty(false);camDirty();
  return true;
};
// Read a ZIP (3MF) – handles stored and deflated entries, so files saved by other programs open too.
const readZip=async function readZip(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf),files={};
  let e=u8.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error('not a zip');
  let o=dv.getUint32(e+16,true);const n=dv.getUint16(e+10,true);
  for(let i=0;i<n;i++){
    const method=dv.getUint16(o+10,true),csize=dv.getUint32(o+20,true),nl=dv.getUint16(o+28,true),xl=dv.getUint16(o+30,true),cl=dv.getUint16(o+32,true),lo=dv.getUint32(o+42,true);
    const name=new TextDecoder().decode(u8.subarray(o+46,o+46+nl));
    const start=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true),raw=u8.subarray(start,start+csize);
    if(method===0)files[name]=raw;
    else if(method===8)files[name]=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    o+=46+nl+xl+cl;
  }
  return files;
};
// Triangles (metres) from a 3MF package, following components and build transforms.
const trianglesFrom3MF=function trianglesFrom3MF(files){
  const txt=f=>new TextDecoder().decode(f),docs={},tris=[];
  const docFor=path=>{path=path.replace(/^\//,'');if(!docs[path]&&files[path])docs[path]=new DOMParser().parseFromString(txt(files[path]),'application/xml');return docs[path];};
  const main=Object.keys(files).find(k=>/^3D\/.*\.model$/i.test(k)&&/3dmodel\.model$/i.test(k))||Object.keys(files).find(k=>/\.model$/i.test(k));
  if(!main)return tris;
  const SC={micron:1e-6,millimeter:1e-3,centimeter:1e-2,inch:0.0254,foot:0.3048,meter:1};
  const mat=s=>{const a=(s||'').trim().split(/\s+/).map(Number);return a.length===12?a:[1,0,0,0,1,0,0,0,1,0,0,0];};
  const ap=(M,p)=>[p[0]*M[0]+p[1]*M[3]+p[2]*M[6]+M[9],p[0]*M[1]+p[1]*M[4]+p[2]*M[7]+M[10],p[0]*M[2]+p[1]*M[5]+p[2]*M[8]+M[11]];
  const comp=(A,B)=>{const r=[];for(let i=0;i<4;i++){const row=i<3?[A[i*3],A[i*3+1],A[i*3+2]]:[A[9],A[10],A[11]];for(let j=0;j<3;j++)r.push(row[0]*B[j]+row[1]*B[3+j]+row[2]*B[6+j]+(i===3?B[9+j]:0));}return r;};
  const walk=(path,id,M,depth)=>{
    const doc=docFor(path);if(!doc||depth>20)return;
    const sc=SC[doc.documentElement.getAttribute('unit')||'millimeter']||1e-3;
    const ob=[...doc.getElementsByTagName('object')].find(o=>o.getAttribute('id')===id);if(!ob)return;
    const mesh=ob.getElementsByTagName('mesh')[0];
    if(mesh){
      const V=[...mesh.getElementsByTagName('vertex')].map(v=>ap(M,['x','y','z'].map(a=>+v.getAttribute(a))).map(c=>c*sc));
      for(const t of mesh.getElementsByTagName('triangle'))tris.push(['v1','v2','v3'].map(a=>V[+t.getAttribute(a)]));
    }
    for(const c of ob.getElementsByTagName('component'))walk(c.getAttribute('p:path')||path,c.getAttribute('objectid'),comp(mat(c.getAttribute('transform')),M),depth+1);
  };
  const md=docFor(main);
  for(const it of md.getElementsByTagName('item'))walk(main,it.getAttribute('objectid'),mat(it.getAttribute('transform')),0);
  return tris;
};
const trianglesFromSTL=function trianglesFromSTL(buf){
  const dv=new DataView(buf),tris=[],s=0.001;
  if(buf.byteLength>=84&&84+50*dv.getUint32(80,true)===buf.byteLength){
    const n=dv.getUint32(80,true);
    for(let i=0;i<n;i++){const o=84+i*50+12,t=[];for(let k=0;k<3;k++)t.push([0,1,2].map(j=>dv.getFloat32(o+k*12+j*4,true)*s));tris.push(t);}
  }else{
    const v=[...new TextDecoder().decode(buf).matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map(m=>[+m[1]*s,+m[2]*s,+m[3]*s]);
    for(let i=0;i+2<v.length;i+=3)tris.push([v[i],v[i+1],v[i+2]]);
  }
  return tris;
};
// Turn a triangle mesh back into editable faces: neighbouring triangles in the same plane are merged into one face.
const facesFromTriangles=function facesFromTriangles(tris){
  tris=tris.map(t=>t.map(clean)).filter(t=>len(cross(sub(t[1],t[0]),sub(t[2],t[0])))>1e-14);
  const N=tris.map(t=>loopNormal(t)),ek=(a,b)=>key(a)+'|'+key(b),owner=new Map();
  tris.forEach((t,i)=>{for(let e=0;e<3;e++)owner.set(ek(t[e],t[(e+1)%3]),i);});
  const grp=new Array(tris.length).fill(-1),groups=[];
  // Seed each flat face from its biggest triangle (whose direction is exact) and take in neighbours whose
  // corners all lie on that plane. Thin sliver triangles have unreliable directions of their own.
  const tArea=tris.map(t=>len(cross(sub(t[1],t[0]),sub(t[2],t[0]))));
  const seeds=tris.map((_,i)=>i).sort((a,b)=>tArea[b]-tArea[a]);
  let ext=0;for(const t of tris)for(const p of t)ext=Math.max(ext,Math.abs(p[0]),Math.abs(p[1]),Math.abs(p[2]));
  const planeTol=Math.max(5e-8,ext*2e-7);// a little above float rounding in files
  for(const i of seeds){
    if(grp[i]>=0)continue;
    const g=groups.length,members=[i],st=[i];grp[i]=g;
    const onPlane=k=>tris[k].every(p=>Math.abs(dot(sub(p,tris[i][0]),N[i]))<planeTol);
    while(st.length){
      const j=st.pop(),t=tris[j];
      for(let e=0;e<3;e++){
        const k=owner.get(ek(t[(e+1)%3],t[e]));
        if(k===undefined||grp[k]>=0||dot(N[i],N[k])<0||!onPlane(k))continue;
        grp[k]=g;members.push(k);st.push(k);
      }
    }
    groups.push(members);
  }
  const faces=[];
  for(const members of groups){
    const asTris=()=>members.forEach(j=>faces.push({id:nid(),pts:tris[j],holes:[],color:null}));
    if(members.length===1){asTris();continue;}
    const dir=new Map(),pos=new Map();
    for(const j of members){const t=tris[j];for(let e=0;e<3;e++){const a=t[e],b=t[(e+1)%3];pos.set(key(a),a);pos.set(key(b),b);dir.set(key(a)+'>'+key(b),[key(a),key(b)]);}}
    const next=new Map();let bad=false;
    for(const [k,[a,b]] of dir){if(dir.has(b+'>'+a))continue;if(next.has(a))bad=true;next.set(a,b);}
    if(bad){asTris();continue;}
    const loopsK=[],used=new Set();
    for(const s of next.keys()){
      if(used.has(s))continue;const L=[];let c=s,guard=0;
      while(!used.has(c)&&guard++<1e6){used.add(c);L.push(pos.get(c));c=next.get(c);if(c===undefined){bad=true;break;}}
      if(c!==s)bad=true;loopsK.push(L);
    }
    if(bad||!loopsK.length){asTris();continue;}
    const simp=L=>L.filter((p,i)=>len(cross(sub(p,L[(i+L.length-1)%L.length]),sub(L[(i+1)%L.length],p)))>1e-12);
    const n=N[members[0]],[u,v]=basis(n),area=L=>{let s=0;for(let i=0;i<L.length;i++){const a=to2(L[i],L[0],u,v),b=to2(L[(i+1)%L.length],L[0],u,v);s+=a[0]*b[1]-b[0]*a[1];}return s/2;};
    const Ls=loopsK.map(simp).filter(L=>L.length>=3).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
    if(!Ls.length){asTris();continue;}
    const F={id:nid(),pts:Ls[0],holes:Ls.slice(1),color:null};
    if(!cleanTriangulation(F)){asTris();continue;}
    faces.push(F);
  }
  return faces;
};
// True when a face triangulates properly: the right number of triangles, all facing the face's way,
// none overlapping (no edge used twice in the same direction). Otherwise keep the original triangles.
const cleanTriangulation=function cleanTriangulation(f){
  let T;try{T=triangulate(f);}catch(e){return false;}
  if(T.tris.length/3!==T.V.length+2*f.holes.length-2)return false;
  const n=faceNormal(f),seen=new Set();
  for(let i=0;i<T.tris.length;i+=3){
    const a=T.tris[i],b=T.tris[i+1],c=T.tris[i+2];
    if(dot(cross(sub(T.V[b],T.V[a]),sub(T.V[c],T.V[a])),n)<=0)return false;
    for(const k of [a+'>'+b,b+'>'+c,c+'>'+a]){if(seen.has(k))return false;seen.add(k);}
  }
  return true;
};
const loadMesh=function loadMesh(tris,name){
  if(!tris.length)return flash('No 3D model found in that file');
  if(tool.cancel)tool.cancel();
  model={faces:[],edges:[],guides:[]};lastShape=null;
  model.faces=facesFromTriangles(tris);fixIds();
  clearHistory();selection.clear();docName=baseName(name);
  commitChange();setDirty(false);zoomExtents();
  flash('Opened '+name+' · '+model.faces.length+' faces',3500);
};
const openBuffer=async function openBuffer(buf,name){
  try{
    if(/\.3mf$/i.test(name)){
      const files=await readZip(buf);
      if(files[EMBED]){loadData(JSON.parse(new TextDecoder().decode(files[EMBED])),name);return true;}
      loadMesh(trianglesFrom3MF(files),name);return false;
    }
    if(/\.stl$/i.test(name)){loadMesh(trianglesFromSTL(buf),name);return false;}
    loadData(JSON.parse(new TextDecoder().decode(buf)),name);return false;
  }catch(err){console.error('EvenUCan: could not open '+name,err);flash('Could not open '+name+(err&&err.message?' ('+err.message+')':''),6000);return false;}
};
const openFile=async function openFile(){
  if(docDirty&&!confirm('Discard unsaved changes to "'+docName+'"?'))return;
  if(window.showOpenFilePicker){
    try{
      const [h]=await window.showOpenFilePicker({types:OPEN_TYPES});const f=await h.getFile();
      // Only keep writing back to files we made; anything else gets "Save As" so it isn't overwritten.
      fileHandle=(await openBuffer(await f.arrayBuffer(),h.name))?h:null;return;
    }catch(err){if(err.name==='AbortError')return;console.warn('EvenUCan: file picker failed, using the plain file chooser',err);}
  }
  $cad('fileInput').click();
};
$cad('fileInput').addEventListener('change',async e=>{const f=e.target.files[0];if(f){await openBuffer(await f.arrayBuffer(),f.name);fileHandle=null;}e.target.value='';});
const newFile=function newFile(){
  if(docDirty&&!confirm('Discard unsaved changes to "'+docName+'"?'))return;
  if(tool.cancel)tool.cancel();
  model={faces:[],edges:[],guides:[]};lastShape=null;clearHistory();selection.clear();fileHandle=null;docName='Untitled';setGhosts([]);platesReset();
  // Clear all electronics/wizard state so reopening gives a clean workspace
  Object.values(ELEC_KEYS).forEach(k=>{try{localStorage.removeItem('opensketch.'+k);}catch(e){}});
  try{Object.keys(localStorage).filter(k=>/^opensketch\.intent_inputs\./.test(k)).forEach(k=>localStorage.removeItem(k));}catch(e){}
  commitChange();setDirty(false);setView('iso');homeCam();camDirty();setWorkPlane('ground');cubeIntro(true);
  if(window.WFEnclosure&&window.WFEnclosure.openWelcome)window.WFEnclosure.openWelcome(true);// (r4) unless the user turned it off
};
// (startup-r1) Start a brand-new project: same cleanup as newFile but always opens the Welcome wizard,
// even if the user previously ticked "Don't show this again".
// Exposed on window so the WFEnclosure IIFE's startup dialog can call it.
window.newProject=function newProject(){
  if(docDirty&&!confirm('Discard unsaved changes to "'+docName+'"?'))return;
  if(tool.cancel)tool.cancel();
  model={faces:[],edges:[],guides:[]};lastShape=null;clearHistory();selection.clear();fileHandle=null;docName='Untitled';setGhosts([]);platesReset();
  Object.values(ELEC_KEYS).forEach(k=>{try{localStorage.removeItem('opensketch.'+k);}catch(e){}});
  try{Object.keys(localStorage).filter(k=>/^opensketch\.intent_inputs\./.test(k)).forEach(k=>localStorage.removeItem(k));}catch(e){}
  commitChange();setDirty(false);setView('iso');homeCam();camDirty();setWorkPlane('ground');cubeIntro(true);
  // Force the Welcome wizard open regardless of the "don't show" preference
  if(window.WFEnclosure&&window.WFEnclosure.openWelcome)window.WFEnclosure.openWelcome(false);
}
const exportOBJ=async function exportOBJ(){
  flushAutosave();// (Perf-r1)
  let s='# EvenUCan OBJ export - units: metres, Y up\n',vi=1;
  model.faces.forEach((f,k)=>{
    const t=triangulate(f);s+='g face'+k+'\n';
    for(const p of t.V)s+=`v ${p[0]} ${p[2]} ${-p[1]}\n`;
    for(let i=0;i<t.tris.length;i+=3)s+=`f ${vi+t.tris[i]} ${vi+t.tris[i+1]} ${vi+t.tris[i+2]}\n`;
    vi+=t.V.length;
  });
  const blob=new Blob([s],{type:'text/plain'});
  const fname=docName+'.obj';
  if(window.showSaveFilePicker){
    try{
      const h=await window.showSaveFilePicker({suggestedName:fname,types:[{description:'Wavefront OBJ (*.obj)',accept:{'text/plain':['.obj']}}]});
      const w=await h.createWritable();await w.write(blob);await w.close();
      flash('Exported '+h.name);return;
    }catch(e){if(e.name==='AbortError')return;console.warn(e);}
  }
  download(fname,s,'text/plain');
};
// ---- 3D-print export: one welded triangle mesh, in millimetres
const exportFaces=()=>{const sel=model.faces.filter(f=>selection.has(f.id));return sel.length?sel:model.faces;};
const buildMesh=function buildMesh(all,only){// only: mesh just these faces
  const faces=only||(all?model.faces:exportFaces()),verts=[],index=new Map(),tris=[];
  // each group is its own solid: its corners are not joined to a touching group's (e.g. two halves after a Slice)
  const vid=(p,g)=>{const k=key(p)+'#'+(g||'');let i=index.get(k);if(i===undefined){i=verts.length;verts.push(p);index.set(k,i);}return i;};
  for(const f of faces){
    const t=triangulate(f);
    for(let i=0;i<t.tris.length;i+=3){
      const a=vid(t.V[t.tris[i]],f.g),b=vid(t.V[t.tris[i+1]],f.g),c=vid(t.V[t.tris[i+2]],f.g);
      if(a!==b&&b!==c&&a!==c){const tr=[a,b,c];tr.f=f.id;tris.push(tr);}// .f: which face it came from
    }
  }
  // Split triangles at T-junctions (a vertex lying inside another triangle's edge) so the mesh is watertight.
  // (Skipped for very large imported meshes, which come in already welded.)
  const out=[],queue=tris.slice();let guard=tris.length>80000?Infinity:0;
  if(guard)for(const t of queue.splice(0))out.push(t);
  // Vertices sorted along each axis: an edge only tests the vertices inside its own bounding box,
  // looked up along the axis where that box is thinnest.
  const byAx=guard?null:[0,1,2].map(a=>verts.map((_,i)=>i).sort((i,j)=>verts[i][a]-verts[j][a]));
  const nearEdge=(A,B)=>{
    let ax=0,best=Infinity;for(let k=0;k<3;k++){const e=Math.abs(B[k]-A[k]);if(e<best){best=e;ax=k;}}
    const arr=byAx[ax],lo=Math.min(A[ax],B[ax])-1e-6,hi=Math.max(A[ax],B[ax])+1e-6;
    let l=0,h=arr.length;while(l<h){const m=(l+h)>>1;if(verts[arr[m]][ax]<lo)l=m+1;else h=m;}
    const res=[];for(let k=l;k<arr.length&&verts[arr[k]][ax]<=hi;k++)res.push(arr[k]);return res;
  };
  // Only another face's vertex makes a T-junction: a face's own triangles already meet properly,
  // even where one of its corners lies almost in line with a long diagonal.
  const vFaces=new Map();
  for(const t of tris)for(const i of t){let s=vFaces.get(i);if(!s)vFaces.set(i,s=new Set());s.add(t.f);}
  // Edges already shared by exactly two triangles are closed: only open edges can hide a T-junction.
  const ek=(a,b)=>a<b?a+'_'+b:b+'_'+a,ec0=new Map();
  for(const t of tris)for(let e=0;e<3;e++){const k=ek(t[e],t[(e+1)%3]);ec0.set(k,(ec0.get(k)||0)+1);}
  while(queue.length&&guard++<500000){
    const tr=queue.pop();let split=false;
    for(let e=0;e<3&&!split;e++){
      const a=tr[e],b=tr[(e+1)%3],c=tr[(e+2)%3],A=verts[a],D=sub(verts[b],A),L2=dot(D,D);
      if(ec0.get(ek(a,b))===2)continue;
      for(const v of nearEdge(A,verts[b])){
        if(v===a||v===b||v===c||vFaces.get(v).has(tr.f))continue;
        const s=dot(sub(verts[v],A),D)/L2;if(s<=1e-6||s>=1-1e-6)continue;
        if(dist(add(A,mul(D,s)),verts[v])>1e-6)continue;
        const t1=[a,v,c],t2=[v,b,c];t1.f=t2.f=tr.f;queue.push(t1,t2);split=true;break;
      }
    }
    if(!split)out.push(tr);
  }
  const final=out.filter(t=>len(cross(sub(verts[t[1]],verts[t[0]]),sub(verts[t[2]],verts[t[0]])))>1e-14);
  // An edge is a gap when it isn't used as often in one direction as the other. A closed shell uses each
  // edge once each way; two closed solids touching along an edge (a cone standing on a cylinder of the same
  // size) use it twice each way, which is still watertight.
  const ec=new Map();
  for(const t of final)for(let e=0;e<3;e++){const a=t[e],b=t[(e+1)%3],k=a<b?a+'_'+b:b+'_'+a;ec.set(k,(ec.get(k)||0)+(a<b?1:-1));}
  let open=0;const openSegs=[];
  for(const [k,n] of ec)if(n!==0){open++;const [a,b]=k.split('_').map(Number);openSegs.push([verts[a],verts[b]]);}
  return {verts,tris:final,open,openSegs,partial:faces!==model.faces};
};
