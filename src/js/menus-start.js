// ---------------------------------------------------------------- menu bar (1.9.34)
// A normal desktop menu: click a heading to open it; while one is open, pointing at another heading switches to it;
// a click outside or Esc closes it; arrow keys, Enter and Space work. Items click the same buttons as before
// (now hidden in #legacyBtns or not shown on the tool row), so every handler and id still works.
{
  const mdrop=$('mdrop'),mbar=$('mbar'),tops=[...mbar.querySelectorAll('.mtop')];
  const BTN=id=>()=>$(id).click(),TBK=k=>{const f=()=>TB_BTN[k].click();f.tbKey=k;return f;},EN=n=>()=>{const W=window.WFEnclosure;if(W&&W[n])W[n]();};
  const hasSel=()=>selection.size>0;
  const tl=(k,lab)=>{const t=TOOLS.find(t=>t&&t[0]===k);return {label:lab||t[1],key:t[2]==='Space'?'Space':t[2],fn:TBK(k),checked:()=>toolName===k,ic:k};};
  const tt=(k,label)=>({label,fn:TBK(k),checked:()=>toolName===k,ic:k});
  const view=(v,label)=>({label,fn:()=>setView(v),ic:'v-'+v});
  const pick=(sel,v,label)=>({label,fn:()=>{const e=$(sel);if(e.value!==v){e.value=v;e.dispatchEvent(new Event('change'));}},checked:()=>$(sel).value===v});
  const flip=(i,c,label)=>({label,fn:()=>flipSelected(i,c),enabled:hasSel});
  const MENUS={
    File:[{label:'Start a project (step by step)...',fn:BTN('bBuild')},null,
      {label:'New Project...',fn:()=>newProject()},{label:'New',key:'Ctrl+N',fn:BTN('bNew')},{label:'Open...',key:'Ctrl+O',fn:BTN('bOpen')},
      {label:'Save',key:'Ctrl+S',fn:BTN('bSave')},{label:'Save As...',key:'Ctrl+Shift+S',fn:BTN('bSaveAs')},null,
      {head:'Export'},{label:'3MF for 3D printing...',fn:BTN('b3mf')},{label:'STL for 3D printing...',fn:BTN('bStl')},
      {label:'OBJ (other 3D programs)...',fn:BTN('bObj')},{label:'Picture of the view (PNG)...',fn:BTN('bPng')},null,
      {label:'Printer size...',fn:BTN('bPrinter')},{label:'Check model for printing',fn:BTN('bCheck'),checked:()=>!!check}],
    Edit:[{label:'Undo',key:'Ctrl+Z',fn:BTN('bUndo'),enabled:()=>undoStack.length>0},{label:'Redo',key:'Ctrl+Y',fn:BTN('bRedo'),enabled:()=>redoStack.length>0},null,
      {label:'Cut',key:'Ctrl+X',fn:TBK('cut'),enabled:hasSel},{label:'Copy',key:'Ctrl+C',fn:TBK('copy'),enabled:hasSel},{label:'Paste',key:'Ctrl+V',fn:TBK('paste'),enabled:()=>!!clip},
      {label:'Delete',key:'Delete',fn:()=>deleteSelection(),enabled:hasSel},null,
      {label:'Select all',key:'Ctrl+A',fn:()=>selectAll()},{label:'Select none',key:'Ctrl+T',fn:()=>{selection.clear();selChanged();requestDraw();},enabled:hasSel},null,
      {label:'Hide selected',key:'Shift+H',fn:BTN('bHide'),enabled:hasSel},{label:'Unhide all',key:'Shift+U',fn:BTN('bUnhide')},null,
      {label:'Delete guides',key:'Shift+E',fn:TBK('guides')}],
    Draw:[tl('select'),null,tl('line'),tl('rect'),tl('circle'),tl('arc'),tl('polygon'),tl('solid'),tt('text','3D Text'),null,
      tl('push'),tl('move'),tl('rotate'),tl('offset'),tl('follow'),tl('round'),null,tl('erase'),tl('paint'),null,tl('tape'),tl('center')],
    Modify:[tl('slice'),tt('shell','Shell (hollow out)'),tt('hole','Hole (screw holes)'),null,
      {label:'Join',key:'U',fn:TBK('join')},{label:'Subtract',key:'S',fn:TBK('subtract')},{label:'Intersect',fn:TBK('intersect')},null,
      {label:'Group',key:'G',fn:BTN('bGroup')},{label:'Ungroup',key:'Shift+G',fn:BTN('bUngroup')},null,
      {head:'Flip / Mirror'},flip(0,false,'Flip left ↔ right'),flip(1,false,'Flip front ↔ back'),flip(2,false,'Turn upside down'),
      flip(0,true,'Mirror copy to the right'),flip(1,true,'Mirror copy to the back'),flip(2,true,'Mirror copy on top'),null,
      {label:'Resize to an exact size...',fn:BTN('bResize')},tt('flat','Lay flat on a face'),{label:'Lay all flat',fn:TBK('layall')},{label:'Arrange on bed',fn:TBK('arrange')}],
    View:[view('iso','Standard 3D view'),view('top','Top'),view('front','Front'),view('right','Right'),view('back','Back'),view('left','Left'),null,
      {label:'Zoom to fit everything',key:'Shift+Z',fn:TBK('extents')},tl('orbit'),tl('pan'),tl('zoom'),null,
      pick('proj','persp','Perspective (natural)'),pick('proj','ortho','Parallel (no perspective)'),null,
      {head:'Units'},pick('units','mm','Millimetres'),pick('units','cm','Centimetres'),pick('units','m','Metres'),pick('units','in','Inches'),pick('units','ft','Feet & inches')],
    Tools:[{label:'Start a project (step by step)...',fn:BTN('bBuild')},null,
      {label:'Parts library...',fn:BTN('bParts')},{label:'Open Cookbook...',fn:()=>openCookbook()},{label:'Box designer (Enclosure)...',fn:BTN('bEnclosure')},
      tt('standoff','Stand-off for a heat-set insert'),tt('boardmount','Board mount (platform for a board)'),tt('makelid','Make lid (regenerate the lid from the last box)'),
      {label:'Wiring...',fn:BTN('bWiring')},{label:'Code for your board...',fn:EN('openCodeGated')},null,
      {label:'AI helper key...',fn:EN('askKey')},null,{label:'Check model for printing',fn:BTN('bCheck'),checked:()=>!!check}],
    Help:[{label:'Quick guide and shortcuts',key:'F1',fn:BTN('bHelp')},{label:'User manual (PDF)',fn:()=>window.open('EvenUCan User Manual.pdf','_blank')},
      {label:'EvenUCan on GitHub',fn:()=>window.open('https://github.com/bullbrand/EvenUCan','_blank')},null,
      {label:'Check for updates',fn:()=>checkForUpdatesManual()},null,{label:'About EvenUCan',fn:BTN('bAbout')}]
  };
  // (1.9.35) A small colourful icon beside each item that has a matching one.
  const MENU_IC={'Start a project (step by step)...':'wizard','New':'new','Open...':'open','Save':'save','Save As...':'saveas',
    '3MF for 3D printing...':'export','STL for 3D printing...':'export','OBJ (other 3D programs)...':'export','Picture of the view (PNG)...':'png',
    'Printer size...':'printer','Check model for printing':'check','Undo':'undo','Redo':'redo','Cut':'cut','Copy':'copy','Paste':'paste',
    'Delete':'delete','Select all':'selall','Select none':'selnone','Hide selected':'hide','Unhide all':'unhide','Delete guides':'guides',
    'Join':'join','Subtract':'subtract','Intersect':'intersect','Group':'group','Ungroup':'ungroup','Resize to an exact size...':'resize',
    'Lay all flat':'layall','Arrange on bed':'arrange','Zoom to fit everything':'extents','Perspective (natural)':'persp','Parallel (no perspective)':'ortho',
    'Parts library...':'parts','Open Cookbook...':'parts','Box designer (Enclosure)...':'enclosure','Wiring...':'wiring','Code for your board...':'code','AI helper key...':'aikey',
    'Quick guide and shortcuts':'help','User manual (PDF)':'manual','EvenUCan on GitHub':'web','About EvenUCan':'about','Check for updates':'web'};
  for(const L of Object.values(MENUS))for(const it of L)if(it&&!it.head&&!it.ic)it.ic=MENU_IC[it.label]||(/^(Flip|Turn|Mirror)/.test(it.label)?'flip':'');
  window.EvenUCanMenus=MENUS;// (for tests and add-ons)
  // (1.9.38) The grouped toolbar: every useful menu command also has a button on screen; the menus stay exactly as they are.
  // A tool's button IS the toolbar button the menu clicks; every other button runs the menu item's own function.
  // [menu, item label (or its icon key), short name, small badge]
  const RIB=[
    ['File',[['File','New','New'],['File','Open...','Open'],['File','Save','Save'],['File','Save As...','Save as'],
      ['File','3MF for 3D printing...','3MF','3MF'],['File','STL for 3D printing...','STL','STL'],['File','OBJ (other 3D programs)...','OBJ','OBJ'],
      ['File','Picture of the view (PNG)...','Picture'],['File','Printer size...','Printer'],['File','Check model for printing','Check']]],
    ['Edit',[['Edit','Undo','Undo'],['Edit','Redo','Redo'],['Edit','Cut','Cut'],['Edit','Copy','Copy'],['Edit','Paste','Paste'],['Edit','Delete','Delete'],
      ['Edit','Select all','Select all'],['Edit','Select none','Select none'],['Edit','Hide selected','Hide'],['Edit','Unhide all','Unhide'],['Edit','Delete guides','Guides']]],
    ['Draw',[['Draw','select','Select'],['Draw','line','Line'],['Draw','rect','Rectangle'],['Draw','circle','Circle'],['Draw','arc','Arc'],
      ['Draw','polygon','Polygon'],['Draw','solid','3D shapes'],['Draw','text','3D text'],['Draw','erase','Eraser'],['Draw','paint','Paint']]],
    ['Change shape',[['Draw','push','Push/Pull'],['Draw','move','Move'],['Draw','rotate','Rotate'],['Draw','offset','Offset'],['Draw','follow','Follow Me'],
      ['Draw','round','Round'],['Modify','slice','Slice'],['','flip','Flip'],['Modify','Resize to an exact size...','Resize']]],
    ['Join & hollow',[['Modify','Join','Join'],['Modify','Subtract','Subtract'],['Modify','Intersect','Intersect'],['Modify','shell','Hollow'],
      ['Modify','hole','Holes'],['Modify','Group','Group'],['Modify','Ungroup','Ungroup']]],
    ['Measure',[['Draw','tape','Tape'],['Draw','center','Centre']]],
    ['Print bed',[['Modify','flat','Lay flat'],['Modify','Lay all flat','All flat'],['Modify','Arrange on bed','Arrange']]],
    ['View',[['View','v-iso','3D'],['View','v-top','Top'],['View','v-front','Front'],['View','v-right','Right'],['View','v-back','Back'],['View','v-left','Left'],
      ['View','Zoom to fit everything','Fit all'],['View','orbit','Orbit'],['View','pan','Pan'],['View','zoom','Zoom'],
      ['View','Perspective (natural)','Natural'],['View','Parallel (no perspective)','Parallel']]],
    ['Tools',[['Tools','Start a project (step by step)...','Project'],['Tools','Parts library...','Parts'],['Tools','Open Cookbook...','Cookbook'],['Tools','Box designer (Enclosure)...','Box'],
      ['Tools','Wiring...','Wiring'],['Tools','Code for your board...','Code'],['Tools','AI helper key...','AI key']]],
    ['Box',[['Tools','standoff','Stand-off'],['Tools','boardmount','Board'],['Tools','makelid','Lid']]],
    ['Help',[['Help','Quick guide and shortcuts','Guide'],['Help','User manual (PDF)','Manual']]]
  ];
  // What each button does, for the tooltip (tools keep their own toolbar tooltip).
  const RIB_DESC={'New':'start a new, empty drawing','Open...':'open a .3mf or .stl file','Save':'save as .3mf: opens in Cura and other slicers, and stays editable here',
    'Save As...':'save under a new name','3MF for 3D printing...':'export a 3MF file for your slicer (only the selection, if something is selected)',
    'STL for 3D printing...':'export an STL file for any slicer (only the selection, if something is selected)','OBJ (other 3D programs)...':'export an OBJ file for other 3D programs',
    'Picture of the view (PNG)...':'save a picture of what you see','Printer size...':'set the size of your printer\'s bed',
    'Check model for printing':'is it ready to print? Gaps, inside-out faces, loose lines and bed size are marked on the model',
    'Undo':'take back the last change','Redo':'put back what you took back','Delete':'delete the selection','Select all':'select everything',
    'Select none':'clear the selection','Hide selected':'hide the selected faces so you can work behind or inside them','Unhide all':'show all hidden faces again',
    'Group':'keep the selection together, so it selects and moves as one piece','Ungroup':'break the selected group back into loose shapes',
    'Resize to an exact size...':'set an exact size, for example 40 mm wide','Standard 3D view':'look at the model from a corner, above',
    'Top':'look straight down from above','Front':'look from the front','Right':'look from the right','Back':'look from the back','Left':'look from the left',
    'Perspective (natural)':'far things look smaller, like real life','Parallel (no perspective)':'sizes stay equal however far away',
    'Start a project (step by step)...':'describe your gadget and EvenUCan plans the parts, the box and the code, step by step',
    'Parts library...':'your boards, sensors, speakers and batteries, with sizes','Box designer (Enclosure)...':'design a printable box around your electronics',
    'Wiring...':'what wire goes where, with a diagram and a wiring list','Code for your board...':'the code for your board, ready to open in ESPHome or the Arduino IDE',
    'AI helper key...':'add or change the key for the free AI helper','Quick guide and shortcuts':'how to use the tools, and the shortcut keys','User manual (PDF)':'open the full user manual'};
  const rEsc=t=>String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const ribFind=(m,k)=>{const L=MENUS[m]||[];return L.find(it=>it&&!it.head&&it.label===k)||L.find(it=>it&&!it.head&&it.ic===k)||null;};
  const ribBtns=[];
  let ribShut={};try{ribShut=JSON.parse(store.get('ribbonShut'))||{};}catch(e){/* intentional: every group open */}
  function buildRibbon(){
    tb.innerHTML='';tb.classList.add('ribbon');tb.classList.toggle('names',store.get('ribbonNames')==='1');ribBtns.length=0;
    for(const [name,list] of RIB){
      const g=document.createElement('div');g.className='tbg'+(ribShut[name]?' shut':'');g.setAttribute('role','group');g.setAttribute('aria-label',name);
      const h=document.createElement('button');h.type='button';h.className='tgh';h.innerHTML='<span class="ar">▾</span>'+rEsc(name);
      h.title=name+': click to fold this group away, or to open it again';h.setAttribute('aria-expanded',String(!ribShut[name]));
      h.onclick=()=>{if(ribShut[name])delete ribShut[name];else ribShut[name]=1;store.set('ribbonShut',JSON.stringify(ribShut));
        g.classList.toggle('shut',!!ribShut[name]);h.setAttribute('aria-expanded',String(!ribShut[name]));};
      const box=document.createElement('div');box.className='tgb';
      for(const [m,k,short,badge] of list){
        const it=m?ribFind(m,k):null;
        if(m&&!it){console.warn('EvenUCan toolbar: no menu item for',m,k);continue;}
        const tk=it?it.fn&&it.fn.tbKey:k;let b;
        if(tk&&TB_BTN[tk])b=TB_BTN[tk];
        else{
          b=document.createElement('button');b.type='button';b.innerHTML=icon(it.ic);
          const d=RIB_DESC[it.label];b.title=it.label.replace(/\.\.\.$/,'')+(it.key&&it.key!=='Delete'?' ('+it.key+')':'')+(d?': '+d:'');
          b.onclick=()=>{try{it.fn();}catch(er){console.error(er);}};
        }
        b.classList.add('rb');b.dataset.menu=m;b.dataset.label=it?it.label:k;b.setAttribute('aria-label',short);b._mi=it;
        if(!b.querySelector('.tl'))b.insertAdjacentHTML('beforeend',(badge?'<span class="bd">'+rEsc(badge)+'</span>':'')+'<span class="tl">'+rEsc(short)+'</span>');
        ribBtns.push(b);box.appendChild(b);
      }
      g.append(h,box);tb.appendChild(g);
    }
    const n=document.createElement('button');n.type='button';n.className='tgn';n.textContent='Names';
    n.title='Names: show or hide the name under each button';n.classList.toggle('on',tb.classList.contains('names'));
    n.onclick=()=>{const on=!tb.classList.contains('names');tb.classList.toggle('names',on);n.classList.toggle('on',on);store.set('ribbonNames',on?'1':'0');CB=null;requestDraw();};
    tb.appendChild(n);ribRefresh();
  }
  // Greyed out when the menu item would be greyed out; highlighted when the menu would show a tick (the active tool too).
  let ribPend=false;
  function ribRefresh(){
    ribPend=false;
    for(const b of ribBtns){
      const it=b._mi;if(!it)continue;let on=true,ck=false;
      try{on=it.enabled?!!it.enabled():true;ck=it.checked?!!it.checked():false;}catch(e){/* intentional: shown enabled */}
      if(b.classList.contains('off')===on){b.classList.toggle('off',!on);b.setAttribute('aria-disabled',String(!on));}
      if(it.checked&&b.classList.contains('on')!==ck)b.classList.toggle('on',ck);
    }
  }
  window.EvenUCanRibbonRefresh=()=>{if(!ribPend){ribPend=true;requestAnimationFrame(ribRefresh);}};
  // A greyed button does nothing, like its greyed menu item (checked again here, in case it has only just changed).
  tb.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('button.rb');if(!b||!b._mi||!b._mi.enabled)return;
    let on=true;try{on=!!b._mi.enabled();}catch(er){/* intentional: allowed */}
    if(!on){e.stopImmediatePropagation();e.preventDefault();flash(b._mi.enabled===hasSel?b.getAttribute('aria-label')+': select something first':b.getAttribute('aria-label')+': nothing to do yet');}
  },true);
  tb.addEventListener('mousedown',e=>{if(e.target.closest&&e.target.closest('button'))e.preventDefault();});// keeps keyboard shortcuts working after a click
  for(const ev of ['click','keyup','pointerup'])document.addEventListener(ev,()=>setTimeout(window.EvenUCanRibbonRefresh,0),true);
  buildRibbon();
  let cur=null,byKeys=false;// (focus goes back to the heading on Esc only when the menu was opened from the keyboard)
  const items=()=>[...mdrop.querySelectorAll('.it:not(.off)')];
  const esc=t=>String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  function closeMenu(focusTop){
    if(!cur)return;const t=cur;cur=null;mdrop.style.display='none';mdrop.setAttribute('aria-hidden','true');
    t.setAttribute('aria-expanded','false');if(focusTop&&byKeys)t.focus();else if(document.activeElement&&(mbar.contains(document.activeElement)||mdrop.contains(document.activeElement)))document.activeElement.blur();
  }
  function openMenu(t,focusFirst){
    if(cur&&cur!==t)cur.setAttribute('aria-expanded','false');
    cur=t;byKeys=!!focusFirst;t.setAttribute('aria-expanded','true');
    tops.forEach(b=>b.tabIndex=b===t?0:-1);
    mdrop.innerHTML='';mdrop.setAttribute('aria-label',t.dataset.menu);
    for(const it of MENUS[t.dataset.menu]){
      if(!it){const d=document.createElement('div');d.className='sep';d.setAttribute('role','separator');mdrop.appendChild(d);continue;}
      if(it.head){const d=document.createElement('div');d.className='hd';d.textContent=it.head;mdrop.appendChild(d);continue;}
      let on=true,ck=false;try{on=it.enabled?!!it.enabled():true;ck=it.checked?!!it.checked():false;}catch(e){/* intentional: shown enabled */}
      const d=document.createElement('div');d.className='it'+(on?'':' off');d.tabIndex=-1;
      d.setAttribute('role',it.checked?'menuitemcheckbox':'menuitem');if(it.checked)d.setAttribute('aria-checked',String(ck));if(!on)d.setAttribute('aria-disabled','true');
      d.innerHTML='<span class="ck">'+(ck?'✓':'')+'</span><span class="mi">'+(it.ic&&fiHas(it.ic)?icon(it.ic):'')+'</span><span class="lb">'+esc(it.label)+'</span>'+(it.key?'<kbd>'+esc(it.key)+'</kbd>':'');
      d.onclick=e=>{e.stopPropagation();if(!on)return;closeMenu(false);setTimeout(()=>{try{it.fn();}catch(er){console.error(er);}},0);};
      d.onmouseenter=()=>{if(on)d.focus({preventScroll:true});};
      mdrop.appendChild(d);
    }
    mdrop.style.display='block';mdrop.setAttribute('aria-hidden','false');
    const r=t.getBoundingClientRect(),w=mdrop.offsetWidth;
    mdrop.style.left=Math.max(4,Math.min(innerWidth-w-4,r.left))+'px';mdrop.style.top=(r.bottom+2)+'px';
    if(focusFirst){const f=items()[0];if(f)f.focus();}
  }
  for(const t of tops){
    t.addEventListener('click',e=>{e.stopPropagation();if(cur===t)closeMenu(false);else openMenu(t,e.detail===0);});
    t.addEventListener('mouseenter',()=>{if(cur&&cur!==t)openMenu(t,false);});
  }
  const step=d=>{const i=tops.indexOf(cur||document.activeElement);return tops[(i+d+tops.length)%tops.length];};
  mbar.addEventListener('keydown',e=>{
    if(cur)return;const i=tops.indexOf(document.activeElement);if(i<0)return;
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();const n=step(e.key==='ArrowRight'?1:-1);tops.forEach(b=>b.tabIndex=b===n?0:-1);n.focus();}
    else if(e.key==='ArrowDown'||e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();openMenu(tops[i],true);}
  });
  // While a menu is open, the keys belong to it (so letters don't pick drawing tools and Esc doesn't cancel the drawing).
  window.addEventListener('keydown',e=>{
    if(!cur)return;e.stopImmediatePropagation();
    const L=items(),i=L.indexOf(document.activeElement);
    if(e.key==='Escape'){e.preventDefault();closeMenu(true);}
    else if(e.key==='ArrowDown'){e.preventDefault();if(L.length)L[(i+1)%L.length].focus();}
    else if(e.key==='ArrowUp'){e.preventDefault();if(L.length)L[(i-1+L.length)%L.length].focus();}
    else if(e.key==='Home'){e.preventDefault();if(L[0])L[0].focus();}
    else if(e.key==='End'){e.preventDefault();if(L.length)L[L.length-1].focus();}
    else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const n=step(e.key==='ArrowRight'?1:-1);openMenu(n,true);n.blur();const f=items()[0];if(f)f.focus();}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(i>=0)L[i].click();}
    else if(e.key==='Tab'){e.preventDefault();closeMenu(true);}
    else e.preventDefault();
  },true);
  document.addEventListener('pointerdown',e=>{if(cur&&!mdrop.contains(e.target)&&!mbar.contains(e.target))closeMenu(false);},true);
  window.addEventListener('blur',()=>closeMenu(false));
  window.addEventListener('resize',()=>closeMenu(false));
  mdrop.addEventListener('contextmenu',e=>e.preventDefault());
}
new ResizeObserver(()=>{CB=null;requestDraw();}).observe(cv);
window.addEventListener('blur',()=>{nav=null;});
// Ask before closing with unsaved changes in a web browser. The desktop app autosaves on close
// (see main.js), so it must not block the window's X or File > Quit: Electron shows no prompt for
// beforeunload and the app would be impossible to close.
window.addEventListener('beforeunload',e=>{flushAutosave();if(docDirty&&!window.wfNative){e.preventDefault();e.returnValue='';}});
// (Perf-r1) a closed tab or one sent to the background keeps its last edits in the autosave
window.addEventListener('pagehide',flushAutosave);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushAutosave();});

