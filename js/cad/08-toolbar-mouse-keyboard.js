// EvenUCan 3D drawing app - 08-toolbar-mouse-keyboard.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- toolbar
const ICONS={
  select:'<path d="M6 3l12 9-5.5 1 3.2 6.2-2.2 1.1-3.2-6.2L6 18z"/>',
  line:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/>',
  rect:'<rect x="4" y="6" width="16" height="12"/>',
  circle:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r=".6"/>',
  push:'<path d="M4 15l8-4 8 4-8 4z"/><path d="M12 3v8M9 6l3-3 3 3"/>',
  move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  rotate:'<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
  guides:'<path d="M8 2v12M2 8h12" stroke-dasharray="2 1.6"/><circle cx="8" cy="8" r="1.6"/><path d="M14.5 14.5l6 6M20.5 14.5l-6 6" stroke="#d6336c" stroke-width="2.2"/>',
  slice:'<path d="M5 9h10v10H5z"/><path d="M9 5h10v10" stroke-dasharray="2 1.6"/><path d="M2 13.5h20" stroke="#d22" stroke-width="2.2"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="1.5"/><path d="M16 8V5a1.5 1.5 0 0 0-1.5-1.5h-9A1.5 1.5 0 0 0 4 5v10.5A1.5 1.5 0 0 0 5.5 17H8"/>',
  cut:'<circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="17.5" r="3"/><path d="M8.6 15.4L19 3M15.4 15.4L5 3"/>',
  paste:'<rect x="5" y="4.5" width="14" height="17" rx="1.5"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  polygon:'<path d="M7.5 4h9l4.5 8-4.5 8h-9L3 12z"/>',
  solid:'<path d="M12 3L6 20h12z"/><ellipse cx="12" cy="20" rx="6" ry="1.6"/><circle cx="18.5" cy="6.5" r="3.2"/>',
  arc:'<path d="M4 18a8.5 8.5 0 0 1 16 0"/><circle cx="4" cy="18" r="1.4"/><circle cx="20" cy="18" r="1.4"/>',
  offset:'<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7.5" y="7.5" width="9" height="9" rx=".5"/><path d="M3 3l4.5 4.5" stroke-dasharray="1.5 1.5"/>',
  follow:'<path d="M5 19c1-8 5-13 15-14"/><rect x="2" y="16" width="6" height="6" rx="1"/><path d="M16 3l4 2-2.5 3.5"/>',
  round:'<path d="M4 20V11a7 7 0 0 1 7-7h9"/><path d="M4 4h4M4 4v4" stroke-dasharray="1.5 1.5"/>',
  erase:'<path d="M4 16l8-8 6 6-5 5H7z"/><path d="M12 8l3-3 6 6-3 3"/><path d="M7 21h13"/>',
  paint:'<path d="M4 12l7-7 7 7-7 7z"/><path d="M4 12h14"/><path d="M20 14c1 2 1.6 3 1.6 4a1.6 1.6 0 0 1-3.2 0c0-1 .6-2 1.6-4z"/>',
  tape:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  center:'<circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/><path d="M5.5 17.5l13-11" stroke-dasharray="2 2"/><path d="M12 8v8M8 12h8" stroke-width="2.2"/>',
  orbit:'<ellipse cx="12" cy="12" rx="9" ry="4"/><path d="M12 3a4 9 0 0 1 0 18"/><path d="M19 9l2-1-.5 2.3"/>',
  pan:'<path d="M8 13V6a1.4 1.4 0 0 1 2.8 0v5V4.5a1.4 1.4 0 0 1 2.8 0V11V6a1.4 1.4 0 0 1 2.8 0v8c0 4-2 7-6 7-3 0-4.2-1.3-6-4l-2-3a1.4 1.4 0 0 1 2.3-1.6z"/>',
  zoom:'<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M7.5 10h5M10 7.5v5"/>',
  extents:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="9" y="9" width="6" height="6"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  group:'<rect x="2.5" y="2.5" width="19" height="19" rx="1.5" stroke-dasharray="3 2.2"/><rect x="6.5" y="6.5" width="6" height="6"/><rect x="11.5" y="11.5" width="6" height="6"/>',
  ungroup:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M14 3.5h6.5V10M3.5 14v6.5H10" stroke-dasharray="2.2 2"/>',
  join:'<path d="M3 4h10v5h8v11H11v-5H3z"/><path d="M11 9h2v6h-2" stroke-dasharray="1.6 1.4"/>',
  text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/><path d="M16 14h5M18.5 14v6" stroke-width="1.6"/>',
  hole:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-width="1.5"/>',
  shell:'<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M6.5 9.5l5.5-2.4 5.5 2.4v5.7L12 17.6l-5.5-2.4z" stroke-dasharray="1.6 1.4"/>',
  flip:'<path d="M12 2v20" stroke-dasharray="2 1.8"/><path d="M9.5 6L3 18h6.5z"/><path d="M14.5 6L21 18h-6.5z"/>',
  flat:'<path d="M2 20h20"/><path d="M6 17h12v-4H6z"/><path d="M12 3v6M9 6.5l3 3 3-3"/>',
  layall:'<path d="M2 20h20"/><rect x="2.5" y="15" width="5" height="5"/><rect x="9.5" y="15" width="5" height="5"/><rect x="16.5" y="15" width="5" height="5"/>',
  arrange:'<rect x="2.5" y="2.5" width="8" height="8"/><rect x="13.5" y="2.5" width="8" height="8"/><rect x="2.5" y="13.5" width="8" height="8"/><rect x="13.5" y="13.5" width="8" height="8"/>',
  clearbed:'<path d="M2 20h20"/><path d="M5 16h14" stroke-dasharray="2 1.5"/><path d="M7 6l10 10M17 6L7 16" stroke-width="2.2"/>',
  subtract:'<path d="M3 5h13v13H3z"/><circle cx="16" cy="18" r="5" stroke-dasharray="1.8 1.5"/><path d="M11 18a5 5 0 0 1 5-5"/>',
  intersect:'<rect x="3" y="3" width="12" height="12" stroke-dasharray="1.8 1.5"/><rect x="9" y="9" width="12" height="12" stroke-dasharray="1.8 1.5"/><rect x="9" y="9" width="6" height="6" style="fill:var(--ic);stroke:none;opacity:.55"/>',
  hide:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/>',
  unhide:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check:'<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  enclosure:'<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9"/><path d="M5.5 12.5l4 1.8v3.4l-4-1.8z"/>',
  standoff:'<path d="M2 21h20"/><path d="M7 21V9h10v12"/><ellipse cx="12" cy="9" rx="5" ry="1.6"/><path d="M10.4 9V4h3.2v5" stroke-dasharray="1.6 1.2"/>',
  boardmount:'<path d="M2 21h20"/><rect x="3" y="9" width="18" height="3" rx=".5"/><path d="M5.5 12v9M18.5 12v9"/><rect x="8" y="5" width="6" height="4"/><path d="M16 7h3"/>',
  cutout:'<rect x="2.5" y="4.5" width="19" height="15" rx="1.5"/><rect x="6" y="9.5" width="12" height="5" rx="2.5"/>',
  makelid:'<path d="M3 8l9-4 9 4v3l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v3"/>',
  parts:'<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>',
  clear:'<path d="M9 3h6v2H8.5L7 7h10l-1.5-2H15V3zM5 8h14l-1.5 13h-11zM10 11v7M14 11v7"/>'
};
const TOOLS=[['select','Select','Space'],null,['line','Line','L'],['rect','Rectangle','R'],['circle','Circle','C'],['arc','Arc','A'],['polygon','Polygon','N'],['solid','3D Shapes','D'],null,['push','Push/Pull','P'],['move','Move / Copy','M'],['rotate','Rotate','Q'],['round','Round / Chamfer edge','J'],['offset','Offset','F'],['follow','Follow Me','W'],['slice','Slice','X'],null,['erase','Eraser','E'],['paint','Paint Bucket','B'],null,['tape','Tape Measure','T'],['center','Find Centre','K'],null,['orbit','Orbit','O'],['pan','Pan','H'],['zoom','Zoom','Z']];
// Icon colours by kind of tool, so the toolbar is quick to scan.
const ICON_COL=(()=>{const c={},set=(col,...ns)=>ns.forEach(n=>c[n]=col);
  set('#1c64d6','line','rect','circle','arc','polygon','solid','text');// draw
  set('#e0620d','push','move','rotate','flip','flat','round','offset','follow','slice','shell','hole');// change shapes
  set('#e03131','clearbed');
  set('#d6336c','erase');set('#8e44ad','paint');
  set('#0b9480','tape','center','guides');// measure
  set('#4c5fd5','orbit','pan','zoom','extents');// view
  set('#444','select','undo','redo','copy','cut','paste');
  set('#2b8a3e','group','ungroup','join','subtract','intersect','check');set('#d48806','hide','unhide');
  set('#7048e8','enclosure','parts','standoff','boardmount','makelid','cutout');
  return c;})();
