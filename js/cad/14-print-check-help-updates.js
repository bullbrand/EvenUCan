// EvenUCan 3D drawing app - 14-print-check-help-updates.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- Print check: finds gaps (open edges) and inside-out faces, and shows them on the model.
// Inside-out faces: walk across shared edges making every neighbour agree in direction, then use each
// piece's enclosed volume to tell which way is "outside".
const analyseModel=function analyseModel(){
  const m=buildMesh(true),T=m.tris,n=T.length;
  const byEdge=new Map();
  T.forEach((t,i)=>{for(let e=0;e<3;e++){const a=t[e],b=t[(e+1)%3],k=a<b?a+'_'+b:b+'_'+a;if(!byEdge.has(k))byEdge.set(k,[]);byEdge.get(k).push(i);}});
  const has=(t,a,b)=>(t[0]===a&&t[1]===b)||(t[1]===a&&t[2]===b)||(t[2]===a&&t[0]===b);
  const flip=new Int8Array(n).fill(-1),wrongFaces=new Set(),comps=[],compOf=new Int32Array(n);
  // Is point p inside the closed surface made by the triangles not in component c? (counting crossings of a ray)
  const inOthers=(p,c)=>{
    const d=[0.5773,0.5774,0.5776];let k=0;
    for(let i=0;i<n;i++){if(compOf[i]===c)continue;const [A,B,C]=T[i].map(v=>m.verts[v]);
      const e1=sub(B,A),e2=sub(C,A),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-18)continue;
      const f=1/det,s=sub(p,A),u=f*dot(s,h);if(u<0||u>1)continue;const q=cross(s,e1),v=f*dot(d,q);if(v<0||u+v>1)continue;
      if(f*dot(e2,q)>1e-12)k++;}
    return k%2===1;
  };
  for(let s=0;s<n;s++){
    if(flip[s]>=0)continue;
    flip[s]=0;const comp=[s],q=[s];
    while(q.length){
      const i=q.pop(),t=T[i];
      for(let e=0;e<3;e++){
        const a=t[e],b=t[(e+1)%3],list=byEdge.get(a<b?a+'_'+b:b+'_'+a);
        if(list.length!==2)continue;// only clean two-sided edges decide direction
        const j=list[0]===i?list[1]:list[0];if(flip[j]>=0)continue;
        // effective direction of i along this edge is a→b unless i is flipped; j must run the other way
        const iAB=!flip[i];flip[j]=has(T[j],a,b)===iAB?1:0;comp.push(j);q.push(j);
      }
    }
    let vol=0;
    for(const i of comp){const [A,B,C]=T[i].map(v=>m.verts[v]);vol+=(flip[i]?-1:1)*dot(A,cross(B,C))/6;}
    for(const i of comp)compOf[i]=comps.length;comps.push({comp,vol});
  }
  // A piece facing inwards is inside-out, unless it is a hollow sealed inside another piece (e.g. Shell with no
  // opening): its walls rightly face into the hollow.
  comps.forEach(({comp,vol},c)=>{
    if(vol<0){const vs=[...new Set(comp.flatMap(i=>T[i]))].slice(0,5).map(v=>m.verts[v]);if(!(comps.length>1&&vs.every(p=>inOthers(p,c))))for(const i of comp)flip[i]=1-flip[i];}
    for(const i of comp)if(flip[i])wrongFaces.add(T[i].f);
  });
  const fi=fitInfo(),floating=floatingPieces();
  return {m,openSegs:m.openSegs,wrongFaces,loose:model.edges.length,fits:fi.fits,each:fi.each,floating,size:bounds(),pieces:pieceList().length};
};
window.analyseModel = analyseModel;
// The separate pieces of the model: each group, and each set of connected loose faces.
const pieceList=function pieceList(){
  const out=[],seen=new Set();
  for(const f of model.faces){if(seen.has(f.id))continue;const ids=componentOf(f.id);for(const id of ids)seen.add(id);out.push(ids);}
  return out;
};
// Pieces that would print in mid-air: not resting on the bed (the model's lowest level) and not standing on
// another piece that is. A printer can't start a part on nothing.
const floatingPieces=function floatingPieces(){
  const T=5e-5;// 0.05 mm
  const P=pieceList().map(ids=>({ids,b:bounds(ids)})).filter(p=>p.b);
  if(P.length<2)return [];
  const floor=Math.min(...P.map(p=>p.b.mn[2])),ok=new Set();
  for(const p of P)if(p.b.mn[2]<=floor+T)ok.add(p);
  for(let changed=true;changed;){
    changed=false;
    for(const p of P){
      if(ok.has(p))continue;
      for(const q of ok){
        const xy=p.b.mn[0]<=q.b.mx[0]+T&&q.b.mn[0]<=p.b.mx[0]+T&&p.b.mn[1]<=q.b.mx[1]+T&&q.b.mn[1]<=p.b.mx[1]+T;
        if(xy&&q.b.mn[2]<=p.b.mn[2]+T&&p.b.mn[2]<=q.b.mx[2]+T){ok.add(p);changed=true;break;}
      }
    }
  }
  return P.filter(p=>!ok.has(p)).map(p=>{
    // how far it is above whatever is below it (or the bed)
    let below=floor;for(const q of P)if(q!==p&&q.b.mx[2]<=p.b.mn[2]+T&&p.b.mn[0]<=q.b.mx[0]&&q.b.mn[0]<=p.b.mx[0]&&p.b.mn[1]<=q.b.mx[1]&&q.b.mn[1]<=p.b.mx[1])below=Math.max(below,q.b.mx[2]);
    return {ids:p.ids,gap:p.b.mn[2]-below};
  });
};
// Drop the floating pieces straight down until they rest on what's below them (or the bed).
const dropFloating=function dropFloating(){
  const fl=check&&check.floating;if(!fl||!fl.length)return;
  pushUndo(null,'Move down to rest');
  for(const p of floatingPieces()){const dz=-p.gap;xformIds(p.ids,q=>[q[0],q[1],q[2]+dz]);}
  commitChange();flash('Floating pieces moved down onto what is below them');
};
let check=null;// latest analysis while the Check panel is open
const runCheck=function runCheck(){check=analyseModel();renderCheck();requestDraw();};
const openCheck=function openCheck(){$cad('checkPanel').style.display='block';runCheck();};
const closeCheck=function closeCheck(){clearTimeout(_checkTimer);_checkTimer=null;check=null;$cad('checkPanel').style.display='none';requestDraw();};
const renderCheck=function renderCheck(){
  const c=check,p=$cad('checkPanel'),gaps=c.openSegs.length,wrong=c.wrongFaces.size,loose=c.loose,s=n=>n===1?'':'s';
  const fx=v=>String(+v.toFixed(1));// mm, at most one decimal
  const fl=c.floating.length,ok=!gaps&&!wrong&&c.fits&&!fl&&model.faces.length>0;
  const sz=c.size?c.size.size.map(v=>fx(v*1000)).join(' × ')+' mm':'';
  p.innerHTML=`<h3>Print check</h3>
<div class="item"><span class="ic ${gaps?'bad':'ok'}">${gaps?'✗':'✓'}</span><div>${gaps?`<b>${gaps} gap edge${s(gaps)}</b>: the model isn't watertight. The gaps are marked on the model with <span class="bad">thick red lines</span>.<br><button data-a="fill">Fill holes</button> <button data-a="zoom">Zoom to problems</button>`:'Watertight: no gaps'}</div></div>
<div class="item"><span class="ic ${wrong?'warn':'ok'}">${wrong?'!':'✓'}</span><div>${wrong?`<b>${wrong} face${s(wrong)} inside-out</b> (facing inward), marked with <span class="warn">orange outlines</span>.<br><button data-a="flip">Fix directions</button>${gaps?'':' <button data-a="zoom">Zoom to problems</button>'}`:'All faces point outward'}</div></div>
<div class="item"><span class="ic ${loose?'warn':'ok'}">${loose?'!':'✓'}</span><div>${loose?`<b>${loose} loose line${s(loose)}</b>: lines that aren't part of a face won't print.<br><button data-a="loose">Delete loose lines</button>`:'No loose lines'}</div></div>
<div class="item"><span class="ic ${fl?'bad':'ok'}">${fl?'✗':'✓'}</span><div>${fl?`<b>${fl} piece${s(fl)} floating in the air</b> (${c.floating.map(p=>fx(p.gap*1000)+' mm').join(', ')} above what's below). A printer can't start a part on nothing: move ${fl===1?'it':'them'} down onto the piece below or the bed (or Group the parts once they touch).<br><button data-a="drop">Move down to rest</button> <button data-a="showfl">Show ${fl===1?'it':'them'}</button>`:'Nothing floating in the air'}</div></div>
<div class="item"><span class="ic ${c.fits?'ok':'bad'}">${c.fits?'✓':'✗'}</span><div>${c.fits?(c.each?'Together the model is '+sz+', which is bigger than your printer ('+bedText()+'), but each of the '+c.pieces+' pieces fits on its own: print them one at a time':'Fits your printer ('+bedText()+')'):'<b>Too big for your printer</b>: '+sz+' (printer '+bedText()+'). Use Resize, Slice it into parts, or Printer to change the bed size.'}</div></div>
<div class="verdict ${ok?'ok':'bad'}">${model.faces.length?(ok?'✓ Ready to print':'Fix the items above for a clean print'):'Nothing to check yet'}</div>
<div class="foot"><button data-a="recheck">Check again</button><button data-a="close">Close</button></div>`;
};
// Fill every flat hole whose rim can be traced (same as tracing it with the Line tool).
const fillHoles=function fillHoles(){
  pushUndo(null,'Fill holes');let filled=0;
  for(let guard=0;guard<500;guard++){
    let did=false;
    for(const [a,b] of openEdges())if(closeLoop(a,b,null)){filled++;did=true;break;}
    if(!did)break;
  }
  if(!filled){dropUndo();return flash("These gaps couldn't be filled automatically because their outline isn't flat. Trace them closed with the Line tool.",6000);}
  commitChange();flash('Filled '+filled+' hole'+(filled===1?'':'s'));
};
const fixDirections=function fixDirections(){
  if(!check||!check.wrongFaces.size)return;
  pushUndo(null,'Fix directions');
  for(const f of model.faces)if(check.wrongFaces.has(f.id)){f.pts.reverse();f.holes.forEach(h=>h.reverse());delete f._tc;}
  commitChange();flash('Turned '+check.wrongFaces.size+' face'+(check.wrongFaces.size===1?'':'s')+' the right way out');
};
const deleteLoose=function deleteLoose(){if(!model.edges.length)return;pushUndo(null,'Delete loose lines');model.edges=[];selection.clear();commitChange();flash('Loose lines deleted');};
const zoomToProblems=function zoomToProblems(){
  if(!check)return;
  const pts=[];for(const [a,b] of check.openSegs)pts.push(a,b);
  for(const f of model.faces)if(check.wrongFaces.has(f.id))pts.push(...f.pts);
  if(!pts.length)return;
  const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const p of pts)for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}
  cam.target=mul(add(mn,mx),0.5);
  const r=Math.max(dist(mn,mx)/2,0.003),C=getCB();
  cam.dist=r/Math.sin(Math.min(cam.fov/2,Math.atan(C.th*C.asp)))*1.4;camDirty();
};
$cad('checkPanel').addEventListener('click',e=>{
  const a=e.target.dataset&&e.target.dataset.a;if(!a)return;
  ({fill:fillHoles,flip:fixDirections,loose:deleteLoose,zoom:zoomToProblems,recheck:runCheck,close:closeCheck,drop:dropFloating,
    showfl:()=>{const ids=new Set();for(const p of check.floating)for(const id of p.ids)ids.add(id);selection=ids;selChanged();zoomExtents(ids);}})[a]();
});
const printReport=function printReport(m,fmtName){
  let msg=fmtName+' saved: '+m.tris.length+' triangles'+(m.partial?' (selection only)':'');
  if(m.open)msg+=' · The model has gaps: they are marked in red, see the Print check panel.';
  flash(msg,m.open?8000:3500);
  showProblemsIfAny();
};
// After a save/export, open the Print check panel (with problems marked on the model) if anything needs fixing.
const showProblemsIfAny=function showProblemsIfAny(){const a=analyseModel();if(a.openSegs.length||a.wrongFaces.size||a.floating.length)openCheck();};
const exportSTL=async function exportSTL(){
  flushAutosave();// (Perf-r1)
  const m=buildMesh();if(!m.tris.length)return flash('Nothing to export');
  if(!sizeOK())return;
  const buf=new ArrayBuffer(84+50*m.tris.length),dv=new DataView(buf),hdr='EvenUCan binary STL, units: mm';
  for(let i=0;i<hdr.length;i++)dv.setUint8(i,hdr.charCodeAt(i));
  dv.setUint32(80,m.tris.length,true);let o=84;
  for(const t of m.tris){
    const [A,B,C]=t.map(i=>m.verts[i]),n=norm(cross(sub(B,A),sub(C,A)));
    for(const v of [n,mul(A,1000),mul(B,1000),mul(C,1000)])for(const x of v){dv.setFloat32(o,x,true);o+=4;}
    o+=2;
  }
  const blob=new Blob([buf],{type:'model/stl'});
  const fname=docName+'.stl';
  if(window.showSaveFilePicker){
    try{
      const h=await window.showSaveFilePicker({suggestedName:fname,types:[{description:'STL 3D model (*.stl)',accept:{'model/stl':['.stl']}}]});
      const w=await h.createWritable();await w.write(blob);await w.close();
      flash('Exported '+h.name);printReport(m,'STL');return;
    }catch(e){if(e.name==='AbortError')return;console.warn(e);}
  }
  downloadBlob(fname,blob);printReport(m,'STL');
};
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc32=function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
// Minimal uncompressed ZIP writer (3MF files are ZIP packages).
const makeZip=function makeZip(files){
  // A real MS-DOS date/time, not the all-zero 1980-01-01 00:00 some zip readers (including some slicers)
  // reject as an "invalid date".
  const now=new Date(),dosTime=((now.getHours()&31)<<11)|((now.getMinutes()&63)<<5)|((now.getSeconds()>>1)&31),
    dosDate=(Math.max(0,now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
  const enc=new TextEncoder(),parts=[],central=[];let off=0;
  for(const [name,text] of files){
    const nb=enc.encode(name),data=enc.encode(text),crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(10,dosTime,true);h.setUint16(12,dosDate,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nb.length,true);
    parts.push(h.buffer,nb,data);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(12,dosTime,true);c.setUint16(14,dosDate,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);
    central.push(c.buffer,nb);off+=30+nb.length+data.length;
  }
  const csize=central.reduce((s,b)=>s+b.byteLength,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,e.buffer]);
};
const export3MF=async function export3MF(){
  flushAutosave();// (Perf-r1)
  const m=buildMesh();if(!m.tris.length)return flash('Nothing to export');
  if(!sizeOK())return;
  const blob=make3MF(m);
  const fname=docName+'.3mf';
  if(window.showSaveFilePicker){
    try{
      const h=await window.showSaveFilePicker({suggestedName:fname,types:[{description:'3MF 3D model (*.3mf)',accept:{'model/3mf':['.3mf']}}]});
      const w=await h.createWritable();await w.write(blob);await w.close();
      flash('Exported '+h.name);printReport(m,'3MF');return;
    }catch(e){if(e.name==='AbortError')return;console.warn(e);}
  }
  downloadBlob(fname,blob);printReport(m,'3MF');
};
const make3MF=function make3MF(m,embed){
  // Each separate (unconnected) piece becomes its own object so the slicer can arrange them.
  const par=m.verts.map((_,i)=>i),find=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i;};
  for(const t of m.tris){par[find(t[1])]=find(t[0]);par[find(t[2])]=find(t[0]);}
  const groups=new Map();
  for(const t of m.tris){const r=find(t[0]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(t);}
  const mm=x=>String(+(x*1000).toFixed(4));
  let res='',build='',id=1;
  for(const tris of groups.values()){
    const map=new Map(),vs=[];let tx='';
    for(const t of tris){
      const ix=t.map(i=>{if(!map.has(i)){map.set(i,vs.length);vs.push(m.verts[i]);}return map.get(i);});
      tx+=`<triangle v1="${ix[0]}" v2="${ix[1]}" v3="${ix[2]}"/>`;
    }
    const faceName = (tris[0] && tris[0].f) ? (model.faces.find(f => f.id === tris[0].f)?.name) : null;
    const objName = faceName || `Part ${id}`;
    res+=`<object id="${id}" name="${objName}" type="model"><mesh><vertices>`+vs.map(p=>`<vertex x="${mm(p[0])}" y="${mm(p[1])}" z="${mm(p[2])}"/>`).join('')+`</vertices><triangles>${tx}</triangles></mesh></object>`;
    build+=`<item objectid="${id}"/>`;id++;
  }
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">EvenUCan (© 2026 David John Waugh)</metadata><resources>'+res+'</resources><build>'+build+'</build></model>';
  const files=[
    ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'+(embed?'<Default Extension="json" ContentType="application/json"/>':'')+'</Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'],
    ['3D/3dmodel.model',xml]
  ];
  if(embed)files.push([EMBED,embed]);
  return makeZip(files);
};
const exportPNG=function exportPNG(){
  flushAutosave();// (Perf-r1)
  const h=hoverIdx;hoverIdx=-10;const pl=preview.lines;preview.lines=[];draw();
  cv.toBlob(async b=>{
    const fname=docName+'.png';
    if(window.showSaveFilePicker){
      try{
        const fh=await window.showSaveFilePicker({suggestedName:fname,types:[{description:'PNG image (*.png)',accept:{'image/png':['.png']}}]});
        const w=await fh.createWritable();await w.write(b);await w.close();
        hoverIdx=h;preview.lines=pl;requestDraw();flash('Exported '+fh.name);return;
      }catch(e){if(e.name==='AbortError'){hoverIdx=h;preview.lines=pl;requestDraw();return;}}
    }
    downloadBlob(fname,b);hoverIdx=h;preview.lines=pl;requestDraw();
  });
};

// ---------------------------------------------------------------- help
const toggleHelp=function toggleHelp(){
  const h=$cad('help');
  if(h.style.display==='block'){h.style.display='none';return;}
  h.innerHTML=`<h3>EvenUCan – quick guide</h3>
<p><b>EvenUCan</b>${appVersion?' version '+appVersion:''}: from idea to object.<br>Created by David John Waugh. © 2026 David John Waugh. Free software under the GNU General Public License v3 (or later), with no warranty.</p>
<p>Everything runs inside this one file. The drawing, box design, wiring and ESPHome code all work offline. Only the AI helper needs the internet: the wizard's <b>I have an idea for a gadget</b> (your idea into a parts list), <b>Write the code with AI</b> for Arduino sketches, <b>Make it with AI</b> and the <b>Fill in automatically</b> look-up in the Parts Library. It uses a free key from Google Gemini, Groq or OpenRouter, or your own paid Claude key (set it up in <b>Tools → AI helper key</b>). Groq and OpenRouter can't search the web or read PDFs, so <b>Look up online</b> uses what they already know. OpenRouter's free tier allows about 50 requests a day, and some of its free models may keep what you send. No key? Choose <b>Carry on without AI</b> in the wizard: start from an example project or tick the parts you have, and the <b>Code</b> tab makes a starter sketch with your pins filled in.</p>
<table>
<tr><td><kbd>Ctrl+K</kbd> or <kbd>?</kbd></td><td><b>Command Palette:</b> search and run any tool, action, or export instantly with fuzzy search.</td></tr>
<tr><td><kbd>Esc</kbd></td><td><b>Escape:</b> closes an open panel first. Press it again to cancel what you are drawing or moving. Press it once more, with nothing in progress, to clear the selection.</td></tr>
<tr><td><kbd>0</kbd> / <kbd>Home</kbd></td><td><b>Isometric View:</b> reset camera to standard 3D isometric view.</td></tr>
<tr><td><kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd></td><td><b>Orthographic Views:</b> <kbd>1</kbd> Top view, <kbd>2</kbd> Front view, <kbd>3</kbd> Right view.</td></tr>
<tr><td>Drag &amp; Drop</td><td>Drop any <b>.3mf</b>, <b>.stl</b>, <b>.osk</b>, or <b>.json</b> file directly onto the canvas to open it.</td></tr>
<tr><td><kbd>R</kbd> Rectangle</td><td>Click two corners on the ground or on any face. Type <b>3, 4</b> + Enter for exact sizes, or <b>20, 15, 15</b> (length, width, height) + Enter for a box.</td></tr>
<tr><td><kbd>P</kbd> Push/Pull</td><td>Click a face and move the mouse to extrude it into 3D. Type a distance + Enter. Double-click repeats. Push a shape drawn on a wall right through to cut an opening. <b>Several faces at once:</b> Shift+click them first (e.g. the strips of a rectangle split by lines), then click one of them and pull: they all move together, as one solid with no walls between them.</td></tr>
<tr><td>History</td><td>Every change is listed on the left (Rectangle, Push/Pull, Join…). <b>Click a step to go back to just after it</b>, like pressing Undo many times. The steps after it turn grey: click one to go forward again, or make a new change and they are thrown away. Click the <b>History</b> heading to fold the list away or open it again. Opening a file or starting a new one starts a new history; up to 300 steps are kept.</td></tr>
<tr><td>Sizes on shapes</td><td>A shape you have just drawn (or selected) shows its sizes: a rectangle its two sides, a circle or polygon its diameter (Ø), a box its width, depth and height (red, green and blue, like the axes). <b>Click a size, type a new one and press Enter</b> to change it, e.g. click 22 mm and type 30.</td></tr>
<tr><td>View cube</td><td>The cube in the top right corner turns with the view. Click a <b>face</b> to look straight at that side: new shapes are then drawn on that side (the light blue grid; <b>TOP</b> is the ground), and "Drawing on: …" shows under the cube (click it to go back to the ground). Click an <b>edge</b> or <b>corner</b> for an angled view, drag the cube to turn the view, and <b>⌂</b> goes back to the normal view of everything. A new, empty drawing starts with the cube in the middle, asking which side to draw on.</td></tr>
<tr><td><kbd>L</kbd> Line</td><td>Click points; close the loop to make a face. A line across a face splits it in two.</td></tr>
<tr><td><kbd>C</kbd> Circle</td><td>Click the centre, then the radius. Type <b>36s</b> to change the number of sides.</td></tr>
<tr><td><kbd>A</kbd> Arc</td><td>Click the two ends, then move to pull out the bulge and click (it snaps to a half circle). Type a bulge size and Enter, or <b>12s</b> for the number of pieces. An arc drawn across a face cuts it in two.</td></tr>
<tr><td><kbd>N</kbd> Polygon</td><td>Like the circle, but with straight sides: a hexagon to start with. Type <b>3s</b> for a triangle, <b>6s</b> hexagon, <b>8s</b> octagon (any number) and Enter, then click the centre and a corner, or type the size. Push/Pull it into a prism or a nut trap.</td></tr>
<tr><td><kbd>D</kbd> 3D Shapes</td><td>Pick <b>Ball</b>, <b>Cone</b>, <b>Cylinder</b> or <b>Pyramid</b> in the panel on the right. Click the centre (on the ground or on a face), then the radius, then the height (a ball needs only its radius). Or type each size and Enter. Each shape is a solid group, ready to print.</td></tr>
<tr><td><kbd>M</kbd> Move</td><td>Click an object to pick it up and click to drop it. Hold <kbd>Ctrl</kbd> to copy, then type <b>5x</b> for an array. A selected face is stretched instead of moved.</td></tr>
<tr><td><kbd>Q</kbd> Rotate</td><td>Click the centre, the starting angle, then the end angle (snaps every 15°) - or type degrees and press Enter. With something already selected, just type a number straight away: it spins around the selection's own centre (vertical axis), no clicks needed.</td></tr>
<tr><td><kbd>J</kbd> Round / Chamfer</td><td>Click a line where two faces meet to round it off (blue shows the result first). Type a size and Enter: <b>3</b> = 3 mm rounded, <b>3c</b> = 3 mm straight chamfer. Ctrl+click does the other kind once. <b>Shift+click a box to round every edge and corner at once</b> (box-like shapes without dents or holes; its size stays the same).</td></tr>
<tr><td><kbd>F</kbd> Offset</td><td>Click a face, then move inside or outside it and click: a copy of its outline that far in (splitting the face, e.g. for a rim to Push/Pull) or out. Or type a distance and Enter (<b>-2</b> = 2 mm outside).</td></tr>
<tr><td><kbd>W</kbd> Follow Me</td><td>Makes a pipe, bar, ring or frame. 1. Draw the shape (e.g. a circle) where the path starts, across it. 2. Draw the path with Line: start at the shape and keep clicking from the end of the last line, so the lines join. 3. Press W, click the shape, then click any line of the path: every line joined to it turns orange and is used. (Or select the lines first, then press W and click the shape. To follow the edge of a face instead, select that face first.) The result is a new solid group with neat corners. Esc cancels.</td></tr>
<tr><td><kbd>X</kbd> Slice</td><td>Cut a solid in two. Hover it: a red plane shows where the cut goes (it follows the mouse). Arrow keys turn the plane: <kbd>↑</kbd> flat (cuts across blue), <kbd>→</kbd> across red, <kbd>←</kbd> across green. Click to cut, or type a distance from the bottom (or left / front) and Enter. Each half is closed with a flat face and becomes its own group: move it with <kbd>M</kbd>, or select it and press Delete.</td></tr>
<tr><td>Browse parts</td><td>In the Parts Library, <b>Browse parts…</b> lists over 2,000 ready-made parts with their pins, sizes and pictures. Search by part number or by what it does (e.g. <i>gyroscope</i>, <i>air quality</i>, <i>screen</i>), or pick a kind to scroll through. <b>Add to my box</b> saves it and puts it in the Enclosure Wizard. (In a web browser, the first time it asks for the file parts-library.json, and keeps it.)</td></tr>
<tr><td>ESPHome device</td><td>In the <b>Wiring</b> window, the <b>ESPHome device</b> tab writes the whole ESPHome file for your ESP32 board, with the pins from the wiring: give it a name, choose <b>Sensor node</b> or <b>Voice assistant</b>, answer the few questions, then <b>Copy YAML</b> or <b>Save .yaml</b>. <b>Check with ESPHome</b> runs the ESPHome on this computer over it (like Validate). <b>Send to ESPHome</b> puts it straight into ESPHome Device Builder on this computer and opens it: plug the board in and click Install. Parts it doesn't know yet (e.g. ones imported from a part file) are written by your AI: one click on <b>Make it with AI</b>, using the part's name, part-file description and pins. To make it <i>do</i> something: a <b>Light rule</b> (e.g. red above 28 °C, green otherwise) is written in straight away; or describe it in <b>What should it do?</b> and click <b>Make it with AI</b>: your AI key adds it, ESPHome checks it, and any mistakes go back to the AI to fix.</td></tr>
<tr><td>Copy / Paste</td><td><kbd>Ctrl+C</kbd> copies the selection, <kbd>Ctrl+X</kbd> cuts it, <kbd>Ctrl+V</kbd> pastes a copy just to the right of the original (paste again for more), selected and ready to Move (<kbd>M</kbd>). After a Cut, the first paste goes back in place. Also in the Edit menu and the right-click menu.</td></tr>
<tr><td>Menus and tool buttons</td><td>Everything is in the menus at the top: <b>File</b>, <b>Edit</b>, <b>Draw</b>, <b>Modify</b>, <b>View</b>, <b>Tools</b> and <b>Help</b>. The row of tool buttons below them has the drawing tools you use most. Drag any tool button to a new place: the others slide aside and it snaps in. Drag the dotted grip at the start of a group to move the whole group. Your order is remembered; right-click the toolbar to put it back as it was.</td></tr>
<tr><td><kbd>Space</kbd> Select</td><td>Click, Shift+click, double-click for a whole object, or drag a box.</td></tr>
<tr><td><kbd>E</kbd> / <kbd>B</kbd></td><td>Eraser, Paint Bucket.</td></tr>
<tr><td><kbd>T</kbd> Tape Measure</td><td>Click two points to measure; an orange <b>guide point</b> is left at the second, so you can draw up to it (Ctrl+click just measures). After the first click, type a distance (e.g. <b>40</b>) and Enter to put a guide point exactly that far along, in the direction of the mouse (arrow keys lock it).</td></tr>
<tr><td><kbd>K</kbd> Find Centre</td><td>Click one point (e.g. a corner), then another. An orange centre point is placed halfway and stays there, so every tool can snap to it.</td></tr>
<tr><td><kbd>Shift+E</kbd> Delete guides</td><td>Removes every guide point when you no longer need them (Edit → Delete guides). One guide can be removed with the Eraser.</td></tr>
<tr><td>Square helper</td><td>Draw two lines that meet in an L, and a purple cross with dotted guides shows the missing corner. Every tool snaps to it ("Completes Square" or "Completes Rectangle"), so with the Line tool click it and then back to the start to get a perfect square face.</td></tr>
<tr><td>Closing holes</td><td>With the Line tool, trace any open edge (the rim of a hole or a missing face) and the hole is filled with a face. Lines that complete a closed, flat loop also make a face.</td></tr>
<tr><td>Navigate</td><td><b>Right-click + drag</b> orbits around whatever is under the mouse. <b>Middle-drag</b> (press the scroll wheel) moves (pans) the view, as does the Pan tool (<kbd>H</kbd>). <b>Scroll wheel</b> zooms toward the mouse. The <b>left button always belongs to the tool you've chosen</b>: click-click or press-drag-release both draw, and in the Select tool a drag makes a selection box. <kbd>Shift+Z</kbd> fits everything in view.</td></tr>
<tr><td>Right-click menu</td><td>A quick <b>right-click</b> on the model opens a menu: select whole object / all / none, Copy / Cut / Paste, Delete, Hide, Group, Join, Subtract, Intersect, Flip / Mirror, Lay flat on this face, Reverse faces, Round every edge, Zoom to selection, Export the selection, Delete all guides and Check Model. Right-click <b>and drag</b> still orbits. <kbd>Ctrl+T</kbd> selects nothing.</td></tr>
<tr><td>Axis lock</td><td>While drawing or moving, the arrow keys lock to an axis: → red (X), ← green (Y), ↑ blue (Z), ↓ unlocks. Without a lock, moving roughly along an axis snaps to it, so you can draw straight up from the ground and then across in mid-air at that height.</td></tr>
<tr><td>From Point</td><td>While locked to an axis, hover over any corner: the line stops level with it ("From Point", with a dotted line to the corner). E.g. press ↑ and hover the top of another part to draw a post exactly that tall.</td></tr>
<tr><td>Typing sizes</td><td>Just start typing a number. The box at the bottom right takes it. Units like <b>2m</b>, <b>300mm</b> and <b>5'6"</b> work.</td></tr>
<tr><td>Files</td><td>Ctrl+S saves a <b>.3mf</b> file that Cura and other slicers open directly. It also keeps your editable drawing inside, so reopening it here loses nothing. Ctrl+O opens .3mf and .stl files, including ones from other programs (flat areas become editable faces). Your work is also autosaved in this browser. Export to OBJ, STL or PNG.</td></tr>
<tr><td>Group / Ungroup</td><td>Select items (a box around them is easiest) and click <b>Group</b> (the dashed-box icon, or <kbd>G</kbd>). Clicking any part then selects the whole group (blue box), and Move/Rotate carry it as one solid piece that doesn't stick to or stretch other shapes. Ctrl+Move makes an independent copy. <b>Ungroup</b> (the split-boxes icon, or <kbd>Shift+G</kbd>) turns it back into loose shapes.</td></tr>
<tr><td><kbd>U</kbd> Join</td><td>Merge two or more objects into one solid: click one, Shift+click the others (any face of each), then <b>Join</b> (the merged-boxes icon, <kbd>U</kbd>, or the right-click menu). Where they overlap or touch, the walls inside go, so it prints as one piece. Objects that don't touch become one group that moves as one. Each must be a closed solid (Check Model shows any gaps).</td></tr>
<tr><td><kbd>S</kbd> Subtract / Intersect</td><td><b>Subtract</b> cuts shapes out of an object: click the object to <b>keep</b> first, Shift+click the shape(s) to cut out of it (e.g. a hexagon post standing through it for a nut trap, or a cylinder for a hole), then press <kbd>S</kbd> (or Modify → Subtract, or the right-click menu). <b>Intersect</b> keeps only where the selected objects overlap.</td></tr>
<tr><td>Flip / Mirror</td><td>Select an object and click <b>Flip / Mirror</b> (the tool button, Modify menu, or the right-click menu): flip it left ↔ right, front ↔ back or upside down where it is, or add a <b>mirrored copy</b> touching it on the right, back or top. The copy is selected together with the original, so pressing <kbd>U</kbd> joins them into one symmetrical solid.</td></tr>
<tr><td>Lay flat</td><td>Choose <b>Lay flat</b> and click the face that should go on the bed: the object turns over to lie on that face, at bed level, ready to print. Also in the right-click menu.</td></tr>
<tr><td>Lay all flat</td><td>Does Lay flat for every separate piece in one click, automatically picking each one's own largest face - handy straight after Generate makes several pieces at once. Also in the right-click menu.</td></tr>
<tr><td>Arrange on bed</td><td>Spreads every separate piece out sideways so none overlap, without changing how high up each one sits. Also in the right-click menu.</td></tr>
<tr><td>3D Text</td><td>Choose <b>3D Text</b> (the T icon), type your text in the panel, pick a font, letter height and depth, and <b>Raised</b> or <b>Engraved</b>. The outline follows the mouse: click where it starts, on the ground or on a face. Raised text is its own object (select it and the shape and press <kbd>U</kbd> to join them); engraved text is cut into the face you click. Uses the fonts on this computer.</td></tr>
<tr><td>Hole</td><td>Screw holes sized for 3D printing. Choose <b>Hole</b> (the target icon), pick the screw size (<b>M2 to M12</b>) and the kind: <b>Clearance</b> (the screw slides through), <b>Threaded</b> (a real thread, below), <b>Tapped</b> (a smaller pilot hole the screw cuts its own thread into), <b>Heat-set insert</b> (the right hole and depth for the usual brass inserts), <b>Countersunk</b> (flat-head screws sit flush), <b>Counterbored</b> (cap-head screws sit below the surface) or <b>Nut trap</b> (a hex pocket for the nut, plus the hole). The panel shows the exact sizes. Then click on a face: the hole is drilled straight in, right through or to the depth you set (type a depth and Enter; 0 = right through). Snap to a guide point or midpoint to place it exactly.</td></tr>
<tr><td>Stand-off</td><td>A round post for a <b>heat-set insert</b>, so a screw can hold a board or lid. Choose <b>Stand-off</b> (Tools menu, or the Electronics group on the toolbar), pick the screw size (<b>M2 to M5</b>), the insert length and the height, then click a face such as the floor of your box. The post is joined to that part, with the right hole in its top: for example <i>M3 insert: hole 4.1 mm, 6.7 mm deep, stand-off 8.5 mm wide</i>. The hole is the insert length plus 1 mm deep (plus 1.5 mm for M4 and M5). If you make it too thin (the wall round the hole must be at least half the hole wide) or too short for the insert, the panel says so and <b>Fix it</b> puts it right.</td></tr>
<tr><td>Board mount</td><td>Choose <b>Board mount</b>, pick your board from the list (ESP32-S3-DevKitC-1, ESP32 DevKitC, ESP32-C3 SuperMini, XIAO, Arduino Uno and Nano, Raspberry Pi Pico, 4, 5 and Zero 2 W, Wemos D1 mini, or a board from your Parts Library), then click the floor of your box where the middle of the board goes. Boards with mounting holes get insert stand-offs exactly under the holes, tall enough to clear the pins; boards without holes get a <b>cradle</b>: a base with side rails and a 0.3 mm gap all round. The panel tells you which edge has the USB socket (orange in the see-through outline) and can cut the opening in the box wall when the mount is joined to the box. <b>Turn 90°</b> turns the board. It is made as one object that moves as one piece; tick <b>Join</b> to make it part of the box straight away.</td></tr>
<tr><td>Threaded hole</td><td>In the Hole panel choose <b>Threaded</b>: a real metric thread (standard coarse pitch, e.g. M8 × 1.25) is cut into the hole, 0.3 mm roomier so a printed thread takes the screw, with a small cone at the mouth to start it. M6 and up print well; for M2 to M5 a heat-set insert or a tapped hole is stronger.</td></tr>
<tr><td>Shell</td><td>Hollow a solid out: choose <b>Shell</b>, type a wall thickness and Enter (2 mm to start), then click the face to leave open, e.g. the top of a box for a tray. Shift+click to pick more faces to leave open first; Ctrl+click hollows it with no opening. Works on box-like shapes (boxes, cylinders, prisms).</td></tr>
<tr><td>Hide / Unhide</td><td>Select faces and click <b>Hide</b> (the crossed-out eye icon, or <kbd>Shift+H</kbd>) to see and work on what's behind or inside them. Hidden faces show as a faint grey outline and can't be clicked. <b>Unhide All</b> (the eye icon, or <kbd>Shift+U</kbd>) brings them back. Hidden faces are still saved and exported.</td></tr>
<tr><td>Check Model</td><td>Click <b>File → Check model for printing</b> to see if your part is ready to print. Gaps that stop it being watertight are marked on the model with <b>thick red lines</b>, and inside-out faces with <b>orange outlines</b>. One click fixes them: <b>Fill holes</b>, <b>Fix directions</b> or <b>Delete loose lines</b>. <b>Zoom to problems</b> takes you straight there. It opens by itself if a Save or Export finds a problem, and re-checks as you edit.</td></tr>
<tr><td>Enclosure</td><td>Click <b>Tools → Box designer</b> (or the box button) to design a box around your electronics. Pick the parts, Power (USB cable, or a battery with charger and switch), a style (<b>Compact</b> for soldered wires, <b>Prototype / Dupont</b> with room for jumper plugs, or <b>Rugged</b> with thick walls, screw lid, gasket groove and mounting ears) and a lid. <b>Auto arrange</b> finds the smallest box that obeys the rules: ports open through a wall, mics face out away from the speaker, antennas stay clear, chargers sit near batteries. Drag parts in the top view to change the layout, then <b>Generate</b> makes the base and the lid (turned over, ready to print) as two groups. See-through outlines show where each part goes; they are never exported.</td></tr>
<tr><td>Parts Library</td><td>Click <b>Tools → Parts library</b> (or the chip button) to see the built-in parts and add your own. Type the sizes, or load a <b>top photo</b> and click the board's 4 corners: the photo is straightened to scale. Then add features by clicking or dragging on it: ports and antennas on an edge; mic holes, speaker cones, mounting holes, buttons, LEDs, pin rows, hot areas and display windows on the face. A <b>side photo</b> measures the heights (click both ends of the board, its top, the tallest part and the pin tips). Export/Import shares your parts as a file.<br><b>Fill in automatically</b> (optional, the only feature that uses the internet): <b>Look up online</b>: type the part number and Google's free Gemini AI searches the web, reads the datasheet and fills in a draft (sizes, holes, sockets, pins) with links to its sources. <b>Read a drawing</b> does the same from a dimension drawing you have saved (a picture or PDF; you can also drag it onto the part picture, or press Ctrl+V). Always check the draft before saving. Choose the AI in the box: <b>Google Gemini</b> (free key from Google AI Studio) or <b>Claude</b> (paid per use from an Anthropic account at console.anthropic.com). Keys are stored on this computer only.</td></tr>
<tr><td>Wiring</td><td>Click <b>Wiring</b> (or <b>Wiring…</b> in the Enclosure Wizard) to see what wire goes where for the parts in your box. It picks safe controller pins (on the ESP32-S3 it avoids the start-up, USB, serial, PSRAM and LED pins), builds the power chain (USB, or battery → charger → switch) and warns about anything risky, like 5 V signals into 3.3 V pins. You get a picture, a wiring list to tick off while soldering, and the matching ESPHome and Arduino pin settings. In the picture only the pins in use are labelled, outside the boards, and the wires are coloured by job: red for power (dashed for 5 V), black for ground, and a colour of its own for each signal (the key is at the bottom). Click a line of the wiring list, a wire or a part to see just that one with a big label such as <i>GPIO8 → SDA (SSD1306 OLED)</i>; <b>Show all</b> brings everything back. <b>One wire at a time</b> goes through the wires with <b>Next</b> and <b>Back</b> (or the arrow keys), in the same order as the list. Scroll the mouse wheel (or pinch) to zoom, drag the background to move about, <b>Fit</b> shows it all again, and drag a board to tidy the picture. <b>Save picture</b> saves the whole picture with every label. Each part needs its pins: the built-in parts have them, and in <b>Parts</b> you can add them or <b>Import pins…</b> (from the parts library that comes with EvenUCan, or a .fzpz part file).</td></tr>
<tr><td>Printer</td><td>Click <b>File → Printer size</b> to set your bed size (X, Y and height Z in mm), or pick a preset. The grid shows only on the bed, with an outline of the full build height. If a part won't fit, the size turns red and Save/Export warns you. The setting is remembered in this browser.</td></tr>
<tr><td>3D printing</td><td><b>Export 3MF</b> or <b>Export STL</b> and open the file in your slicer (PrusaSlicer, Cura, Bambu Studio, OrcaSlicer…). Sizes are always in millimetres. If something is selected, only the selection is exported. Each separate piece becomes its own part in 3MF. You'll get a warning if the model isn't fully closed (watertight).</td></tr>
<tr><td>Other</td><td>Ctrl+Z undo, Ctrl+Y redo, Delete removes the selection, Esc cancels.</td></tr>
</table><p style="color:#666">Press F1 or choose Help → Quick guide to close.</p>
<p style="color:#666;font-size:12px">Solid modelling for the Enclosure Wizard uses the Manifold geometry library (© The Manifold Authors, Apache License 2.0), built into this file. The optional Claude look-up uses the Anthropic TypeScript SDK (© Anthropic, Apache License 2.0), also built in. The parts library that comes with EvenUCan, and parts brought in with Import pins… from a .fzpz file or Fritzing, are from the Fritzing parts library (© Fritzing contributors, CC BY-SA 3.0); each part keeps that credit in its notes.</p>`;
  h.style.display='block';
};

// ---------------------------------------------------------------- menu wiring
$cad('bNew').onclick=newFile;$cad('bOpen').onclick=openFile;$cad('bSave').onclick=()=>saveFile(false);$cad('bSaveAs').onclick=()=>saveFile(true);
$cad('bObj').onclick=exportOBJ;$cad('bStl').onclick=exportSTL;$cad('b3mf').onclick=export3MF;$cad('bPng').onclick=exportPNG;
$cad('bUndo').onclick=undo;$cad('bRedo').onclick=redo;$cad('bHelp').onclick=toggleHelp;$cad('bResize').onclick=resizeModel;
// ---- version: in the corner of the view, and the About box
// Shown bottom right and in About.
const APP_VERSION='1.9.171';
let appVersion=APP_VERSION;
$cad('copyright').textContent='EvenUCan v'+APP_VERSION+' · © 2026 David John Waugh';
const showAbout=function showAbout(){
  const back=document.createElement('div');back.id='askBack';
  back.innerHTML=`<div id="askBox" style="width:min(520px,calc(100% - 32px))"><div class="msg" style="line-height:1.5">
<div style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:8px"><img src="${$cad('appIcon').querySelector('img').src}" alt="" width="32" height="32" style="border-radius:6px">EvenUCan</div>
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
};
$cad('bAbout').onclick=showAbout;$cad('appIcon').onclick=()=>$cad('bAbout').click();
// ---- auto-update check: runs once after load, non-blocking, silently fails
(()=>{
  const DISMISSED_KEY='updateDismissed';
  function semverGt(a,b){// returns true if a > b  (simple 3-part comparison)
    const p=s=>s.split('.').map(Number);const[a1,a2,a3]=p(a);const[b1,b2,b3]=p(b);
    return a1>b1||(a1===b1&&a2>b2)||(a1===b1&&a2===b2&&a3>b3);}
  function showBanner(latest,notes,url){
    const dismissed=WF.store.get(DISMISSED_KEY);
    if(dismissed===latest)return;// user already dismissed this version
    const msg=$cad('updateMsg');
    msg.innerHTML='🆕 EvenUCan <b>v'+escCad(latest)+'</b> is available'+(notes?' — '+escCad(notes):'')
      +'. <a href="'+escCad(url||'https://github.com/bullbrand/EvenUCan/releases/latest')+'" target="_blank" rel="noopener">Download update</a>';
    $cad('updateBanner').style.display='block';
    $cad('updateDismiss').onclick=()=>{WF.store.set(DISMISSED_KEY,latest);$cad('updateBanner').style.display='none';};
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
const hideSelected=function hideSelected(){
  const ids=model.faces.filter(f=>selection.has(f.id)&&!f.hidden).map(f=>f.id);
  if(!ids.length)return flash('Select the faces to hide first, then click Hide');
  pushUndo(null,'Hide');
  for(const f of model.faces)if(ids.includes(f.id))f.hidden=true;
  for(const id of ids)selection.delete(id);
  setHover(null);commitChange();flash(ids.length+(ids.length===1?' face':' faces')+' hidden · Unhide All brings them back');
};
const unhideAll=function unhideAll(){
  const n=model.faces.filter(f=>f.hidden).length;
  if(!n)return flash('Nothing is hidden');
  pushUndo(null,'Unhide all');for(const f of model.faces)delete f.hidden;
  commitChange();flash(n+(n===1?' face':' faces')+' shown again');
};
$cad('bHide').onclick=hideSelected;$cad('bUnhide').onclick=unhideAll;
const groupSelected=function groupSelected(){
  const items=groupable().filter(x=>selection.has(x.id));
  if(!items.length)return flash('Select what you want to group first (drag a box around it), then click Group');
  pushUndo(null,'Group');const g=nid();
  for(const x of items)x.g=g;// grouping items that were already grouped merges them into this one group
  commitChange();flash('Grouped '+items.length+' items · click any part to select the whole group');
};
const ungroupSelected=function ungroupSelected(){
  const items=groupable().filter(x=>selection.has(x.id)&&x.g);
  if(!items.length)return flash('Select a group first, then click Ungroup');
  pushUndo(null,'Ungroup');const n=new Set(items.map(x=>x.g)).size;
  for(const x of items)delete x.g;
  commitChange();flash(n===1?'Group broken into loose shapes':n+' groups broken into loose shapes');
};
// Join: merge two or more solids into one (where they overlap or touch, the inside walls go), as one group.
// Flat faces keep their outlines and colours; curved parts stay smooth.