// ---------------------------------------------------------------- add-on API
// The Enclosure Wizard and Parts Library (separate script below) work through this small interface.
window.WF={
  get model(){return model;},get bed(){return bed;},get docEmpty(){return !model.faces.length&&!model.edges.length;},
  nid,pushUndo,commitChange,facesFromTriangles,triangulate,flash,askText,zoomExtents,openCheck,analyseModel,setGhosts,
  ghostsShown:v=>{if(v!==undefined){ghostOn=v;requestDraw();}return ghostOn;},
  clearSelection(){selection.clear();selChanged();},
  replaceModel(faces,name){if(tool.cancel)tool.cancel();model={faces,edges:[],guides:[]};fixIds();lastShape=null;selection.clear();if(name)docName=name;fileHandle=null;},
  setTool,downloadBlob,download,store,bedText,fitsBed,readZip,pushPullMany,exportSTL,export3MF,
  setBed(x,y,z){if(x>9&&y>9&&z>9){bed={x,y,z};store.set('bed',JSON.stringify(bed));}},
  setDocName(n){if(n){docName=String(n);setDirty(docDirty);}},
  // page position of a model point (for tests and add-ons)
  toPage(p){const s=toScreen(p),r=cv.getBoundingClientRect();return s?[r.left+s[0],r.top+s[1]]:null;},
  get selection(){return selection;},select(ids){selection=new Set(ids);selChanged();},
  cubeHit(x,y){const h=cubeHit(x,y);return h&&{k:h.f.k,zs:h.zs,zt:h.zt};},get cubeHover(){return vcHover&&{k:vcHover.f.k,zs:vcHover.zs,zt:vcHover.zt};},get workPlane(){return workPlane.name;}
};