const TOOL_DESC={select:'click or drag a box to pick things; double-click picks a whole object',
  line:'draw straight lines; join back to the start to make a face',rect:'draw a rectangle on the ground or on a face; type 20, 15, 15 for a box (length, width, height)',
  circle:'draw a circle (type 36s for more sides)',
  polygon:'draw a hexagon, triangle or any polygon (type 3s, 6s, 8s… for the sides)',
  solid:'make a ball, cone, cylinder or pyramid in one go',arc:'click both ends, then pull out the curve',
  push:'pull a face out into 3D, or push it in to cut; Shift+click several faces first to push them together',move:'move the selection; hold Ctrl to copy',rotate:'turn the selection around a point',
  round:'round off or chamfer the line where two faces meet; Shift+click a box to round every edge',offset:'copy a face\'s outline inside or outside it',
  follow:'sweep a face along a path: click the face, then the line to follow (or select the lines first)',
  slice:'cut a solid in two with a flat plane; then move or delete either half',erase:'click lines or faces to delete them',paint:'colour faces; Alt+click picks up a colour',
  tape:'measure, and leave a guide point to draw to (type a distance for an exact one)',center:'mark the halfway point between two points',
  orbit:'drag to turn the view round',pan:'drag to slide the view',zoom:'drag up or down to zoom'};
