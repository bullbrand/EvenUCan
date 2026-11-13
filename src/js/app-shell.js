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
  subtract:'<path d="M3 5h13v13H3z"/><circle cx="16" cy="18" r="5" stroke-dasharray="1.8 1.5"/><path d="M11 18a5 5 0 0 1 5-5"/>',
  intersect:'<rect x="3" y="3" width="12" height="12" stroke-dasharray="1.8 1.5"/><rect x="9" y="9" width="12" height="12" stroke-dasharray="1.8 1.5"/><rect x="9" y="9" width="6" height="6" style="fill:var(--ic);stroke:none;opacity:.55"/>',
  hide:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/>',
  unhide:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check:'<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  enclosure:'<path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9"/><path d="M5.5 12.5l4 1.8v3.4l-4-1.8z"/>',
  standoff:'<path d="M2 21h20"/><path d="M7 21V9h10v12"/><ellipse cx="12" cy="9" rx="5" ry="1.6"/><path d="M10.4 9V4h3.2v5" stroke-dasharray="1.6 1.2"/>',
  boardmount:'<path d="M2 21h20"/><rect x="3" y="9" width="18" height="3" rx=".5"/><path d="M5.5 12v9M18.5 12v9"/><rect x="8" y="5" width="6" height="4"/><path d="M16 7h3"/>',
  makelid:'<path d="M3 8l9-4 9 4v3l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v3"/>',
  parts:'<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>',
  clear:'<path d="M9 3h6v2H8.5L7 7h10l-1.5-2H15V3zM5 8h14l-1.5 13h-11zM10 11v7M14 11v7"/>'
};
const TOOLS=[['select','Select','Space'],null,['line','Line','L'],['rect','Rectangle','R'],['circle','Circle','C'],['arc','Arc','A'],['polygon','Polygon','N'],['solid','3D Shapes','D'],null,['push','Push/Pull','P'],['move','Move / Copy','M'],['rotate','Rotate','Q'],['round','Round / Chamfer edge','J'],['offset','Offset','F'],['follow','Follow Me','W'],['slice','Slice','X'],null,['erase','Eraser','E'],['paint','Paint Bucket','B'],null,['tape','Tape Measure','T'],['center','Find Centre','K'],null,['orbit','Orbit','O'],['pan','Pan','H'],['zoom','Zoom','Z']];
// Icon colours by kind of tool, so the toolbar is quick to scan.
const ICON_COL=(()=>{const c={},set=(col,...ns)=>ns.forEach(n=>c[n]=col);
  set('#1c64d6','line','rect','circle','arc','polygon','solid','text');// draw
  set('#e0620d','push','move','rotate','flip','flat','round','offset','follow','slice','shell','hole');// change shapes
  set('#d6336c','erase');set('#8e44ad','paint');
  set('#0b9480','tape','center','guides');// measure
  set('#4c5fd5','orbit','pan','zoom','extents');// view
  set('#444','select','undo','redo','copy','cut','paste');
  set('#2b8a3e','group','ungroup','join','subtract','intersect','check');set('#d48806','hide','unhide');
  set('#7048e8','enclosure','parts','standoff','boardmount','makelid');
  return c;})();