// ---------------------------------------------------------------- history
// Every change, listed down the left. Click a step to go back to just after it; the steps after it turn grey and can
// be clicked to go forward again, until a new change throws them away (like a multiple Undo). Folds away to a tab.
histEl=document.createElement('div');histEl.id='hist';
histEl.innerHTML='<div class="hHead" title="Click to fold the history away (or open it again)"><span class="hArrow">◀</span><b>History</b><span class="hCount"></span></div>'+
  '<ol class="hList"></ol><div class="hFoot">Click a step to go back to it.</div>';
$('view').appendChild(histEl);
// (looked up each time: histChanged may run before this part of the page has started)
function histOpen(on){histEl.classList.toggle('closed',!on);store.set('history',on?'open':'closed');}
histEl.querySelector('.hHead').onclick=()=>histOpen(histEl.classList.contains('closed'));
histEl.querySelector(".hList").addEventListener("click",e=>{const li=e.target.closest('li');if(li)goToStep(+li.dataset.k);});
function histChanged(){
  const histList=histEl&&histEl.querySelector(".hList");if(!histList)return;
  const done=undoNames.length,all=[...undoNames,...redoNames.slice().reverse()];
  const row=(k,label,cls,tip)=>`<li data-k="${k}" class="${cls}" title="${tip}"><span class="n">${k||''}</span>${label}</li>`;
  let h=row(0,histTrimmed?'Earlier steps':'Start',done===0?'cur':'',done===0?'This is where you are now':'Go back to the start'+(histTrimmed?' of what is kept (the oldest steps are not kept)':''));
  all.forEach((name,i)=>{const k=i+1;h+=row(k,name.replace(/[<&]/g,c=>c==='<'?'&lt;':'&amp;'),k===done?'cur':k>done?'gone':'',k===done?'This is where you are now':k>done?'Undone: click to go forward to here again (a new change throws it away)':'Go back to just after this step (the steps after it are greyed out until you make a new change)');});
  histList.innerHTML=h;
  histEl.querySelector('.hCount').textContent=all.length?all.length+(all.length===1?' step':' steps'):'';
  const cur=histList.querySelector('.cur');if(cur)cur.scrollIntoView({block:'nearest'});
}
histOpen(store.get('history')!=='closed');histChanged();