// Shows a title straight away, styled: the name, its shortcut key (from the brackets) and what it does.
{
  const tip=document.createElement('div');tip.id='tip';document.body.appendChild(tip);
  const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  document.addEventListener('mouseover',e=>{
    const el=e.target.closest&&e.target.closest('#toolbar button,#menubar button,#menubar label');
    if(!el){tip.style.display='none';return;}
    if(el.title){el.dataset.tip=el.title;el.removeAttribute('title');}// no slow browser tooltip as well
    const s=el.dataset.tip;if(!s){tip.style.display='none';return;}
    const m=s.match(/\(((?:Ctrl|Shift|Alt|F\d+|Space|[A-Z])(?:\+\w+)*)\)/),key=m?m[1]:'',rest=(m?s.replace(m[0],''):s).replace(/\s+:/,':').trim();
    const c=rest.indexOf(': '),name=c>0?rest.slice(0,c):(el.textContent.trim()||rest),desc=c>0?rest.slice(c+2):(el.textContent.trim()?rest:'');
    tip.innerHTML='<b>'+esc(name)+'</b>'+(key?'<kbd>'+esc(key)+'</kbd>':'')+(desc&&desc!==name?'<span class="d">'+esc(desc.charAt(0).toUpperCase()+desc.slice(1))+'</span>':'');
    tip.style.display='block';
    const r=el.getBoundingClientRect(),w=tip.offsetWidth;
    tip.style.left=Math.max(4,Math.min(innerWidth-w-4,r.left+r.width/2-w/2))+'px';tip.style.top=(r.bottom+6)+'px';
  });
  document.addEventListener('mousedown',()=>{tip.style.display='none';});
}
// (1.9.35) The colourful icon from the sprite when there is one; the old line icon otherwise.
const fiHas=n=>!!document.getElementById('fi-'+n);
const icon=n=>fiHas(n)?'<svg class="fi" aria-hidden="true"><use href="#fi-'+n+'"/></svg>':'<svg viewBox="0 0 24 24" style="--ic:'+(ICON_COL[n]||'#333')+'">'+ICONS[n]+'</svg>';
const tb=$cad('toolbar');
// Every toolbar button, by key. Handlers may be defined further down, so they're looked up at click time.
const TB_BTN={};let tbDragged=false;
const mkBtn=(key,title,fn,tool)=>{const b=document.createElement('button');b.dataset.key=key;if(tool)b.dataset.tool=tool;b.title=title;b.innerHTML=icon(key);b.onclick=()=>{if(!tbDragged)fn();};TB_BTN[key]=b;};
for(const [ic,title,fn] of [['undo','Undo (Ctrl+Z)',()=>undo()],['redo','Redo (Ctrl+Y)',()=>redo()],
  ['copy','Copy (Ctrl+C): copy the selection, ready to paste',()=>copySel(false)],['cut','Cut (Ctrl+X): remove the selection, ready to paste',()=>copySel(true)],['paste','Paste (Ctrl+V): put a copy of what you copied beside it',()=>pasteClip()]])mkBtn(ic,title,fn);
