// EvenUCan 3D drawing app - 17-menus-and-palette.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- menu bar (1.9.34)
// A normal desktop menu: click a heading to open it; while one is open, pointing at another heading switches to it;
// a click outside or Esc closes it; arrow keys, Enter and Space work. Items click the same buttons as before
// (now hidden in #legacyBtns or not shown on the tool row), so every handler and id still works.
{
  const mdrop=$cad('mdrop'),mbar=$cad('mbar'),tops=[...mbar.querySelectorAll('.mtop')];
  const BTN=id=>()=>{
    const el=$cad(id);
    if(el&&el.onclick)el.click();
    else if(id==='bBuild'&&window.openWelcome)window.openWelcome(false);
    else if(id==='bParts'&&window.openLibrary)window.openLibrary();
    else if(id==='bEnclosure'&&window.openWizard)window.openWizard();
    else if(id==='bWiring'&&window.openWiring)window.openWiring();
    else if(id==='bCookbook'&&window.openCookbook)window.openCookbook();
    else if(el)el.click();
  },TBK=k=>{const f=()=>TB_BTN[k].click();f.tbKey=k;return f;},EN=n=>()=>{const W=window.WFEnclosure;if(W&&W[n])W[n]();else if(window[n])window[n]();};
  window.__menuHelpers={BTN,TBK,EN};// the Ctrl+K command list (outside this block) builds its entries with the same helpers
  const hasSel=()=>selection.size>0;
  const tl=(k,lab)=>{const t=TOOLS.find(t=>t&&t[0]===k);return {label:lab||t[1],key:t[2]==='Space'?'Space':t[2],fn:TBK(k),checked:()=>toolNameCad===k,ic:k};};
  const tt=(k,label)=>({label,fn:TBK(k),checked:()=>toolNameCad===k,ic:k});
  const view=(v,label)=>({label,fn:()=>setView(v),ic:'v-'+v});
  const pick=(sel,v,label)=>({label,fn:()=>{const e=$cad(sel);if(e.value!==v){e.value=v;e.dispatchEvent(new Event('change'));}},checked:()=>$cad(sel).value===v});
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
      {label:'Resize to an exact size...',fn:BTN('bResize')},tt('flat','Lay flat on a face'),{label:'Lay all flat',fn:TBK('layall')},{label:'Arrange on bed',fn:TBK('arrange')},{label:'Clear build plate...',fn:TBK('clearbed'),ic:'clearbed'}],
    View:[view('iso','Standard 3D view'),view('top','Top'),view('front','Front'),view('right','Right'),view('back','Back'),view('left','Left'),null,
      {label:'Zoom to fit everything',key:'Shift+Z',fn:TBK('extents')},tl('orbit'),tl('pan'),tl('zoom'),null,
      pick('proj','persp','Perspective (natural)'),pick('proj','ortho','Parallel (no perspective)'),null,
      {head:'Units'},pick('units','mm','Millimetres'),pick('units','cm','Centimetres'),pick('units','m','Metres'),pick('units','in','Inches'),pick('units','ft','Feet & inches')],
    Tools:[{head:'Photo system'},{label:'Measure a part from photos...',fn:()=>openPhotoMeasurement()},{label:'Command Palette...',key:'Ctrl+K',fn:()=>window.openCommandPalette&&window.openCommandPalette()},{label:'Start a project (step by step)...',fn:BTN('bBuild')},null,
      {label:'Parts library...',fn:BTN('bParts')},{label:'Open Cookbook...',fn:()=>window.openCookbook?window.openCookbook():(window.WFEnclosure&&window.WFEnclosure.openCookbook&&window.WFEnclosure.openCookbook())},{label:'Box designer (Enclosure)...',fn:BTN('bEnclosure')},
      tt('standoff','Stand-off for a heat-set insert'),tt('boardmount','Board mount (platform for a board)'),tt('makelid','Make lid (regenerate the lid from the last box)'),
      tt('cutout','Access Hole Tool'),
      {label:'Wiring...',fn:BTN('bWiring')},{label:'Code for your board...',fn:EN('openCodeGated')},null,
      {label:'💬 Chat with AI Specialist...',fn:()=>window.openUniversalAiChat?window.openUniversalAiChat():(window.WFEnclosure&&window.WFEnclosure.openUniversalAiChat&&window.WFEnclosure.openUniversalAiChat())},{label:'AI helper key...',fn:EN('askKey')},{label:'Keys and Wi-Fi...',fn:()=>window.openKeysScreen&&window.openKeysScreen()},null,{label:'Check model for printing',fn:BTN('bCheck'),checked:()=>!!check},null,{get label(){return document.documentElement.getAttribute('data-theme')==='dark'?'☀️  Switch to Light theme':'🌙  Switch to Dark theme';},fn:()=>{const nt=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',nt);localStorage.setItem('evenucan.theme',nt);}}],
    Help:[{label:'Quick guide and shortcuts',key:'F1',fn:BTN('bHelp')},{label:'Icon guide: what each icon does...',fn:()=>openIconGuide()},{label:'User manual (PDF)',fn:()=>window.open('EvenUCan User Manual.pdf','_blank')},
      {label:'EvenUCan on GitHub',fn:()=>window.open('https://github.com/bullbrand/EvenUCan','_blank')},null,
      {label:'Check for updates',fn:()=>checkForUpdatesManual()},null,{label:'About EvenUCan',fn:BTN('bAbout')}]
  };
  // (1.9.35) A small colourful icon beside each item that has a matching one.
  const MENU_IC={'Start a project (step by step)...':'wizard','Measure a Part from Photos...':'parts','New':'new','Open...':'open','Save':'save','Save As...':'saveas',
    '3MF for 3D printing...':'export','STL for 3D printing...':'export','OBJ (other 3D programs)...':'export','Picture of the view (PNG)...':'png',
    'Printer size...':'printer','Check model for printing':'check','Undo':'undo','Redo':'redo','Cut':'cut','Copy':'copy','Paste':'paste',
    'Delete':'delete','Select all':'selall','Select none':'selnone','Hide selected':'hide','Unhide all':'unhide','Delete guides':'guides',
    'Join':'join','Subtract':'subtract','Intersect':'intersect','Group':'group','Ungroup':'ungroup','Resize to an exact size...':'resize',
    'Lay all flat':'layall','Arrange on bed':'arrange','Clear build plate...':'clearbed','Zoom to fit everything':'extents','Perspective (natural)':'persp','Parallel (no perspective)':'ortho',
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
    ['Print bed',[['Modify','flat','Lay flat'],['Modify','Lay all flat','All flat'],['Modify','Arrange on bed','Arrange'],['Modify','Clear build plate...','Clear plate']]],
    ['View',[['View','v-iso','3D'],['View','v-top','Top'],['View','v-front','Front'],['View','v-right','Right'],['View','v-back','Back'],['View','v-left','Left'],
      ['View','Zoom to fit everything','Fit all'],['View','orbit','Orbit'],['View','pan','Pan'],['View','zoom','Zoom'],
      ['View','Perspective (natural)','Natural'],['View','Parallel (no perspective)','Parallel']]],
    ['Tools',[['Tools','Start a project (step by step)...','Project'],['Tools','Parts library...','Parts'],['Tools','Open Cookbook...','Cookbook'],['Tools','Box designer (Enclosure)...','Box'],
      ['Tools','Wiring...','Wiring'],['Tools','Code for your board...','Code'],['Tools','AI helper key...','AI key']]],
    ['Box',[['Tools','standoff','Stand-off'],['Tools','boardmount','Board'],['Tools','makelid','Lid'],['Tools','cutout','Access Hole Tool']]],
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
    'AI helper key...':'add or change the key for the free AI helper','Quick guide and shortcuts':'how to use the tools, and the shortcut keys','User manual (PDF)':'open the full user manual','Clear build plate...':'remove all parts and objects from the print bed (asks to confirm first)'};
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
      d.innerHTML='<span class="ck">'+(ck?'✓':'')+'</span><span class="mi">'+(it.ic&&(fiHas(it.ic)||ICONS[it.ic])?icon(it.ic):'')+'</span><span class="lb">'+esc(it.label)+'</span>'+(it.key?'<kbd>'+esc(it.key)+'</kbd>':'');
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
// Ask before closing with unsaved changes (the autosave is flushed first).
window.addEventListener('beforeunload',e=>{flushAutosave();if(docDirty){e.preventDefault();e.returnValue='';}});
// (Perf-r1) a closed tab or one sent to the background keeps its last edits in the autosave
window.addEventListener('pagehide',flushAutosave);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushAutosave();});