// ---------------------------------------------------------------- view cube
// A cube in the corner that turns with the view. Click a face to look straight at that side and draw on it (TOP is the
// ground), an edge or corner for an angled view; drag it to turn the view. With an empty drawing it starts large in
// the middle, asking which side to draw on, then moves to the corner.
const CUBE=[{k:'top',n:Z,U:X,V:[0,-1,0]},{k:'bottom',n:[0,0,-1],U:X,V:Y},{k:'front',n:[0,-1,0],U:X,V:[0,0,-1]},
  {k:'right',n:X,U:Y,V:[0,0,-1]},{k:'back',n:Y,U:[-1,0,0],V:[0,0,-1]},{k:'left',n:[-1,0,0],U:[0,-1,0],V:[0,0,-1]}];
const PLANE_AXES={front:[X,Z],back:[X,Z],right:[Y,Z],left:[Y,Z],bottom:[X,Y]};
const vcube=document.createElement('div');vcube.id='vcube';
vcube.innerHTML='<div class="vcIntro"><b>Which side do you want to draw on?</b><span>Click a side of the cube. You can change it any time.</span></div>'+
  '<canvas></canvas><button class="vcHome" title="Home: the normal 3D view of everything">⌂</button>'+
  '<div class="vcPlane" title="New shapes go on this side when they aren\'t drawn on a face. Click to go back to the ground."></div>'+
  '<button class="vcSkip">Just start on the ground</button>';