for(const t of TOOLS)if(t)mkBtn(t[0],t[1]+' ('+t[2]+'): '+(TOOL_DESC[t[0]]||''),()=>setTool(t[0]),t[0]);
mkBtn('extents','Zoom Extents (Shift+Z): fit everything in view',()=>zoomExtents());
mkBtn('flip','Flip / Mirror: turn the selection over left-right, front-back or upside down, or add a mirrored copy beside it',()=>{const r=TB_BTN.flip.getBoundingClientRect();if(r.width)flipMenu(r.left,r.bottom+4);else flipMenu(innerWidth/2-115,120);});
mkBtn('text','3D Text: type a label, then click on the ground or on a face; raised, or engraved into the face',()=>setTool('text'),'text');
mkBtn('hole','Hole: screw holes at printing sizes: clearance, tapped, heat-set insert, countersunk, counterbored or nut trap. Pick the size, then click a face',()=>setTool('hole'),'hole');
mkBtn('cutout','Access Hole Tool: pick the hole and the direction in the panel, then click a wall',()=>setTool('cutout'),'cutout');
mkBtn('standoff','Stand-off: a round post with the right hole for a heat-set insert (M2 to M5). Pick the size, then click the box floor',()=>setTool('standoff'),'standoff');
mkBtn('boardmount','Board mount: pick your board (ESP32, Arduino, Raspberry Pi...) and click the box floor: the right stand-offs or cradle are made for it',()=>setTool('boardmount'),'boardmount');
mkBtn('makelid','Make lid: add a lid for a box already on the canvas — click any face of the box',()=>setTool('makelid'),'makelid');
mkBtn('shell','Shell: hollow a solid out with walls of a set thickness; click the face to leave open (type a thickness first)',()=>setTool('shell'),'shell');
mkBtn('flat','Lay flat: click a face, and its object turns over to lie flat on the bed on that face',()=>setTool('flat'),'flat');
mkBtn('layall','Lay all flat: every separate piece turns over onto its own largest face, ready to print - handy after Generate makes several pieces at once',()=>layAllFlat());
mkBtn('arrange','Arrange on bed: spreads every separate piece out sideways so none overlap, without changing how high up each one sits',()=>arrangeOnBed());
mkBtn('clearbed','Clear build plate: remove all parts and objects from the print bed (asks to confirm first)',()=>clearBuildPlate());
for(const [ic,title,fn] of [['guides','Delete guides (Shift+E): remove all guide points left by the Tape Measure and Find Centre',()=>deleteGuides()],[''],['group','Group (G): keep the selection together, so it selects and moves as one piece',()=>groupSelected()],['ungroup','Ungroup (Shift+G): back to loose shapes',()=>ungroupSelected()],['join','Join (U): merge two or more objects into one solid; where they overlap or touch, the inside walls go',()=>joinSelected()],['subtract','Subtract (S): cut shapes out of an object. Click the object to keep, Shift+click the shapes to cut out of it, then Subtract',()=>subtractSelected()],['intersect','Intersect: keep only the part where the selected objects overlap',()=>intersectSelected()],['hide','Hide (Shift+H): hide the selected faces',()=>hideSelected()],['unhide','Unhide all (Shift+U): show all hidden faces again',()=>unhideAll()],['check','Check Model: is it ready to print? Problems are marked on the model',()=>openCheck()],[''],['enclosure','Enclosure Wizard: design a box around your electronics',()=>window.WFEnclosure&&WFEnclosure.openWizard()],['parts','Parts Library: your electronic parts (add new ones from a photo)',()=>window.WFEnclosure&&WFEnclosure.openLibrary()]])if(ic)mkBtn(ic,title,fn);
mkBtn('clear','Clear build plate: discard everything and start a new project',()=>{if(confirm('Start a new project?\nThis will clear the build plate and all project data.')){docDirty=false;newProject();}});
// The toolbar is made of groups. Drag a button to move it (the others slide aside and it snaps into place), or drag
// a group by its grip. The order is remembered; right-click the toolbar to go back to the original order.
const TB_DEFAULT=[['undo','redo'],['select'],['line','rect','circle','arc','polygon','solid','text'],['push','move','rotate','flip','offset','follow','round'],['erase','paint'],['tape','center'],['orbit','pan','zoom','extents'],['enclosure','parts','clear']];
// (1.9.34) The rest (Copy/Paste, Group, Join, Subtract, Hide, Check, Lay flat, Arrange...) live in the menus; their buttons still
// exist in TB_BTN, so the menus click them. A new storage key so an old, longer saved order doesn't bring the clutter back.
const TB_KEYS=new Set(TB_DEFAULT.flat());
const tbOrder=function tbOrder(){
  let L=null;try{L=JSON.parse(store.get('toolbar2'));}catch(e){/* intentional: default toolbar */}
  if(!Array.isArray(L))return TB_DEFAULT.map(g=>g.slice());
  const seen=new Set();L=L.map(g=>(Array.isArray(g)?g:[]).filter(k=>TB_BTN[k]&&TB_KEYS.has(k)&&!seen.has(k)&&seen.add(k)));
  for(const k of TB_KEYS)if(!seen.has(k)){// a button added in a newer version: into the group of its usual neighbours
    const dg=TB_DEFAULT.find(g=>g.includes(k)),home=dg&&L.find(g=>g.some(x=>dg.includes(x)));
    if(home)home.push(k);else L.push([k]);
  }
  return L.filter(g=>g.length);
};
const tbRender=function tbRender(){
  tb.innerHTML='';
  for(const g of tbOrder()){
    const d=document.createElement('div');d.className='tbg';
    const grip=document.createElement('span');grip.className='grip';grip.title='Drag this group of buttons to a new place (right-click the toolbar to reset the order)';d.appendChild(grip);
    for(const k of g)d.appendChild(TB_BTN[k]);
    tb.appendChild(d);
  }
  if(typeof toolNameCad!=='undefined')document.querySelectorAll('#toolbar button[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===toolNameCad));
};
tbRender();// (1.9.38) replaced straight away by the grouped toolbar built with the menus (see buildRibbon)

// ---- Copy, Cut and Paste. A paste goes beside the original (or back in place after a Cut) and is selected, ready to Move.
let clip=null,pasteN=0;
const copySel=function copySel(cut){
  const ids=expandGroups(new Set(selection)),F=model.faces.filter(f=>ids.has(f.id)&&!f.hidden),E=model.edges.filter(e=>ids.has(e.id));
  if(!F.length&&!E.length)return flash('Select something to '+(cut?'cut':'copy')+' first');
  clip={F:cloneCad(F),E:cloneCad(E),b:bounds(ids),cut};pasteN=0;
  if(cut){pushUndo(null,'Cut');model.faces=model.faces.filter(f=>!ids.has(f.id));model.edges=model.edges.filter(e=>!ids.has(e.id));selection.clear();commitChange();flash('Cut. Ctrl+V pastes it back');}
  else flash('Copied. Ctrl+V pastes a copy beside it');
};
const pasteClip=function pasteClip(){
  if(!clip)return flash('Nothing copied yet: select something and press Ctrl+C');
  const step=(clip.b?clip.b.size[0]:0.01)+0.005,dx=step*(clip.cut?pasteN:pasteN+1);pasteN++;
  pushUndo(null,'Paste');
  const before=new Set([...model.faces,...model.edges].map(x=>x.id));
  copyEntities(clip.F,clip.E,new Set([...clip.F,...clip.E].map(x=>x.id)),p=>[p[0]+dx,p[1],p[2]]);
  selection=new Set([...model.faces,...model.edges].map(x=>x.id).filter(id=>!before.has(id)));
  selChanged();commitChange();
  flash(dx?'Pasted '+fmt(dx)+' to the right of the original: press M to move it where you want':'Pasted back in place');
};

// ---------------------------------------------------------------- mouse
let nav=null,lastM={x:0,y:0},lastE=null;
const mpos=e=>{const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();flash('The 3D view lost its connection to the graphics card.',4000);});
// (the old handler called initGL(), which does not exist: it crashed and the view never came back.) The shaders and buffers are built once at start-up,
// so the safe recovery is to keep the user's work and ask for a reload.
cv.addEventListener('webglcontextrestored',()=>{flash('The graphics card is back. Save your work (💾 Save at the top), then reload this page (F5) to bring the 3D view back.',15000);});
// Right-click context menu (Cut/Copy/Paste) for text inputs and textareas anywhere in the app.
// Browsers suppress the native context menu in some sandboxed / PWA contexts, so we build our own.
(()=>{
  const menu=document.createElement('div');
  menu.id='ctxMenu';
  menu.style.cssText='position:fixed;z-index:2147483000;background:var(--panel,#fff);border:1px solid var(--border,#ccc);border-radius:6px;box-shadow:0 3px 12px rgba(0,0,0,.18);padding:4px 0;min-width:140px;display:none;font-size:13px';
  document.body.appendChild(menu);
  let ctxTarget=null;
  const hide=()=>{menu.style.display='none';ctxTarget=null;};
  document.addEventListener('mousedown',e=>{if(!menu.contains(e.target))hide();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();},true);
  document.addEventListener('contextmenu',e=>{
    const t=e.target;
    if(!(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement))return;
    e.preventDefault();e.stopPropagation();
    ctxTarget=t;
    const sel=t.selectionStart!==t.selectionEnd;
    const ro=t.readOnly||t.disabled;
    const items=[
      {label:'Cut',key:'cut',enabled:sel&&!ro},
      {label:'Copy',key:'copy',enabled:sel},
      {label:'Paste',key:'paste',enabled:!ro}
    ];
    menu.innerHTML=items.map(it=>`<div data-cmd="${it.key}" style="padding:6px 18px;cursor:${it.enabled?'pointer':'default'};opacity:${it.enabled?1:.4};user-select:none">${it.label}</div>`).join('');
    menu.querySelectorAll('[data-cmd]').forEach(el=>{
      el.addEventListener('mousedown',ev=>{
        ev.preventDefault();ev.stopPropagation();
        const cmd=el.dataset.cmd;
        if(cmd==='cut'||cmd==='copy'){
          const v=t.value.substring(t.selectionStart,t.selectionEnd);
          navigator.clipboard&&navigator.clipboard.writeText(v).catch(()=>{});
          if(cmd==='cut'&&!ro){const s=t.selectionStart,e2=t.selectionEnd;t.value=t.value.slice(0,s)+t.value.slice(e2);t.selectionStart=t.selectionEnd=s;t.dispatchEvent(new Event('input',{bubbles:true}));}
        }else if(cmd==='paste'){
          if(navigator.clipboard&&navigator.clipboard.readText){
            navigator.clipboard.readText().then(text=>{
              const s=t.selectionStart,e2=t.selectionEnd;
              t.value=t.value.slice(0,s)+text+t.value.slice(e2);
              t.selectionStart=t.selectionEnd=s+text.length;
              t.dispatchEvent(new Event('input',{bubbles:true}));
            }).catch(()=>{});
          }else{t.focus();document.execCommand('paste');}
        }
        hide();
      });
    });
    // Position near the cursor, keeping inside the viewport
    const vw=window.innerWidth,vh=window.innerHeight;
    menu.style.display='block';
    const mw=menu.offsetWidth,mh=menu.offsetHeight;
    menu.style.left=Math.min(e.clientX,vw-mw-4)+'px';
    menu.style.top=Math.min(e.clientY,vh-mh-4)+'px';
  },true);
})();
// Mouse: right-drag orbits around the point under the mouse; the left button always belongs to the active tool
// (draw/edit, with press-drag-release finishing a step; box-select in the Select tool);
// middle-drag pans, wheel zooms toward the mouse. A left click without dragging still does the tool's action.
let dragDraw=null;
const LIM=Math.PI/2-1e-4;
const pivotAt=function pivotAt(m){
  const ray=screenRay(m.x,m.y),h=pickFace(ray);if(h)return h.p;
  const g=rayPlane(ray,[0,0,0],Z);
  return g&&dist(g,getCB().eye)<cam.dist*10?g:cam.target;
};
// Spin the camera around point P: dx turns around the vertical, dy tilts up/down.
const orbitAround=function orbitAround(P,dx,dy){
  let eye=getCB().eye,tgt=cam.target;
  const a=-dx*0.008,rz=p=>rotateAbout(p,P,Z,a);
  eye=rz(eye);tgt=rz(tgt);
  let dir=sub(eye,tgt);const pitch=Math.asin(clamp(dir[2]/len(dir),-1,1)),b=clamp(pitch+dy*0.008,-LIM,LIM)-pitch;
  const yaw=Math.atan2(dir[1],dir[0]),r=[-Math.sin(yaw),Math.cos(yaw),0];
  eye=rotateAbout(eye,P,r,-b);tgt=rotateAbout(tgt,P,r,-b);
  dir=sub(eye,tgt);const d=len(dir);
  cam.target=tgt;cam.dist=d;cam.yaw=Math.atan2(dir[1],dir[0]);cam.pitch=clamp(Math.asin(clamp(dir[2]/d,-1,1)),-LIM,LIM);
};
const restCursor=()=>{cv.style.cursor=tool.nav?(tool.nav==='zoom'?'ns-resize':'grab'):(toolNameCad==='select'?'default':'crosshair');};
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);const m=mpos(e);lastM=m;
  if(document.activeElement===vcbEl)vcbEl.blur();
  if(e.button===1||e.button===2||(e.button===0&&tool.nav)){
    const mode=e.button===0?tool.nav:e.button===1||e.shiftKey?'pan':'orbit';
    nav={mode,x:m.x,y:m.y,pivot:mode==='orbit'?pivotAt(m):null,button:e.button,travel:0};
    if(mode!=='zoom')cv.style.cursor='grabbing';e.preventDefault();return;
  }
  if(e.button!==0||!tool.down)return;
  if(toolNameCad==='select'){tool.down(e,m);requestDraw();return;}
  // Drawing/editing tools always get the left button. Refresh inference at the exact click point first.
  if(tool.move){lastE=e;tool.move(e,m);}
  const wasBusy=tool.busy?tool.busy():false;
  tool.down(e,m);requestDraw();
  // If this press started an operation, a drag-and-release finishes it (press = first point, release = second).
  dragDraw={m,started:!!(tool.busy&&!wasBusy&&tool.busy())};
});
cv.addEventListener('pointermove',e=>{
  const m=mpos(e);lastE=e;
  if(nav){
    const dx=m.x-nav.x,dy=m.y-nav.y;nav.x=m.x;nav.y=m.y;nav.travel+=Math.abs(dx)+Math.abs(dy);
    if(nav.mode==='orbit')orbitAround(nav.pivot||cam.target,dx,dy);
    else if(nav.mode==='pan'){const C=getCB(),w=2*cam.dist*C.th/C.H;cam.target=add(cam.target,add(mul(C.r,-dx*w),mul(C.u,dy*w)));}
    else zoomAt(getCB().W/2,getCB().H/2,Math.exp(dy*0.01));
    camDirty();lastM=m;return;
  }
  lastM=m;if(tool.move)tool.move(e,m);requestDraw();
});
cv.addEventListener('pointerup',e=>{
  const m=mpos(e);
  if(nav){
    const menu=nav.button===2&&nav.travel<5;// a right click without dragging opens the menu; a drag orbits
    nav=null;restCursor();if(tool.move&&lastE&&!tool.nav)tool.move(lastE,m);requestDraw();
    if(menu)openCtx(m,e);
    return;
  }
  const dd=dragDraw;dragDraw=null;
  if(dd&&dd.started&&e.button===0&&Math.hypot(m.x-dd.m.x,m.y-dd.m.y)>5&&tool.busy&&tool.busy()){
    if(tool.move)tool.move(e,m);tool.down(e,m);requestDraw();return;
  }
  if(tool.up)tool.up(e,m);requestDraw();
});
cv.addEventListener('dblclick',e=>{if(tool.dbl){tool.dbl(e,mpos(e));requestDraw();}});