// ---------------------------------------------------------------- add-on API
// The Enclosure Wizard and Parts Library (separate script below) work through this small interface.

// ---------------------------------------------------------------- Command Palette & UI/UX v2 Enhancements
const getCommandList=function getCommandList(){
  const {BTN,TBK,EN}=window.__menuHelpers||{};
  const cmds=[];
  cmds.push({id:'measure_part_photo',title:'Measure a Part from Photos...',cat:'Tools',badge:'Photo',desc:'Measure board sizes, mounting holes, and electrical pinouts from photos',fn:()=>openPhotoMeasurement()});
  cmds.push({id:'cmd_palette',title:'Command Palette',cat:'General',key:'Ctrl+K',desc:'Quick tool and action finder',fn:()=>window.openCommandPalette()});
  cmds.push({id:'build',title:'Start a project (step by step)',cat:'Project',badge:'Wizard',desc:'Choose parts, design enclosure, and wire',fn:BTN('bBuild')});
  cmds.push({id:'newproj',title:'New Project (Welcome choices)',cat:'File',desc:'Start a fresh project with template or scratch',fn:()=>newProject()});
  cmds.push({id:'new',title:'New Drawing',cat:'File',key:'Ctrl+N',desc:'Clear canvas and start a blank drawing',fn:()=>newFile()});
  cmds.push({id:'open',title:'Open File (3MF, STL, OSK, JSON)',cat:'File',key:'Ctrl+O',desc:'Open an existing 3D model or project',fn:()=>openFile()});
  cmds.push({id:'save',title:'Save Model',cat:'File',key:'Ctrl+S',desc:'Save 3D drawing with embedded electronics',fn:()=>saveFile(false)});
  cmds.push({id:'saveas',title:'Save As...',cat:'File',key:'Ctrl+Shift+S',desc:'Save to a new file location',fn:()=>saveFile(true)});
  cmds.push({id:'export3mf',title:'Export 3MF for 3D Printing',cat:'Export',desc:'Standard 3MF format with slice metadata',fn:BTN('b3mf')});
  cmds.push({id:'exportstl',title:'Export STL for 3D Printing',cat:'Export',desc:'Triangulated STL surface mesh',fn:BTN('bStl')});
  cmds.push({id:'exportobj',title:'Export OBJ (other 3D programs)',cat:'Export',desc:'Wavefront OBJ mesh',fn:BTN('bObj')});
  cmds.push({id:'exportpng',title:'Export PNG Picture of View',cat:'Export',desc:'Save screenshot of current 3D view',fn:BTN('bPng')});
  cmds.push({id:'bedsize',title:'Printer Bed Size & Presets',cat:'Settings',desc:'Set 3D printer bed volume (Ender 3, Prusa, etc.)',fn:BTN('bPrinter')});
  cmds.push({id:'checkmodel',title:'Check Model for 3D Printing',cat:'Tools',desc:'Analyze watertightness and manifold geometry',fn:BTN('bCheck')});

  cmds.push({id:'undo',title:'Undo',cat:'Edit',key:'Ctrl+Z',desc:'Undo last drawing change',fn:()=>undo()});
  cmds.push({id:'redo',title:'Redo',cat:'Edit',key:'Ctrl+Y',desc:'Redo previously undone change',fn:()=>redo()});
  cmds.push({id:'cut',title:'Cut Selection',cat:'Edit',key:'Ctrl+X',desc:'Cut selected geometry to clipboard',fn:()=>copySel(true)});
  cmds.push({id:'copy',title:'Copy Selection',cat:'Edit',key:'Ctrl+C',desc:'Copy selected geometry',fn:()=>copySel(false)});
  cmds.push({id:'paste',title:'Paste',cat:'Edit',key:'Ctrl+V',desc:'Paste copied geometry',fn:()=>pasteClip()});
  cmds.push({id:'delete',title:'Delete Selection',cat:'Edit',key:'Del',desc:'Delete selected faces or lines',fn:()=>deleteSelection()});
  cmds.push({id:'selectall',title:'Select All',cat:'Edit',key:'Ctrl+A',desc:'Select all visible entities',fn:()=>selectAll()});
  cmds.push({id:'selectnone',title:'Select None (Deselect)',cat:'Edit',key:'Ctrl+T',desc:'Clear current selection',fn:()=>{selection.clear();selChanged();requestDraw();}});
  cmds.push({id:'hidesel',title:'Hide Selected',cat:'Edit',key:'Shift+H',desc:'Temporarily hide selected objects',fn:BTN('bHide')});
  cmds.push({id:'unhideall',title:'Unhide All',cat:'Edit',key:'Shift+U',desc:'Show all hidden objects',fn:BTN('bUnhide')});
  cmds.push({id:'delguides',title:'Delete Guides',cat:'Edit',key:'Shift+E',desc:'Clear all measurement guide lines and center points',fn:TBK('guides')});

  if(typeof TOOLS!=='undefined'){
    for(const t of TOOLS){
      if(!t)continue;
      const [k,name,key]=t;
      cmds.push({id:'tool_'+k,title:'Tool: '+name,cat:'Draw',key:key==='Space'?'Space':key||'',desc:TOOL_DESC[k]||'',fn:()=>setTool(k)});
    }
  }
  cmds.push({id:'tool_text',title:'Tool: 3D Text',cat:'Draw',desc:'Create raised or engraved 3D text',fn:()=>setTool('text')});
  cmds.push({id:'tool_hole',title:'Tool: Hole',cat:'Modify',desc:'Screw holes, countersinks, heat-set inserts',fn:()=>setTool('hole')});
  cmds.push({id:'tool_standoff',title:'Tool: Stand-off Post',cat:'Modify',desc:'Threaded brass insert mounting boss',fn:()=>setTool('standoff')});
  cmds.push({id:'tool_boardmount',title:'Tool: Board Mount',cat:'Modify',desc:'Mounting posts for Arduino, ESP32, Pi',fn:()=>setTool('boardmount')});
  cmds.push({id:'tool_makelid',title:'Tool: Make Lid',cat:'Modify',desc:'Generate matching snap or screw lid for box',fn:()=>setTool('makelid')});
  cmds.push({id:'tool_shell',title:'Tool: Shell (Hollow out)',cat:'Modify',desc:'Hollow out solid geometry with specified wall thickness',fn:()=>setTool('shell')});
  cmds.push({id:'tool_flat',title:'Tool: Lay Flat',cat:'Modify',desc:'Rotate object onto chosen face on print bed',fn:()=>setTool('flat')});
  cmds.push({id:'layall',title:'Lay All Flat on Bed',cat:'Modify',desc:'Flip every separate piece onto its largest face',fn:TBK('layall')});
  cmds.push({id:'arrange',title:'Arrange on Bed',cat:'Modify',desc:'Space pieces apart automatically so none overlap',fn:TBK('arrange')});
  cmds.push({id:'clearbed',title:'Clear Build Plate',cat:'Modify',desc:'Delete all parts from the print bed with confirmation',fn:TBK('clearbed')});
  cmds.push({id:'join',title:'Join / Union Solids',cat:'Modify',key:'U',desc:'Merge selected overlapping solids into one',fn:TBK('join')});
  cmds.push({id:'subtract',title:'Subtract Solid',cat:'Modify',key:'S',desc:'Cut one solid using another',fn:TBK('subtract')});
  cmds.push({id:'intersect',title:'Intersect Solids',cat:'Modify',desc:'Keep only the overlapping portion of solids',fn:TBK('intersect')});
  cmds.push({id:'group',title:'Group Objects',cat:'Modify',key:'G',desc:'Combine selected items into a single group',fn:BTN('bGroup')});
  cmds.push({id:'ungroup',title:'Ungroup Objects',cat:'Modify',key:'Shift+G',desc:'Separate grouped items into individual pieces',fn:BTN('bUngroup')});
  cmds.push({id:'resizexact',title:'Resize to Exact Size...',cat:'Modify',desc:'Scale object to precise X, Y, or Z dimensions',fn:BTN('bResize')});

  cmds.push({id:'view_iso',title:'View: Standard Isometric 3D',cat:'View',key:'0',desc:'Default angled perspective',fn:()=>{setView('iso');requestDraw();flash('View: Isometric 3D (0)');}});
  cmds.push({id:'view_top',title:'View: Top',cat:'View',key:'1',desc:'Look directly down at the build plate',fn:()=>{setView('top');requestDraw();flash('View: Top (1)');}});
  cmds.push({id:'view_front',title:'View: Front',cat:'View',key:'2',desc:'Look directly at the front',fn:()=>{setView('front');requestDraw();flash('View: Front (2)');}});
  cmds.push({id:'view_right',title:'View: Right',cat:'View',key:'3',desc:'Look directly at the right side',fn:()=>{setView('right');requestDraw();flash('View: Right (3)');}});
  cmds.push({id:'view_back',title:'View: Back',cat:'View',desc:'Look directly at the back',fn:()=>{setView('back');requestDraw();flash('View: Back');}});
  cmds.push({id:'view_left',title:'View: Left',cat:'View',desc:'Look directly at the left side',fn:()=>{setView('left');requestDraw();flash('View: Left');}});
  cmds.push({id:'zoomext',title:'Zoom to Fit Everything',cat:'View',key:'Shift+Z',desc:'Center and frame all geometry in view',fn:()=>zoomExtents()});

  cmds.push({id:'encl_wizard',title:'Box Designer (Enclosure Wizard)',cat:'Electronics',desc:'Create complete 3D printable project box',fn:BTN('bEnclosure')});
  cmds.push({id:'parts_lib',title:'Parts Library',cat:'Electronics',desc:'Search electronic components or import custom parts',fn:BTN('bParts')});
  cmds.push({id:'cookbook',title:'Cookbook Projects',cat:'Electronics',desc:'Browse curated gadget projects with parts and wiring',fn:()=>window.openCookbook?window.openCookbook():(window.WFEnclosure&&window.WFEnclosure.openCookbook&&window.WFEnclosure.openCookbook())});
  cmds.push({id:'wiring_diag',title:'Wiring Diagram & Checklist',cat:'Electronics',desc:'Interactive pin connection schematic',fn:BTN('bWiring')});
  cmds.push({id:'board_code',title:'Code for your Board (ESPHome/Arduino)',cat:'Electronics',desc:'Auto-generated starter firmware',fn:()=>window.WFEnclosure&&window.WFEnclosure.openCodeGated&&window.WFEnclosure.openCodeGated()});
  cmds.push({id:'ai_chat',title:'💬 Chat with AI Specialist',cat:'AI',desc:'Chat with built-in electronics & code specialist',fn:()=>window.openUniversalAiChat?window.openUniversalAiChat():(window.WFEnclosure&&window.WFEnclosure.openUniversalAiChat&&window.WFEnclosure.openUniversalAiChat())});
  cmds.push({id:'ai_key',title:'AI Helper Key Setup',cat:'Settings',desc:'Configure free Gemini/Groq or Anthropic API key',fn:()=>window.WFEnclosure&&window.WFEnclosure.askKey&&window.WFEnclosure.askKey()});
  cmds.push({id:'help',title:'Quick Guide & Keyboard Shortcuts',cat:'Help',key:'F1',desc:'Display tools cheat sheet',fn:()=>toggleHelp()});
  cmds.push({id:'about',title:'About EvenUCan',cat:'Help',desc:'Version info and credits',fn:BTN('bAbout')});

  return cmds;
};