const TOOL_DESC={select:'click or drag a box to pick things; double-click picks a whole object',
  line:'draw straight lines; join back to the start to make a face',rect:'draw a rectangle on the ground or on a face',
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
const tb=$('toolbar');
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
mkBtn('standoff','Stand-off: a round post with the right hole for a heat-set insert (M2 to M5). Pick the size, then click the box floor',()=>setTool('standoff'),'standoff');
mkBtn('boardmount','Board mount: pick your board (ESP32, Arduino, Raspberry Pi...) and click the box floor: the right stand-offs or cradle are made for it',()=>setTool('boardmount'),'boardmount');
mkBtn('makelid','Make lid: add a lid for a box already on the canvas — click any face of the box',()=>setTool('makelid'),'makelid');
mkBtn('shell','Shell: hollow a solid out with walls of a set thickness; click the face to leave open (type a thickness first)',()=>setTool('shell'),'shell');
mkBtn('flat','Lay flat: click a face, and its object turns over to lie flat on the bed on that face',()=>setTool('flat'),'flat');
mkBtn('layall','Lay all flat: every separate piece turns over onto its own largest face, ready to print - handy after Generate makes several pieces at once',()=>layAllFlat());
mkBtn('arrange','Arrange on bed: spreads every separate piece out sideways so none overlap, without changing how high up each one sits',()=>arrangeOnBed());
for(const [ic,title,fn] of [['guides','Delete guides (Shift+E): remove all guide points left by the Tape Measure and Find Centre',()=>deleteGuides()],[''],['group','Group (G): keep the selection together, so it selects and moves as one piece',()=>groupSelected()],['ungroup','Ungroup (Shift+G): back to loose shapes',()=>ungroupSelected()],['join','Join (U): merge two or more objects into one solid; where they overlap or touch, the inside walls go',()=>joinSelected()],['subtract','Subtract (S): cut shapes out of an object. Click the object to keep, Shift+click the shapes to cut out of it, then Subtract',()=>subtractSelected()],['intersect','Intersect: keep only the part where the selected objects overlap',()=>intersectSelected()],['hide','Hide (Shift+H): hide the selected faces',()=>hideSelected()],['unhide','Unhide all (Shift+U): show all hidden faces again',()=>unhideAll()],['check','Check Model: is it ready to print? Problems are marked on the model',()=>openCheck()],[''],['enclosure','Enclosure Wizard: design a box around your electronics',()=>window.WFEnclosure&&WFEnclosure.openWizard()],['parts','Parts Library: your electronic parts (add new ones from a photo)',()=>window.WFEnclosure&&WFEnclosure.openLibrary()]])if(ic)mkBtn(ic,title,fn);
mkBtn('clear','Clear build plate: discard everything and start a new project',()=>{if(confirm('Start a new project?\nThis will clear the build plate and all project data.')){docDirty=false;newProject();}});
// The toolbar is made of groups. Drag a button to move it (the others slide aside and it snaps into place), or drag
// a group by its grip. The order is remembered; right-click the toolbar to go back to the original order.
const TB_DEFAULT=[['undo','redo'],['select'],['line','rect','circle','arc','polygon','solid','text'],['push','move','rotate','flip','offset','follow','round'],['erase','paint'],['tape','center'],['orbit','pan','zoom','extents'],['enclosure','parts','clear']];
// (1.9.34) The rest (Copy/Paste, Group, Join, Subtract, Hide, Check, Lay flat, Arrange...) live in the menus; their buttons still
// exist in TB_BTN, so the menus click them. A new storage key so an old, longer saved order doesn't bring the clutter back.
const TB_KEYS=new Set(TB_DEFAULT.flat());
function tbOrder(){
  let L=null;try{L=JSON.parse(store.get('toolbar2'));}catch(e){/* intentional: default toolbar */}
  if(!Array.isArray(L))return TB_DEFAULT.map(g=>g.slice());
  const seen=new Set();L=L.map(g=>(Array.isArray(g)?g:[]).filter(k=>TB_BTN[k]&&TB_KEYS.has(k)&&!seen.has(k)&&seen.add(k)));
  for(const k of TB_KEYS)if(!seen.has(k)){// a button added in a newer version: into the group of its usual neighbours
    const dg=TB_DEFAULT.find(g=>g.includes(k)),home=dg&&L.find(g=>g.some(x=>dg.includes(x)));
    if(home)home.push(k);else L.push([k]);
  }
  return L.filter(g=>g.length);
}
function tbRender(){
  tb.innerHTML='';
  for(const g of tbOrder()){
    const d=document.createElement('div');d.className='tbg';
    const grip=document.createElement('span');grip.className='grip';grip.title='Drag this group of buttons to a new place (right-click the toolbar to reset the order)';d.appendChild(grip);
    for(const k of g)d.appendChild(TB_BTN[k]);
    tb.appendChild(d);
  }
  if(typeof toolName!=='undefined')document.querySelectorAll('#toolbar button[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===toolName));
}
tbRender();// (1.9.38) replaced straight away by the grouped toolbar built with the menus (see buildRibbon)

// ---- Copy, Cut and Paste. A paste goes beside the original (or back in place after a Cut) and is selected, ready to Move.
let clip=null,pasteN=0;
function copySel(cut){
  const ids=expandGroups(new Set(selection)),F=model.faces.filter(f=>ids.has(f.id)&&!f.hidden),E=model.edges.filter(e=>ids.has(e.id));
  if(!F.length&&!E.length)return flash('Select something to '+(cut?'cut':'copy')+' first');
  clip={F:clone(F),E:clone(E),b:bounds(ids),cut};pasteN=0;
  if(cut){pushUndo(null,'Cut');model.faces=model.faces.filter(f=>!ids.has(f.id));model.edges=model.edges.filter(e=>!ids.has(e.id));selection.clear();commitChange();flash('Cut. Ctrl+V pastes it back');}
  else flash('Copied. Ctrl+V pastes a copy beside it');
}
function pasteClip(){
  if(!clip)return flash('Nothing copied yet: select something and press Ctrl+C');
  const step=(clip.b?clip.b.size[0]:0.01)+0.005,dx=step*(clip.cut?pasteN:pasteN+1);pasteN++;
  pushUndo(null,'Paste');
  const before=new Set([...model.faces,...model.edges].map(x=>x.id));
  copyEntities(clip.F,clip.E,new Set([...clip.F,...clip.E].map(x=>x.id)),p=>[p[0]+dx,p[1],p[2]]);
  selection=new Set([...model.faces,...model.edges].map(x=>x.id).filter(id=>!before.has(id)));
  selChanged();commitChange();
  flash(dx?'Pasted '+fmt(dx)+' to the right of the original: press M to move it where you want':'Pasted back in place');
}

// ---------------------------------------------------------------- mouse
let nav=null,lastM={x:0,y:0},lastE=null;
const mpos=e=>{const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
cv.addEventListener('contextmenu',e=>e.preventDefault());
// Right-click context menu (Cut/Copy/Paste) for text inputs and textareas anywhere in the app.
// Browsers suppress the native context menu in some sandboxed / PWA contexts, so we build our own.
(()=>{
  const menu=document.createElement('div');
  menu.id='ctxMenu';
  menu.style.cssText='position:fixed;z-index:99999;background:var(--panel,#fff);border:1px solid var(--border,#ccc);border-radius:6px;box-shadow:0 3px 12px rgba(0,0,0,.18);padding:4px 0;min-width:140px;display:none;font-size:13px';
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
function pivotAt(m){
  const ray=screenRay(m.x,m.y),h=pickFace(ray);if(h)return h.p;
  const g=rayPlane(ray,[0,0,0],Z);
  return g&&dist(g,getCB().eye)<cam.dist*10?g:cam.target;
}
// Spin the camera around point P: dx turns around the vertical, dy tilts up/down.
function orbitAround(P,dx,dy){
  let eye=getCB().eye,tgt=cam.target;
  const a=-dx*0.008,rz=p=>rotateAbout(p,P,Z,a);
  eye=rz(eye);tgt=rz(tgt);
  let dir=sub(eye,tgt);const pitch=Math.asin(clamp(dir[2]/len(dir),-1,1)),b=clamp(pitch+dy*0.008,-LIM,LIM)-pitch;
  const yaw=Math.atan2(dir[1],dir[0]),r=[-Math.sin(yaw),Math.cos(yaw),0];
  eye=rotateAbout(eye,P,r,-b);tgt=rotateAbout(tgt,P,r,-b);
  dir=sub(eye,tgt);const d=len(dir);
  cam.target=tgt;cam.dist=d;cam.yaw=Math.atan2(dir[1],dir[0]);cam.pitch=clamp(Math.asin(clamp(dir[2]/d,-1,1)),-LIM,LIM);
}
const restCursor=()=>{cv.style.cursor=tool.nav?(tool.nav==='zoom'?'ns-resize':'grab'):(toolName==='select'?'default':'crosshair');};
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);const m=mpos(e);lastM=m;
  if(document.activeElement===vcbEl)vcbEl.blur();
  if(e.button===1||e.button===2||(e.button===0&&tool.nav)){
    const mode=e.button===0?tool.nav:e.button===1||e.shiftKey?'pan':'orbit';
    nav={mode,x:m.x,y:m.y,pivot:mode==='orbit'?pivotAt(m):null,button:e.button,travel:0};
    if(mode!=='zoom')cv.style.cursor='grabbing';e.preventDefault();return;
  }
  if(e.button!==0||!tool.down)return;
  if(toolName==='select'){tool.down(e,m);requestDraw();return;}
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
function openCtx(m,e){
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
}
document.addEventListener('pointerdown',e=>{if(ctxEl.style.display==='block'&&!ctxEl.contains(e.target))closeCtx();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCtx();},true);
cv.addEventListener('wheel',closeCtx,{passive:true});
window.addEventListener('blur',closeCtx);
cv.addEventListener('wheel',e=>{e.preventDefault();const m=mpos(e);zoomAt(m.x,m.y,e.deltaY>0?1.15:1/1.15);if(tool.move&&lastE)tool.move(lastE,m);},{passive:false});
cv.addEventListener('pointerleave',()=>{if(!nav){setMarker(null);}});
const refresh=()=>{if(tool.move&&lastE){tool.move(lastE,lastM);requestDraw();}};

// ---------------------------------------------------------------- keyboard
function applyVcb(){const t=vcbEl.value.trim();vcbEl.value='';vcbEl.blur();if(t&&tool.vcb)tool.vcb(t);requestDraw();}
document.addEventListener('keydown',e=>{
  const ae=document.activeElement;
  if(ae===vcbEl){
    if(e.key==='Enter'){e.preventDefault();applyVcb();}
    else if(e.key==='Escape'){vcbEl.value='';vcbEl.blur();}
    return;
  }
  if(ae&&(ae.tagName==='SELECT'||ae.tagName==='INPUT'))return;
  const k=e.key,ctrl=e.ctrlKey||e.metaKey;
  if(ctrl){
    const l=k.toLowerCase();
    if(l==='z'&&!e.shiftKey){e.preventDefault();undo();}
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
  if(k==='Escape'){cancelOp();return;}
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

// ---------------------------------------------------------------- files
function downloadBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);}
const download=(name,text,type)=>downloadBlob(name,new Blob([text],{type}));
// Save writes a normal .3mf that slicers (Cura, PrusaSlicer, Bambu…) open directly. A copy of the
// editable drawing rides along inside it (Metadata/opensketch.json), so reopening it here loses nothing.
const SAVE_TYPES=[{description:'3MF – opens in Cura and other slicers',accept:{'model/3mf':['.3mf']}}];
const OPEN_TYPES=[{description:'3D models (3MF, STL, EvenUCan)',accept:{'model/3mf':['.3mf'],'model/stl':['.stl'],'application/json':['.osk','.json']}}];
const EMBED='Metadata/opensketch.json';
const baseName=n=>(n||'Untitled').replace(/\.(3mf|stl|osk|json)$/i,'');
async function saveFile(as){
  if(tool.cancel)tool.cancel();
  flushAutosave();// (Perf-r1)
  if(!sizeOK())return;
  // version 2 (r1): the electronics (Enclosure Wizard, ESPHome answers, own parts the wizard uses) ride along too
  const data=JSON.stringify({app:'EvenUCan',version:2,units,camera:cam,faces:model.faces,edges:model.edges,guides:model.guides,electronics:elecState(true)});
  const m=buildMesh(true),blob=make3MF(m,data);
  const done=name=>{setDirty(false);flash('Saved '+name+(m.open?' · The model has gaps: they are marked in red, see the Print check panel.':''),m.open?8000:3500);showProblemsIfAny();};
  const _sugName=(docName!=='Untitled'?docName:((intentNow()||{}).analysis||{}).name||docName);
  if(window.showSaveFilePicker){
    try{
      if(!fileHandle||as||!/\.3mf$/i.test(fileHandle.name))fileHandle=await window.showSaveFilePicker({suggestedName:_sugName+'.3mf',types:SAVE_TYPES});
      const w=await fileHandle.createWritable();await w.write(blob);await w.close();
      docName=baseName(fileHandle.name);setDirty(false);return done(fileHandle.name);
    }catch(err){if(err.name==='AbortError')return;console.warn(err);}
  }
  downloadBlob(_sugName+'.3mf',blob);done(_sugName+'.3mf (in your Downloads folder)');
}
function loadData(d,name){
  if(!d||!Array.isArray(d.faces))return flash('That is not a EvenUCan file');
  if(tool.cancel)tool.cancel();
  model={faces:d.faces,edges:d.edges||[],guides:d.guides||[]};fixIds();lastShape=null;clearHistory();selection.clear();
  if(d.camera){Object.assign(cam,d.camera);syncPersp();}
  if(d.units&&UNITS[d.units]){units=d.units;$('units').value=units;buildGrid();}
  docName=baseName(name);
  // version 1 files (and .osk/.json drawings) are geometry only: the current electronics stay as they are.
  // Version 2 files also bring their Enclosure Wizard / ESPHome settings and the parts they use.
  if((+d.version||1)>=2&&d.electronics){
    if(restoreElec(d.electronics))flash('Opened '+baseName(name)+' with its Enclosure Wizard and ESPHome settings',4000);
    else flash('⚠ The drawing opened, but its Enclosure Wizard settings could not all be loaded (the browser\'s storage may be full).',9000);
  }
  commitChange();setDirty(false);camDirty();
  return true;
}
// Read a ZIP (3MF) – handles stored and deflated entries, so files saved by other programs open too.
async function readZip(buf){
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
}
// Triangles (metres) from a 3MF package, following components and build transforms.
function trianglesFrom3MF(files){
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
}
function trianglesFromSTL(buf){
  const dv=new DataView(buf),tris=[],s=0.001;
  if(buf.byteLength>=84&&84+50*dv.getUint32(80,true)===buf.byteLength){
    const n=dv.getUint32(80,true);
    for(let i=0;i<n;i++){const o=84+i*50+12,t=[];for(let k=0;k<3;k++)t.push([0,1,2].map(j=>dv.getFloat32(o+k*12+j*4,true)*s));tris.push(t);}
  }else{
    const v=[...new TextDecoder().decode(buf).matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map(m=>[+m[1]*s,+m[2]*s,+m[3]*s]);
    for(let i=0;i+2<v.length;i+=3)tris.push([v[i],v[i+1],v[i+2]]);
  }
  return tris;
}
// Turn a triangle mesh back into editable faces: neighbouring triangles in the same plane are merged into one face.
function facesFromTriangles(tris){
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
}
// True when a face triangulates properly: the right number of triangles, all facing the face's way,
// none overlapping (no edge used twice in the same direction). Otherwise keep the original triangles.
function cleanTriangulation(f){
  let T;try{T=triangulate(f);}catch(e){return false;}
  if(T.tris.length/3!==T.V.length+2*f.holes.length-2)return false;
  const n=faceNormal(f),seen=new Set();
  for(let i=0;i<T.tris.length;i+=3){
    const a=T.tris[i],b=T.tris[i+1],c=T.tris[i+2];
    if(dot(cross(sub(T.V[b],T.V[a]),sub(T.V[c],T.V[a])),n)<=0)return false;
    for(const k of [a+'>'+b,b+'>'+c,c+'>'+a]){if(seen.has(k))return false;seen.add(k);}
  }
  return true;
}
function loadMesh(tris,name){
  if(!tris.length)return flash('No 3D model found in that file');
  if(tool.cancel)tool.cancel();
  model={faces:[],edges:[],guides:[]};lastShape=null;
  model.faces=facesFromTriangles(tris);fixIds();
  clearHistory();selection.clear();docName=baseName(name);
  commitChange();setDirty(false);zoomExtents();
  flash('Opened '+name+' · '+model.faces.length+' faces',3500);
}
async function openBuffer(buf,name){
  try{
    if(/\.3mf$/i.test(name)){
      const files=await readZip(buf);
      if(files[EMBED]){loadData(JSON.parse(new TextDecoder().decode(files[EMBED])),name);return true;}
      loadMesh(trianglesFrom3MF(files),name);return false;
    }
    if(/\.stl$/i.test(name)){loadMesh(trianglesFromSTL(buf),name);return false;}
    loadData(JSON.parse(new TextDecoder().decode(buf)),name);return false;
  }catch(err){console.error('EvenUCan: could not open '+name,err);flash('Could not open '+name+(err&&err.message?' ('+err.message+')':''),6000);return false;}
}
async function openFile(){
  if(docDirty&&!confirm('Discard unsaved changes to "'+docName+'"?'))return;
  if(window.showOpenFilePicker){
    try{
      const [h]=await window.showOpenFilePicker({types:OPEN_TYPES});const f=await h.getFile();
      // Only keep writing back to files we made; anything else gets "Save As" so it isn't overwritten.
      fileHandle=(await openBuffer(await f.arrayBuffer(),h.name))?h:null;return;
    }catch(err){if(err.name==='AbortError')return;console.warn('EvenUCan: file picker failed, using the plain file chooser',err);}
  }
  $('fileInput').click();
}
$('fileInput').addEventListener('change',async e=>{const f=e.target.files[0];if(f){await openBuffer(await f.arrayBuffer(),f.name);fileHandle=null;}e.target.value='';});
function newFile(){
  if(docDirty&&!confirm('Discard unsaved changes to "'+docName+'"?'))return;
  if(tool.cancel)tool.cancel();
  model={faces:[],edges:[],guides:[]};lastShape=null;clearHistory();selection.clear();fileHandle=null;docName='Untitled';setGhosts([]);
  // Clear all electronics/wizard state so reopening gives a clean workspace
  Object.values(ELEC_KEYS).forEach(k=>{try{localStorage.removeItem('opensketch.'+k);}catch(e){}});
  try{Object.keys(localStorage).filter(k=>/^opensketch\.intent_inputs\./.test(k)).forEach(k=>localStorage.removeItem(k));}catch(e){}
  commitChange();setDirty(false);setView('iso');homeCam();camDirty();setWorkPlane('ground');cubeIntro(true);
  if(window.WFEnclosure&&window.WFEnclosure.openWelcome)window.WFEnclosure.openWelcome(true);// (r4) unless the user turned it off
}
// (startup-r1) Start a brand-new project: same cleanup as newFile but always opens the Welcome wizard,
// even if the user previously ticked "Don't show this again".
// Exposed on window so the WFEnclosure IIFE's startup dialog can call it.
window.newProject=function newProject(){
  if(docDirty&&!confirm('Discard unsaved changes to "'+docName+'"?'))return;
  if(tool.cancel)tool.cancel();
  model={faces:[],edges:[],guides:[]};lastShape=null;clearHistory();selection.clear();fileHandle=null;docName='Untitled';setGhosts([]);
  Object.values(ELEC_KEYS).forEach(k=>{try{localStorage.removeItem('opensketch.'+k);}catch(e){}});
  try{Object.keys(localStorage).filter(k=>/^opensketch\.intent_inputs\./.test(k)).forEach(k=>localStorage.removeItem(k));}catch(e){}
  commitChange();setDirty(false);setView('iso');homeCam();camDirty();setWorkPlane('ground');cubeIntro(true);
  // Force the Welcome wizard open regardless of the "don't show" preference
  if(window.WFEnclosure&&window.WFEnclosure.openWelcome)window.WFEnclosure.openWelcome(false);
}
function exportOBJ(){
  flushAutosave();// (Perf-r1)
  let s='# EvenUCan OBJ export - units: metres, Y up\n',vi=1;
  model.faces.forEach((f,k)=>{
    const t=triangulate(f);s+='g face'+k+'\n';
    for(const p of t.V)s+=`v ${p[0]} ${p[2]} ${-p[1]}\n`;
    for(let i=0;i<t.tris.length;i+=3)s+=`f ${vi+t.tris[i]} ${vi+t.tris[i+1]} ${vi+t.tris[i+2]}\n`;
    vi+=t.V.length;
  });
  download(docName+'.obj',s,'text/plain');
}
// ---- 3D-print export: one welded triangle mesh, in millimetres
const exportFaces=()=>{const sel=model.faces.filter(f=>selection.has(f.id));return sel.length?sel:model.faces;};
function buildMesh(all,only){// only: mesh just these faces
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
}
// ---- Print check: finds gaps (open edges) and inside-out faces, and shows them on the model.
// Inside-out faces: walk across shared edges making every neighbour agree in direction, then use each
// piece's enclosed volume to tell which way is "outside".
function analyseModel(){
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
}
// The separate pieces of the model: each group, and each set of connected loose faces.
function pieceList(){
  const out=[],seen=new Set();
  for(const f of model.faces){if(seen.has(f.id))continue;const ids=componentOf(f.id);for(const id of ids)seen.add(id);out.push(ids);}
  return out;
}
// Pieces that would print in mid-air: not resting on the bed (the model's lowest level) and not standing on
// another piece that is. A printer can't start a part on nothing.
function floatingPieces(){
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
}
// Drop the floating pieces straight down until they rest on what's below them (or the bed).
function dropFloating(){
  const fl=check&&check.floating;if(!fl||!fl.length)return;
  pushUndo(null,'Move down to rest');
  for(const p of floatingPieces()){const dz=-p.gap;xformIds(p.ids,q=>[q[0],q[1],q[2]+dz]);}
  commitChange();flash('Floating pieces moved down onto what is below them');
}
let check=null;// latest analysis while the Check panel is open
function runCheck(){check=analyseModel();renderCheck();requestDraw();}
function openCheck(){$('checkPanel').style.display='block';runCheck();}
function closeCheck(){clearTimeout(_checkTimer);_checkTimer=null;check=null;$('checkPanel').style.display='none';requestDraw();}
function renderCheck(){
  const c=check,p=$('checkPanel'),gaps=c.openSegs.length,wrong=c.wrongFaces.size,loose=c.loose,s=n=>n===1?'':'s';
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
}
// Fill every flat hole whose rim can be traced (same as tracing it with the Line tool).
function fillHoles(){
  pushUndo(null,'Fill holes');let filled=0;
  for(let guard=0;guard<500;guard++){
    let did=false;
    for(const [a,b] of openEdges())if(closeLoop(a,b,null)){filled++;did=true;break;}
    if(!did)break;
  }
  if(!filled){dropUndo();return flash("These gaps couldn't be filled automatically because their outline isn't flat. Trace them closed with the Line tool.",6000);}
  commitChange();flash('Filled '+filled+' hole'+(filled===1?'':'s'));
}
function fixDirections(){
  if(!check||!check.wrongFaces.size)return;
  pushUndo(null,'Fix directions');
  for(const f of model.faces)if(check.wrongFaces.has(f.id)){f.pts.reverse();f.holes.forEach(h=>h.reverse());delete f._tc;}
  commitChange();flash('Turned '+check.wrongFaces.size+' face'+(check.wrongFaces.size===1?'':'s')+' the right way out');
}
function deleteLoose(){if(!model.edges.length)return;pushUndo(null,'Delete loose lines');model.edges=[];selection.clear();commitChange();flash('Loose lines deleted');}
function zoomToProblems(){
  if(!check)return;
  const pts=[];for(const [a,b] of check.openSegs)pts.push(a,b);
  for(const f of model.faces)if(check.wrongFaces.has(f.id))pts.push(...f.pts);
  if(!pts.length)return;
  const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const p of pts)for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}
  cam.target=mul(add(mn,mx),0.5);
  const r=Math.max(dist(mn,mx)/2,0.003),C=getCB();
  cam.dist=r/Math.sin(Math.min(cam.fov/2,Math.atan(C.th*C.asp)))*1.4;camDirty();
}
$('checkPanel').addEventListener('click',e=>{
  const a=e.target.dataset&&e.target.dataset.a;if(!a)return;
  ({fill:fillHoles,flip:fixDirections,loose:deleteLoose,zoom:zoomToProblems,recheck:runCheck,close:closeCheck,drop:dropFloating,
    showfl:()=>{const ids=new Set();for(const p of check.floating)for(const id of p.ids)ids.add(id);selection=ids;selChanged();zoomExtents(ids);}})[a]();
});
function printReport(m,fmtName){
  let msg=fmtName+' saved: '+m.tris.length+' triangles'+(m.partial?' (selection only)':'');
  if(m.open)msg+=' · The model has gaps: they are marked in red, see the Print check panel.';
  flash(msg,m.open?8000:3500);
  showProblemsIfAny();
}
// After a save/export, open the Print check panel (with problems marked on the model) if anything needs fixing.
function showProblemsIfAny(){const a=analyseModel();if(a.openSegs.length||a.wrongFaces.size||a.floating.length)openCheck();}
function exportSTL(){
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
  downloadBlob(docName+'.stl',new Blob([buf],{type:'model/stl'}));printReport(m,'STL');
}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
// Minimal uncompressed ZIP writer (3MF files are ZIP packages).
function makeZip(files){
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
}
function export3MF(){
  flushAutosave();// (Perf-r1)
  const m=buildMesh();if(!m.tris.length)return flash('Nothing to export');
  if(!sizeOK())return;
  downloadBlob(docName+'.3mf',make3MF(m));printReport(m,'3MF');
}
function make3MF(m,embed){
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
    res+=`<object id="${id}" name="Part ${id}" type="model"><mesh><vertices>`+vs.map(p=>`<vertex x="${mm(p[0])}" y="${mm(p[1])}" z="${mm(p[2])}"/>`).join('')+`</vertices><triangles>${tx}</triangles></mesh></object>`;
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
}
function exportPNG(){
  flushAutosave();// (Perf-r1)
  const h=hoverIdx;hoverIdx=-10;const pl=preview.lines;preview.lines=[];draw();
  cv.toBlob(b=>{downloadBlob(docName+'.png',b);hoverIdx=h;preview.lines=pl;requestDraw();});
}

// ---------------------------------------------------------------- help
function toggleHelp(){
  const h=$('help');
  if(h.style.display==='block'){h.style.display='none';return;}
  h.innerHTML=`<h3>EvenUCan – quick guide</h3>
<p><b>EvenUCan</b>${appVersion?' version '+appVersion:''}: from idea to object.<br>Created by David John Waugh. © 2026 David John Waugh. Free software under the GNU General Public License v3 (or later), with no warranty.</p>
<p>Everything runs inside this one file. The drawing, box design, wiring and ESPHome code all work offline. Only the AI helper needs the internet: the wizard's <b>I have an idea for a gadget</b> (your idea into a parts list), <b>Write the code with AI</b> for Arduino sketches, <b>Make it with AI</b> and the <b>Fill in automatically</b> look-up in the Parts Library. It uses a free key from Google Gemini, NVIDIA (desktop app only), Groq or OpenRouter, or your own paid Claude key (set it up in <b>Tools → AI helper key</b>). Groq, OpenRouter and NVIDIA can't search the web or read PDFs, so <b>Look up online</b> uses what they already know. OpenRouter's free tier allows about 50 requests a day, and some of its free models may keep what you send. No key? Choose <b>Carry on without AI</b> in the wizard: start from an example project or tick the parts you have, and the <b>Code</b> tab makes a starter sketch with your pins filled in.</p>
<table>
<tr><td><kbd>R</kbd> Rectangle</td><td>Click two corners on the ground or on any face. Type <b>3, 4</b> + Enter for exact sizes.</td></tr>
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
<tr><td>Parts Library</td><td>Click <b>Tools → Parts library</b> (or the chip button) to see the built-in parts and add your own. Type the sizes, or load a <b>top photo</b> and click the board's 4 corners: the photo is straightened to scale. Then add features by clicking or dragging on it: ports and antennas on an edge; mic holes, speaker cones, mounting holes, buttons, LEDs, pin rows, hot areas and display windows on the face. A <b>side photo</b> measures the heights (click both ends of the board, its top, the tallest part and the pin tips). Export/Import shares your parts as a file.<br><b>Fill in automatically</b> (optional, the only feature that uses the internet): <b>Look up online</b>: type the part number and Google's free Gemini AI searches the web, reads the datasheet and fills in a draft (sizes, holes, sockets, pins) with links to its sources. <b>Read a drawing</b> does the same from a dimension drawing you have saved (a picture or PDF; you can also drag it onto the part picture, or press Ctrl+V). In the desktop app, <b>Look up online</b> also downloads product photos it found (click one, then click its 4 corners to line it up with the part), and reads any dimension drawing or datasheet PDF on those pages for exact hole and socket positions. Always check the draft before saving. Choose the AI in the box: <b>Google Gemini</b> (free key from Google AI Studio) or <b>Claude</b> (paid per use from an Anthropic account at console.anthropic.com). Keys are stored on this computer only.</td></tr>
<tr><td>Wiring</td><td>Click <b>Wiring</b> (or <b>Wiring…</b> in the Enclosure Wizard) to see what wire goes where for the parts in your box. It picks safe controller pins (on the ESP32-S3 it avoids the start-up, USB, serial, PSRAM and LED pins), builds the power chain (USB, or battery → charger → switch) and warns about anything risky, like 5 V signals into 3.3 V pins. You get a picture, a wiring list to tick off while soldering, and the matching ESPHome and Arduino pin settings. In the picture only the pins in use are labelled, outside the boards, and the wires are coloured by job: red for power (dashed for 5 V), black for ground, and a colour of its own for each signal (the key is at the bottom). Click a line of the wiring list, a wire or a part to see just that one with a big label such as <i>GPIO8 → SDA (SSD1306 OLED)</i>; <b>Show all</b> brings everything back. <b>One wire at a time</b> goes through the wires with <b>Next</b> and <b>Back</b> (or the arrow keys), in the same order as the list. Scroll the mouse wheel (or pinch) to zoom, drag the background to move about, <b>Fit</b> shows it all again, and drag a board to tidy the picture. <b>Save picture</b> saves the whole picture with every label. Each part needs its pins: the built-in parts have them, and in <b>Parts</b> you can add them or <b>Import pins…</b> (from the parts library that comes with EvenUCan, or a .fzpz part file).</td></tr>
<tr><td>Printer</td><td>Click <b>File → Printer size</b> to set your bed size (X, Y and height Z in mm), or pick a preset. The grid shows only on the bed, with an outline of the full build height. If a part won't fit, the size turns red and Save/Export warns you. The setting is remembered in this browser.</td></tr>
<tr><td>3D printing</td><td><b>Export 3MF</b> or <b>Export STL</b> and open the file in your slicer (PrusaSlicer, Cura, Bambu Studio, OrcaSlicer…). Sizes are always in millimetres. If something is selected, only the selection is exported. Each separate piece becomes its own part in 3MF. You'll get a warning if the model isn't fully closed (watertight).</td></tr>
<tr><td>Other</td><td>Ctrl+Z undo, Ctrl+Y redo, Delete removes the selection, Esc cancels.</td></tr>
</table><p style="color:#666">Press F1 or choose Help → Quick guide to close.</p>
<p style="color:#666;font-size:12px">Solid modelling for the Enclosure Wizard uses the Manifold geometry library (© The Manifold Authors, Apache License 2.0), built into this file. The optional Claude look-up uses the Anthropic TypeScript SDK (© Anthropic, Apache License 2.0), also built in. The parts library that comes with the desktop app, and parts brought in with Import pins… from a .fzpz file or Fritzing, are from the Fritzing parts library (© Fritzing contributors, CC BY-SA 3.0); each part keeps that credit in its notes.</p>`;
  h.style.display='block';
}

// ---------------------------------------------------------------- menu wiring
$('bNew').onclick=newFile;$('bOpen').onclick=openFile;$('bSave').onclick=()=>saveFile(false);$('bSaveAs').onclick=()=>saveFile(true);
$('bObj').onclick=exportOBJ;$('bStl').onclick=exportSTL;$('b3mf').onclick=export3MF;$('bPng').onclick=exportPNG;
$('bUndo').onclick=undo;$('bRedo').onclick=redo;$('bHelp').onclick=toggleHelp;$('bResize').onclick=resizeModel;