// ---- Right-click menu, as in SketchUp: right-clicking something not already selected selects it first.
const ctxEl=document.createElement('div');ctxEl.id='ctx';document.body.appendChild(ctxEl);
const closeCtx=()=>{ctxEl.style.display='none';};
const openCtx=function openCtx(m,e){
  const hit=pickEntity(m.x,m.y);
  if(hit!==null&&!selection.has(hit)){selection=expandGroups(new Set([hit]));selChanged();}
  const h=pickFace(screenRay(m.x,m.y)),face=h&&h.face,n=selection.size;
  const selFaces=model.faces.filter(f=>selection.has(f.id));
  const items=[
    ['Select whole object','Double-click',!!face,()=>{for(const id of componentOf(face.id))selection.add(id);selChanged();}],
    ['Select all','Ctrl+A',model.faces.length+model.edges.length>0,selectAll],
    ['Select none','Ctrl+T',n>0,()=>{selection.clear();selChanged();}],
    null,
    ['Copy','Ctrl+C',n>0,()=>copySel(false)],
    ['Cut','Ctrl+X',n>0,()=>copySel(true)],
    ['Paste','Ctrl+V',!!clip,pasteClip],
    null,
    ['Delete','Delete',n>0,deleteSelection],
    ['Hide','Shift+H',selFaces.length>0,hideSelected],
    ['Unhide all','Shift+U',model.faces.some(f=>f.hidden),unhideAll],
    null,
    ['Group','G',n>0,groupSelected],
    ['Ungroup','Shift+G',hasGroup(selection),ungroupSelected],
    ['Join into one solid','U',n>0,joinSelected],
    ['Subtract (cut the others out of the first)','S',n>0,subtractSelected],
    ['Intersect (keep only the overlap)','',n>0,intersectSelected],
    ['Flip / Mirror…','',n>0,()=>setTimeout(()=>flipMenu(e.clientX,e.clientY),0)],
    ['Lay flat on this face','',!!face,()=>layFlat(face)],
    ['Lay all flat on the bed','',model.faces.length>0,layAllFlat],
    ['Arrange on bed','',model.faces.length>0,arrangeOnBed],
    ['Clear build plate...','',model.faces.length>0||model.edges.length>0||model.guides.length>0,clearBuildPlate],
    ['Reverse faces','',selFaces.length>0,()=>{pushUndo(null,'Reverse faces');for(const f of selFaces){f.pts.reverse();f.holes.forEach(L=>L.reverse());delete f._tc;}commitChange();flash(selFaces.length+' face'+(selFaces.length>1?'s':'')+' turned the other way');}],
    ['Round every edge ('+fmt(roundSize)+')','J, then Shift+click',!!face,()=>roundAllOn(face)],
    null,
    ['Zoom to selection','',n>0,()=>zoomExtents(selection)],
    ['Zoom extents','Shift+Z',true,()=>zoomExtents()],
    null,
    ['Export selection as 3MF','',n>0,export3MF],
    ['Export selection as STL','',n>0,exportSTL],
    ['Delete all guides','Shift+E',model.guides.length>0,deleteGuides],
    ['Check Model','',true,openCheck]
  ];
  showMenu(items,e.clientX,e.clientY);
};
document.addEventListener('pointerdown',e=>{if(ctxEl.style.display==='block'&&!ctxEl.contains(e.target))closeCtx();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCtx();},true);
cv.addEventListener('wheel',closeCtx,{passive:true});
window.addEventListener('blur',closeCtx);
cv.addEventListener('wheel',e=>{e.preventDefault();const m=mpos(e);zoomAt(m.x,m.y,e.deltaY>0?1.15:1/1.15);if(tool.move&&lastE)tool.move(lastE,m);},{passive:false});
cv.addEventListener('pointerleave',()=>{if(!nav){setMarker(null);}});
const refresh=()=>{if(tool.move&&lastE){tool.move(lastE,lastM);requestDraw();}};