const initCommandPalette=function initCommandPalette(){
  const p=$cad('cmdPalette'),inp=$cad('cmdSearchInput'),res=$cad('cmdResults');
  if(!p||!inp||!res)return;
  let activeIndex=0,filteredCmds=[];

  function openPalette(){
    p.style.display='grid';
    inp.value='';
    render('');
    setTimeout(()=>inp.focus(),20);
  }
  function closePalette(){
    p.style.display='none';
  }
  function render(query){
    const q=(query||'').toLowerCase().trim();
    const all=getCommandList();
    if(!q){
      filteredCmds=all;
    }else{
      filteredCmds=all.filter(c=>
        c.title.toLowerCase().includes(q)||
        (c.cat&&c.cat.toLowerCase().includes(q))||
        (c.desc&&c.desc.toLowerCase().includes(q))||
        (c.key&&c.key.toLowerCase().includes(q))
      );
    }
    activeIndex=0;
    res.innerHTML='';
    if(!filteredCmds.length){
      res.innerHTML='<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">No commands matching "'+escCad(q)+'"</div>';
      return;
    }
    filteredCmds.slice(0,35).forEach((c,idx)=>{
      const item=document.createElement('div');
      item.className='cmd-item'+(idx===0?' active':'');
      item.setAttribute('role','option');
      item.setAttribute('aria-selected',String(idx===0));

      item.innerHTML='<div class="cmd-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></div>'+
        '<div class="cmd-item-main">'+
          '<div class="cmd-item-title">'+escCad(c.title)+'</div>'+
          '<div class="cmd-item-desc">'+escCad(c.desc||c.cat||'')+'</div>'+
        '</div>'+
        (c.key?'<span class="cmd-item-badge">'+escCad(c.key)+'</span>':(c.badge?'<span class="cmd-item-badge" style="background:#e0edff;color:var(--accent);border-color:#b8d5ff">'+escCad(c.badge)+'</span>':''));

      item.addEventListener('mouseenter',()=>{activeIndex=idx;updateActive();});
      item.addEventListener('click',()=>{execute(c);});
      res.appendChild(item);
    });
  }
  function updateActive(){
    const items=res.querySelectorAll('.cmd-item');
    items.forEach((it,idx)=>{
      const isCur=idx===activeIndex;
      it.classList.toggle('active',isCur);
      it.setAttribute('aria-selected',String(isCur));
      if(isCur)it.scrollIntoView({block:'nearest'});
    });
  }
  function execute(c){
    closePalette();
    if(c&&c.fn){
      try{c.fn();}catch(err){console.error('Command failed:',err);flash('Command error: '+(err.message||err));}
    }
  }
  inp.addEventListener('input',()=>render(inp.value));
  inp.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){
      e.preventDefault();
      if(filteredCmds.length){activeIndex=(activeIndex+1)%Math.min(filteredCmds.length,35);updateActive();}
    }else if(e.key==='ArrowUp'){
      e.preventDefault();
      if(filteredCmds.length){activeIndex=(activeIndex-1+Math.min(filteredCmds.length,35))%Math.min(filteredCmds.length,35);updateActive();}
    }else if(e.key==='Enter'){
      e.preventDefault();
      if(filteredCmds[activeIndex])execute(filteredCmds[activeIndex]);
    }else if(e.key==='Escape'){
      e.preventDefault();closePalette();
    }
  });
  p.addEventListener('click',e=>{if(e.target===p)closePalette();});

  window.openCommandPalette=openPalette;
  window.closeCommandPalette=closePalette;
  const btnSearch=$cad('bCmdPalette');
  if(btnSearch)btnSearch.onclick=openPalette;
};