$('view').appendChild(vcube);
const vcCv=vcube.querySelector('canvas'),vcx=vcCv.getContext('2d');
let vcHover=null,vcDrag=null,vcAnim=0;
function setWorkPlane(k){
  if(!k||k==='top'||k==='ground')workPlane={name:'ground',n:Z,u:X,v:Y};
  else{const f=CUBE.find(c=>c.k===k),[u,v]=PLANE_AXES[k];workPlane={name:k,n:f.n,u,v};}
  const nm=workPlane.name==='ground'?'':workPlane.name[0].toUpperCase()+workPlane.name.slice(1);
  const pl=vcube.querySelector('.vcPlane');pl.textContent=nm?'Drawing on: '+nm+' ✕':'';pl.style.display=nm?'block':'none';
  buildGrid();requestDraw();if(tool.move&&lastE)tool.move(lastE,lastM);
}
function cubeIntro(on){vcube.classList.toggle('center',on);requestDraw();}
// Something has been made (e.g. the wizard built a box): the 'Which side?' question no longer applies.
window.cubeIntroOff=()=>{if(vcube.classList.contains('center'))cubeIntro(false);};
// Turn the camera smoothly to look along -d (d points from the model towards the eye).
function turnTo(yaw,pitch){
  const y0=cam.yaw,p0=cam.pitch;let dy=yaw-y0;while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
  const t0=performance.now(),id=++vcAnim;
  const step=now=>{if(id!==vcAnim)return;const k=Math.min(1,(now-t0)/320),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    cam.yaw=y0+dy*e;cam.pitch=p0+(pitch-p0)*e;camDirty();if(k<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function cubeLayout(){
  const s=vcCv.clientWidth||110,dpr=window.devicePixelRatio||1;
  if(vcCv.width!==Math.round(s*dpr)){vcCv.width=vcCv.height=Math.round(s*dpr);}
  const C=getCB(),S=s*0.26,c=s/2,P=v=>[c+dot(v,C.r)*S,c-dot(v,C.u)*S],V=v=>[dot(v,C.r)*S,-dot(v,C.u)*S];
  return {s,dpr,C,P,V};
}
// Which part of the cube is under (x,y): the face, and the third of it across and down (-1, 0 or 1).
function cubeHit(x,y){
  const {C,P,V}=cubeLayout();
  for(const f of CUBE){
    if(dot(f.n,C.f)>-0.05)continue;
    const O=P(f.n),A=V(f.U),B=V(f.V),det=A[0]*B[1]-A[1]*B[0];if(Math.abs(det)<1e-6)continue;
    const s=((x-O[0])*B[1]-(y-O[1])*B[0])/det,t=(A[0]*(y-O[1])-A[1]*(x-O[0]))/det;
    if(Math.abs(s)<=1&&Math.abs(t)<=1)return {f,zs:s<-1/3?-1:s>1/3?1:0,zt:t<-1/3?-1:t>1/3?1:0};
  }
  return null;
}
function drawCube(){
  // keep clear of a panel open on the right
  let right=10;for(const p of document.querySelectorAll('#view>.panel'))if(p.style.display==='block')right=Math.max(right,p.offsetWidth+18);
  vcube.style.setProperty('--vcr',right+'px');
  const {s,dpr,C,P,V}=cubeLayout();
  vcx.setTransform(dpr,0,0,dpr,0,0);vcx.clearRect(0,0,s,s);
  for(const f of CUBE){
    const facing=-dot(f.n,C.f);if(facing<=0.02)continue;
    const pt=(a,b)=>P(add(f.n,add(mul(f.U,a),mul(f.V,b))));
    const quad=(a0,a1,b0,b1)=>{vcx.beginPath();const q=[pt(a0,b0),pt(a1,b0),pt(a1,b1),pt(a0,b1)];vcx.moveTo(...q[0]);for(const p of q.slice(1))vcx.lineTo(...p);vcx.closePath();};
    const shade=0.86+0.14*facing,isPlane=(workPlane.name==='ground'?'top':workPlane.name)===f.k;
    quad(-1,1,-1,1);vcx.fillStyle=isPlane?`rgb(${Math.round(200*shade)},${Math.round(222*shade)},255)`:`rgb(${Math.round(236*shade)},${Math.round(238*shade)},${Math.round(242*shade)})`;vcx.fill();
    if(vcHover&&vcHover.f===f){const z=v=>v<0?[-1,-1/3]:v>0?[1/3,1]:[-1/3,1/3],[a0,a1]=z(vcHover.zs),[b0,b1]=z(vcHover.zt);quad(a0,a1,b0,b1);vcx.fillStyle='#2f7cf6aa';vcx.fill();}
    quad(-1,1,-1,1);vcx.strokeStyle='#7b8494';vcx.lineWidth=1.2;vcx.stroke();
    if(facing>0.25){
      const O=P(f.n),A=V(f.U),B=V(f.V),k=50;
      vcx.save();vcx.setTransform(dpr*A[0]/k,dpr*A[1]/k,dpr*B[0]/k,dpr*B[1]/k,dpr*O[0],dpr*O[1]);
      vcx.fillStyle='#3a4250';vcx.font='bold 19px "Segoe UI",system-ui,sans-serif';vcx.textAlign='center';vcx.textBaseline='middle';
      vcx.fillText(f.k.toUpperCase(),0,1);vcx.restore();
    }
  }
}
function cubeClick(h){
  if(!h)return;
  const f=h.f,face=!h.zs&&!h.zt;
  if(face){
    if(f.k==='top')turnTo(-Math.PI/2,LIM);else if(f.k==='bottom')turnTo(-Math.PI/2,-LIM);else turnTo(Math.atan2(f.n[1],f.n[0]),0);
    setWorkPlane(f.k);
    if(vcube.classList.contains('center')){cubeIntro(false);flash(f.k==='top'?'Drawing on the ground. Press R for a rectangle, C for a circle':'Drawing on the '+f.k+' side. Press R for a rectangle, C for a circle',4500);}
    else flash(f.k==='top'?'Looking down · new shapes go on the ground':'Looking at the '+f.k+' · new shapes go on the '+f.k+' side',3000);
  }else{
    const d=norm(add(f.n,add(mul(f.U,h.zs),mul(f.V,h.zt))));
    turnTo(Math.hypot(d[0],d[1])>1e-6?Math.atan2(d[1],d[0]):cam.yaw,clamp(Math.asin(d[2]),-LIM,LIM));
    if(vcube.classList.contains('center'))cubeIntro(false);
  }
}
vcCv.addEventListener('pointerdown',e=>{e.preventDefault();vcCv.setPointerCapture(e.pointerId);vcDrag={x:e.offsetX,y:e.offsetY,moved:0};});
vcCv.addEventListener('pointermove',e=>{
  if(vcDrag){const dx=e.offsetX-vcDrag.x,dy=e.offsetY-vcDrag.y;vcDrag.moved+=Math.abs(dx)+Math.abs(dy);vcDrag.x=e.offsetX;vcDrag.y=e.offsetY;
    if(vcDrag.moved>4){vcAnim++;orbitAround(cam.target,dx*2,dy*2);camDirty();vcHover=null;}return;}
  const h=cubeHit(e.offsetX,e.offsetY);if(!h!==!vcHover||h&&(h.f!==vcHover.f||h.zs!==vcHover.zs||h.zt!==vcHover.zt)){vcHover=h;requestDraw();}
  vcCv.style.cursor=h?'pointer':'grab';
});
vcCv.addEventListener('pointerup',e=>{const d=vcDrag;vcDrag=null;if(d&&d.moved<=4)cubeClick(cubeHit(e.offsetX,e.offsetY));});
vcCv.addEventListener('pointerleave',()=>{if(vcHover){vcHover=null;requestDraw();}});
vcube.querySelector('.vcHome').onclick=()=>{setView('iso');zoomExtents();};
vcube.querySelector('.vcPlane').onclick=()=>{setWorkPlane('ground');flash('New shapes go on the ground again');};
vcube.querySelector('.vcSkip').onclick=()=>{setWorkPlane('ground');cubeIntro(false);};
// Starting to draw (or clicking the view) puts the cube away in its corner.
cv.addEventListener('pointerdown',()=>{if(vcube.classList.contains('center'))cubeIntro(false);},true);
document.addEventListener('keydown',e=>{if(vcube.classList.contains('center')&&!e.ctrlKey&&e.key.length===1)cubeIntro(false);},true);

// ---------------------------------------------------------------- start
try{
  const a=JSON.parse(store.get('autosave')||'null');
  if(a&&Array.isArray(a.faces)){model={faces:a.faces,edges:a.edges||[],guides:a.guides||[]};fixIds();docName=a.name||'Untitled';if(a.camera)Object.assign(cam,a.camera);if(a.units&&UNITS[a.units])units=a.units;
    // (r1) the wizard / ESPHome answers normally are still in their own keys; only fill in any that went missing
    const e=a.electronics;
    if(e&&typeof e==='object'){
      if(e.wizard&&Array.isArray(e.wizard.items)&&store.get(ELEC_KEYS.wizard)==null)store.trySet(ELEC_KEYS.wizard,JSON.stringify(e.wizard));
      if(e.esphome&&typeof e.esphome==='object'&&store.get(ELEC_KEYS.esphome)==null)store.trySet(ELEC_KEYS.esphome,JSON.stringify(e.esphome));
      if(e.intent&&store.get(ELEC_KEYS.intent)==null)restoreIntent(e.intent);
      // (r3) AI-looked-up parts missing from the user's own parts are added back (ones already there are kept as they are)
      const looked=Array.isArray(e.intent_missing_parts_added)?e.intent_missing_parts_added:[],own=parseKey(ELEC_KEYS.parts);
      if(looked.length&&(own!==null||store.get(ELEC_KEYS.parts)==null)){const list=Array.isArray(own)?own:[],add=looked.filter(p=>p&&p.id&&!list.some(q=>q&&q.id===p.id));if(add.length)store.trySet(ELEC_KEYS.parts,JSON.stringify([...list,...add]));}
    }}
}catch(e){
  // a damaged autosave: say so, rather than silently starting with an empty drawing
  console.error('EvenUCan: the autosaved drawing could not be read',e);
  model={faces:[],edges:[],guides:[]};docName='Untitled';
  setTimeout(()=>flash('⚠ The drawing kept from last time could not be read, so EvenUCan started with an empty one. Open your last saved file to carry on.',9000),500);
}
checkStorageSpace();
// An empty drawing always starts in millimetres (older versions defaulted to metres).
if(!model.faces.length&&!model.edges.length){units='mm';store.set('units','mm');homeCam();}
uSel.value=units;syncPersp();buildGrid();buildPalette();setTool('select');updateStats();setDirty(false);
if(!model.faces.length)setHint('Welcome! Press R and draw a rectangle on the ground, then press P and pull it up into a box. Press F1 for help.');
setWorkPlane('ground');if(!model.faces.length&&!model.edges.length)cubeIntro(true);
// (r4) startup-r1: on first run show the Welcome wizard; on 2nd+ run show the Continue/New dialog when there is saved state
{const welcome=()=>{try{if(window.WFEnclosure){if(window.WFEnclosure.openStartupChoice)window.WFEnclosure.openStartupChoice();else if(window.WFEnclosure.openWelcome)window.WFEnclosure.openWelcome(true);}}catch(e){console.error('EvenUCan: could not show the startup screen',e);}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',welcome);else setTimeout(welcome,0);}
markDirty();
})();