// ---------------------------------------------------------------- keyboard
const applyVcb=function applyVcb(){const t=vcbEl.value.trim();vcbEl.value='';vcbEl.blur();if(t&&tool.vcb)tool.vcb(t);requestDraw();};
document.addEventListener('keydown',e=>{
  // F1 opens the Quick guide wherever the focus is (not only when the drawing has it)
  if(e.key==='F1'){e.preventDefault();toggleHelp();return;}
  const ae=document.activeElement;
  if(ae===vcbEl){
    if(e.key==='Enter'){e.preventDefault();applyVcb();}
    else if(e.key==='Escape'){vcbEl.value='';vcbEl.blur();}
    return;
  }
  if(ae&&(ae.tagName==='SELECT'||ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.isContentEditable))return;
  const k=e.key,ctrl=e.ctrlKey||e.metaKey;
  if(ctrl){
    const l=k.toLowerCase();
    if(l==='k'){e.preventDefault();if(window.openCommandPalette)window.openCommandPalette();return;}
    else if(l==='z'&&!e.shiftKey){e.preventDefault();undo();}
    else if(l==='y'||(l==='z'&&e.shiftKey)){e.preventDefault();redo();}
    else if(l==='s'){e.preventDefault();saveFile(e.shiftKey);}
    else if(l==='o'){e.preventDefault();openFile();}
    else if(l==='n'){e.preventDefault();newFile();}
    else if(l==='a'){e.preventDefault();selectAll();}
    else if(l==='t'){e.preventDefault();selection.clear();selChanged();}// Select None, as in SketchUp
    else if(l==='c'){e.preventDefault();copySel(false);}
    else if(l==='x'){e.preventDefault();copySel(true);}
    else if(l==='v'){e.preventDefault();pasteClip();}
    if(k==='Control')refresh();
    return;
  }
  if(/^[0-9.\-'"\/]$/.test(k)&&tool.vcb){vcbEl.value='';vcbEl.focus();return;}
  if(k==='?'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(window.openCommandPalette)window.openCommandPalette();return;}
  if(k==='0'||k==='Home'){e.preventDefault();setView('iso');requestDraw();flash('View: Isometric 3D (0)');return;}
  if(k==='1'){e.preventDefault();setView('top');requestDraw();flash('View: Top (1)');return;}
  if(k==='2'){e.preventDefault();setView('front');requestDraw();flash('View: Front (2)');return;}
  if(k==='3'){e.preventDefault();setView('right');requestDraw();flash('View: Right (3)');return;}
  if(k==='Escape'){
    if(window.closeCommandPalette)window.closeCommandPalette();
    let closedPanel=false;
    for(const id of ['help','checkPanel','shapes','bedPanel','textPanel','holePanel','standoffPanel','boardPanel','cutPanel','lidPanel','palette']){
      const el=$cad(id);
      if(el&&el.style.display==='block'){el.style.display='none';closedPanel=true;}
    }
    if(!closedPanel)cancelOp();
    return;
  }
  if(k==='Delete'||k==='Backspace'){e.preventDefault();deleteSelection();return;}
  if(k==='F1'){e.preventDefault();toggleHelp();return;}
  const arrows={ArrowRight:'x',ArrowLeft:'y',ArrowUp:'z'};
  if(arrows[k]||k==='ArrowDown'){e.preventDefault();lockAxis=k==='ArrowDown'||lockAxis===arrows[k]?null:arrows[k];refresh();return;}
  if(k.toLowerCase()==='z'&&e.shiftKey){zoomExtents();return;}
  // Single keys Chrome doesn't use: G group, Shift+G ungroup, Shift+H hide, Shift+U unhide all.
  if(k.toLowerCase()==='g'){e.preventDefault();if(e.shiftKey)ungroupSelected();else groupSelected();return;}
  if(k==='u'){e.preventDefault();joinSelected();return;}
  if(k==='s'){e.preventDefault();subtractSelected();return;}
  if(k.toLowerCase()==='h'&&e.shiftKey){e.preventDefault();hideSelected();return;}
  if(k.toLowerCase()==='u'&&e.shiftKey){e.preventDefault();unhideAll();return;}
  if(k.toLowerCase()==='e'&&e.shiftKey){e.preventDefault();deleteGuides();return;}
  const map={' ':'select',l:'line',r:'rect',c:'circle',p:'push',m:'move',q:'rotate',j:'round',a:'arc',n:'polygon',d:'solid',f:'offset',w:'follow',x:'slice',e:'erase',b:'paint',t:'tape',k:'center',o:'orbit',h:'pan',z:'zoom'};
  const tn=map[k.toLowerCase()];
  if(tn){e.preventDefault();setTool(tn);}
});
document.addEventListener('keyup',e=>{if(e.key==='Control')refresh();});