// Direct 3D Model Drag & Drop on Canvas
const initDropZone=function initDropZone(){
  const dropOverlay=$cad('dropOverlay');
  let dragCount=0;
  window.addEventListener('dragenter',e=>{
    if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){
      dragCount++;
      if(dropOverlay)dropOverlay.style.display='grid';
    }
  });
  window.addEventListener('dragleave',e=>{
    dragCount--;
    if(dragCount<=0){dragCount=0;if(dropOverlay)dropOverlay.style.display='none';}
  });
  window.addEventListener('dragover',e=>{
    if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault();
  });
  window.addEventListener('drop',async e=>{
    dragCount=0;
    if(dropOverlay)dropOverlay.style.display='none';
    if(!e.dataTransfer||!e.dataTransfer.files.length)return;
    const f=e.dataTransfer.files[0];
    if(/\.(3mf|stl|osk|json)$/i.test(f.name)){
      e.preventDefault();
      e.stopPropagation();
      if(docDirty&&!confirm('Discard unsaved changes to "'+docName+'"?'))return;
      try{
        const buf=await f.arrayBuffer();
        const ok=await openBuffer(buf,f.name);
        fileHandle=null;
        if(ok)flash('Opened '+f.name);
      }catch(err){
        console.error('File load failed:',err);
        flash('Could not load 3D file: '+(err.message||'corrupt format'));
      }
    }
  },true);
};

// Copy model stats to clipboard on click
const initStatsClick=function initStatsClick(){
  const statsEl=$cad('stats');
  if(statsEl){
    statsEl.title='Click to copy model details to clipboard';
    statsEl.addEventListener('click',()=>{
      const text=statsEl.textContent;
      if(!text)return;
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(()=>{
          flash('Model stats copied to clipboard!');
        }).catch(()=>{flash(text);});
      }else{flash(text);}
    });
  }
};

// Start these once the page has finished loading, so their elements exist (a 100 ms timer could run too early).
const startUiExtras=()=>{
  try{initCommandPalette();}catch(e){console.warn('initCommandPalette err',e);}
  try{initDropZone();}catch(e){console.warn('initDropZone err',e);}
  try{initStatsClick();}catch(e){console.warn('initStatsClick err',e);}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startUiExtras);
else setTimeout(startUiExtras,100);


window.WF={
  get model(){return model;},get bed(){return bed;},get docEmpty(){return !model.faces.length&&!model.edges.length;},
  nid,pushUndo,commitChange,clearBuildPlate,arrangeOnBed,facesFromTriangles,triangulate,flash,askText,zoomExtents,openCheck,analyseModel,setGhosts,
  ghostsShown:v=>{if(v!==undefined){ghostOn=v;requestDraw();}return ghostOn;},
  clearSelection(){selection.clear();selChanged();},
  replaceModel(faces,name){if(tool.cancel)tool.cancel();model={faces,edges:[],guides:[]};fixIds();lastShape=null;selection.clear();if(name)docName=name;fileHandle=null;},
  setTool,downloadBlob,download,store,bedText,fitsBed,readZip,pushPullMany,exportSTL,export3MF,saveFile,get dirty(){return docDirty;},
  setBed(x,y,z){if(x>9&&y>9&&z>9){bed={x,y,z};store.set('bed',JSON.stringify(bed));}},
  setDocName(n){if(n){docName=String(n);setDirty(docDirty);}},
  // page position of a model point (for tests and add-ons)
  toPage(p){const s=toScreen(p),r=cv.getBoundingClientRect();return s?[r.left+s[0],r.top+s[1]]:null;},
  get selection(){return selection;},select(ids){selection=new Set(ids);selChanged();},
  cubeHit(x,y){const h=cubeHit(x,y);return h&&{k:h.f.k,zs:h.zs,zt:h.zt};},get cubeHover(){return vcHover&&{k:vcHover.f.k,zs:vcHover.zs,zt:vcHover.zt};},get workPlane(){return workPlane.name;}
};

// How to use each tool, in plain words, with one short example (shown when a row in the Icon guide is clicked).
const TOOL_HOWTO={
  select:{how:'Click a face or line to pick it. Drag a box round several things to pick them all. Double-click to pick a whole object.',ex:'Drag a box round three lines, then press Delete to remove them.'},
  line:{how:'Click a start point. Then either click each corner, or type a length and press Enter for an exact one. Arrow keys lock the line to an axis. Click the start point again to close the shape.',ex:'Click the start, type 40 and press Enter, then turn 90 degrees and type 40 again: a 40 mm square edge.'},
  rect:{how:'Click the first corner, then type the size (for example 30 or 30mm) and press Enter. Or click the opposite corner. Type three numbers (length, width, height), such as 20, 15, 15, to make a box in one go.',ex:'Click the first corner, type 20, 15, 15 and press Enter for a 20 x 15 x 15 mm box.'},
  circle:{how:'Click the centre, then move out and click to set the size, or type the size and press Enter. Type 36s first for a smoother circle.',ex:'Click the centre of a box top, type 20 and press Enter for a 20 mm round opening.'},
  polygon:{how:'Type the number of sides first (6s for a hexagon, 3s for a triangle, 8s for an octagon), then click the centre and click out.',ex:'Type 6s, click the centre, click out: a hexagon, good for a nut shape.'},
  solid:{how:'Pick a shape (ball, cone, cylinder or pyramid), click where it goes, then pull it to size.',ex:'Pick a cylinder and set its height to make a 30 mm pillar.'},
  arc:{how:'Click the start, then the end. Move the mouse to bend the curve and click. Or type the distance between the two ends and press Enter.',ex:'Click two corners, type 30 and press Enter, then bend the curve out and click.'},
  push:{how:'Click a face, move the mouse to set the distance, then click. Or type a distance and press Enter for an exact one. Pulling out adds height; a negative number (for example -3) pushes in to cut a hole.',ex:'Click a 60 mm square, type 10 and press Enter: a 10 mm high box.'},
  move:{how:'Select what you want, then drag it, or type a distance (or an x,y,z offset) and press Enter. Hold Ctrl to leave a copy behind.',ex:'Select a part, hold Ctrl, type 20 and press Enter to make a copy 20 mm to the side.'},
  rotate:{how:'Select what you want, click the point to turn around, then drag.',ex:'Select a wall and turn it 90 degrees to stand it up.'},
  round:{how:'Click a line where two faces meet to round or chamfer it. Shift+click a box to do every edge.',ex:'Shift+click a box to round all of its corners at once.'},
  offset:{how:'Click a face, move the mouse in or out to copy its outline, then click. Or type a distance and press Enter (a minus sign, such as -2, means outside).',ex:'Click the top face of a box, type 2 and press Enter: a neat 2 mm rim inside the edge.'},
  follow:{how:'Click a face, then click the line it should follow.',ex:'A round face and a curved path: the face sweeps along the path into a pipe.'},
  slice:{how:'Click a solid, then click to place the cutting plane. Arrow keys turn the plane. Type a distance from the bottom and press Enter for an exact cut. You can move or delete either half afterwards.',ex:'Slice a 40 mm block at 10 mm from the bottom to make a lid and a base.'},
  erase:{how:'Click lines or faces to delete them.',ex:'Click a stray line to remove it.'},
  paint:{how:'Click a face to colour it. Alt+click picks up a colour from a face.',ex:'Alt+click a red face, then click another face to colour it red.'},
  tape:{how:'Click two points to measure the distance between them. Type a distance and press Enter to leave a guide at an exact point.',ex:'Click one edge of a board, type 50 and press Enter to mark a guide 50 mm away.'},
  center:{how:'Click two points; a marker appears at the halfway point.',ex:'Find the centre of a box top to place a screw hole.'},
  orbit:{how:'Drag to turn the view round.',ex:'Drag left and right to see the back of the box.'},
  pan:{how:'Drag to slide the view sideways.',ex:'Drag to bring the far corner of the print bed into view.'},
  zoom:{how:'Drag up to zoom in, drag down to zoom out.',ex:'Drag up to see a small hole close up.'}
};
window.openToolHelp=function openToolHelp(k){
  const row=TOOLS.find(r=>r&&r[0]===k); const h=TOOL_HOWTO[k]; if(!row||!h)return;
  document.getElementById('toolHelp')?.remove();
  const box=document.createElement('div');
  box.id='toolHelp'; box.className='u-backdrop u-backdrop-top';
  box.innerHTML='<div class="u-card u-th-card" role="dialog" aria-label="'+row[1]+'">'+
    '<div class="u-th-head"><span class="u-ig-icon">'+(typeof icon==="function"?icon(k):"")+'</span><div><div class="u-title-16">'+row[1]+'</div>'+
    '<div class="u-muted">'+((TOOL_DESC&&TOOL_DESC[k])||'')+'</div></div><kbd class="u-ig-key">'+(row[2]==='Space'?'Space':row[2])+'</kbd></div>'+
    '<div class="u-th-label">How to use it</div><div class="u-th-text">'+h.how+'</div>'+
    '<div class="u-th-label">Example</div><div class="u-th-text u-th-ex">'+h.ex+'</div>'+
    '<div class="u-ig-foot"><button id="toolHelpClose" class="primary">Close</button></div></div>';
  document.body.appendChild(box);
  const close=()=>{box.remove();document.removeEventListener('keydown',onKey,true);};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
  document.addEventListener('keydown',onKey,true);
  box.addEventListener('click',e=>{if(e.target===box)close();});
  box.querySelector('#toolHelpClose').onclick=close;
};
// Help > Icon guide: every tool with its icon, shortcut key and a short description (built from the same tables as the toolbar).
window.openIconGuide=function openIconGuide(){
  document.getElementById('iconGuide')?.remove();
  const groups=[[]];
  for(const row of TOOLS){ if(!row){ groups.push([]); continue; } groups[groups.length-1].push(row); }
  const body=groups.filter(g=>g.length).map(g=>
    '<div class="u-ig-group">'+g.map(([k,name,key])=>{
      const desc=(TOOL_DESC&&TOOL_DESC[k])||'';
      return '<div class="u-ig-row" data-tool="'+k+'" tabindex="0" role="button"><span class="u-ig-icon">'+(typeof icon==='function'?icon(k):'')+'</span>'+
        '<span class="u-ig-name">'+name+'</span>'+
        '<kbd class="u-ig-key">'+(key==='Space'?'Space':key)+'</kbd>'+
        '<span class="u-ig-desc">'+desc+'</span></div>';
    }).join('')+'</div>').join('');
  const box=document.createElement('div');
  box.id='iconGuide';
  box.className='u-backdrop';
  box.innerHTML='<div class="u-card u-ig-card" role="dialog" aria-label="Icon guide">'+
    '<div class="u-ig-head"><div class="u-title-16">Icon guide</div><div class="u-muted">Each icon, its shortcut key, and what it does. Click an icon for how to use it.</div>'+'<div class="u-ig-esc"><kbd class="u-ig-key">Esc</kbd><span>closes an open panel first. Press it again to cancel what you are drawing or moving. Press it once more, with nothing in progress, to clear the selection.</span></div></div>'+
    '<div class="u-ig-list">'+body+'</div>'+
    '<div class="u-ig-foot"><button id="iconGuideClose" class="primary">Close</button></div></div>';
  document.body.appendChild(box);
  const close=()=>{box.remove();document.removeEventListener('keydown',onKey,true);};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
  document.addEventListener('keydown',onKey,true);
  box.addEventListener('click',e=>{if(e.target===box)close();});
  box.querySelector('#iconGuideClose').onclick=close;
  box.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('.u-ig-row');if(r)openToolHelp(r.dataset.tool);});
  box.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('u-ig-row')){e.preventDefault();openToolHelp(e.target.dataset.tool);}});
};
