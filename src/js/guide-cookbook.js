// ---------------------------------------------------------------- keys and menu wiring
// While a window is open, keys belong to it (so typing doesn't switch drawing tools).
document.addEventListener('keydown',e=>{
  const open=iwBack.style.display==='grid'?iwBack:ewBack.style.display==='grid'?ewBack:plBack.style.display==='grid'?plBack:wrBack.style.display==='grid'?wrBack:null;
  if(!open||document.getElementById('askBack'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(open===plBack&&edMode!=='select'){edMode='select';clicks=[];rawImg=null;renderEditor();}else if(open===plBack&&plBig)setBig(false);else if(open===iwBack)closeIntent();else if(open===ewBack)closeWizard();else if(open===wrBack)closeWiring();else closeLibrary();return;}
  if(!open.contains(e.target))e.stopImmediatePropagation();
},true);
for(const b of [ewBack,plBack,wrBack,iwBack])b.addEventListener('keydown',e=>e.stopPropagation());
$('bWiring').onclick=openWiringGated;$('ewWire').onclick=openWiringGated;// (wizard-r1) a nudge when there are no parts yet
$('bEnclosure').onclick=openWizard;$('bParts').onclick=()=>openLibrary();

// ================================================================ Cookbook (1.9.44)
// User ticks the parts they own at home; AI suggests projects and prioritises those parts.
{
  const COOKBOOK_KEY='cookbook';
  // localStorage wrapper (store may be out of scope here depending on script structure)
  const store={get:k=>{ try{return localStorage.getItem('opensketch.'+k);}catch(e){return null;} },set:(k,v)=>{ try{localStorage.setItem('opensketch.'+k,v);}catch(e){} }};
  // stock: {partId: qty}  — 0 or absent means not owned
  const getStock=()=>{try{const v=JSON.parse(store.get(COOKBOOK_KEY)||'{}');return(Array.isArray(v)?Object.fromEntries(v.map(id=>[id,1])):v);}catch(e){return {};}};
  const setStock=obj=>{store.set(COOKBOOK_KEY,JSON.stringify(obj));};
  const getOwnedIds=()=>Object.entries(getStock()).filter(([,q])=>q>0).map(([id])=>id);
  let cbQuery='',cbBusy=false;
  const cbBack=$('cbBack');

  window.openCookbook=function(){
    cbQuery='';$('cbSearch').value='';$('cbAiResult').classList.remove('on');
    cbBack.style.display='grid';renderCookbook();
  };
  function closeCookbook(){cbBack.style.display='none';}
  function renderCookbook(){
    const stock=getStock(),q=cbQuery.toLowerCase().trim();
    const parts=allParts().filter(p=>!q||p.name.toLowerCase().includes(q)||(p.type||'').toLowerCase().includes(q)||p.id.toLowerCase().includes(q));
    $('cbList').innerHTML=parts.map(p=>{const qty=stock[p.id]||0;return`<div class="cbItem${qty>0?' cbOwned':''}" data-cbid="${esc(p.id)}"><input type="number" class="cbQty" min="0" max="9999" value="${qty}" data-cbid="${esc(p.id)}" title="How many do you have?"><div style="flex:1;min-width:0"><div class="cbName">${esc(p.name)}</div><div class="cbMeta">${esc(typeOf(p).name)}${p.id?' · '+esc(p.id):''}</div></div></div>`;}).join('');
    updateCbCount();
  }
  function updateCbCount(){
    const stock=getStock();
    const ids=Object.entries(stock).filter(([,q])=>q>0);
    const parts=ids.length,units=ids.reduce((s,[,q])=>s+q,0);
    $('cbCount').textContent=parts===0?'Set a quantity above 0 for each part you own':
      parts===1?'1 part · '+units+' unit'+(units===1?'':'s') :
      parts+' parts · '+units+' total units';
  }
  $('cbList').addEventListener('input',e=>{
    const inp=e.target;if(!inp.classList.contains('cbQty')||!inp.dataset.cbid)return;
    const stock=getStock();
    const qty=Math.max(0,parseInt(inp.value,10)||0);
    inp.value=qty;
    if(qty>0)stock[inp.dataset.cbid]=qty;else delete stock[inp.dataset.cbid];
    setStock(stock);
    const row=inp.closest('.cbItem');
    if(row){row.classList.toggle('cbOwned',qty>0);inp.style.borderColor=qty>0?'#7048e8':'';}
    updateCbCount();
  });
  $('cbSearch').addEventListener('input',()=>{cbQuery=$('cbSearch').value;renderCookbook();});
  $('cbClear').onclick=()=>{if(getOwnedIds().length&&confirm('Clear all quantities?')){setStock({});renderCookbook();}};
  $('cbSave').onclick=()=>{
    const stock={};
    document.querySelectorAll('#cbList .cbQty').forEach(inp=>{
      if(!inp.dataset.cbid)return;
      const qty=Math.max(0,parseInt(inp.value,10)||0);
      if(qty>0)stock[inp.dataset.cbid]=qty;
    });
    setStock(stock);
    renderCookbook();
    WF.flash('✅ Cookbook saved — '+Object.keys(stock).length+' part'+(Object.keys(stock).length===1?'':'s')+' stored.');
  };
  $('cbClose').onclick=closeCookbook;
  $('cbX').onclick=closeCookbook;
  cbBack.addEventListener('keydown',e=>{if(e.key==='Escape')closeCookbook();e.stopPropagation();});
  cbBack.addEventListener('mousedown',e=>{if(e.target===cbBack)closeCookbook();});

  $('cbAsk').onclick=async()=>{
    if(cbBusy)return;
    // Flush any typed-but-not-yet-saved quantities before reading stock
    document.querySelectorAll('.cbQty').forEach(inp=>{
      if(!inp.dataset.cbid)return;
      const stock2=getStock();
      const qty=Math.max(0,parseInt(inp.value,10)||0);
      if(qty>0)stock2[inp.dataset.cbid]=qty;else delete stock2[inp.dataset.cbid];
      setStock(stock2);
      const row=inp.closest('.cbItem');
      if(row){row.classList.toggle('cbOwned',qty>0);inp.style.borderColor=qty>0?'#7048e8':'';};
    });
    updateCbCount();
    const stock=getStock();
    const owned=Object.entries(stock).filter(([,q])=>q>0);
    if(!owned.length){WF.flash('Set at least one part quantity above 0 — the AI needs to know what you have.');return;}
    if(!aiKey()){if(window.WFEnclosure)WFEnclosure.askKey();return;}
    const ownedList=owned.map(([id,qty])=>{const p=partById(id);return p?{name:p.name,qty}:null;}).filter(Boolean);
    if(!ownedList.length){WF.flash('No recognised parts found.');return;}
    cbBusy=true;$('cbAsk').disabled=true;$('cbAsk').textContent='Thinking…';
    $('cbAiResult').classList.remove('on');$('cbAiResult').innerHTML='';
    try{
      const prompt=`You are an expert electronics engineer and maker. The user has these electronic parts in their stock at home (name · quantity available):\n${ownedList.map((x,i)=>`${i+1}. ${x.name} × ${x.qty}`).join('\n')}\n\nSuggest up to 6 fun projects they could build RIGHT NOW using only parts from this list (quantities matter — never require more of a part than the user has). For each project:\n- Give it a short catchy name\n- One clear sentence explaining what it does and why it is useful\n- List which parts from their stock it uses, with quantities needed\n\nOutput ONLY valid JSON (no other text): {"projects":[{"name":"...","description":"...","parts":["part name",...]},...]}\``;
      const {data}=await callAI(prompt);
      if(!data||!Array.isArray(data.projects)||!data.projects.length)throw new Error('No projects in response — try rephrasing or check your AI key.');
      const html=`<h4>Here are ${data.projects.length} project${data.projects.length>1?'s':''} you can build today:</h4><ol>${data.projects.map((p,i)=>`<li style="margin-bottom:10px"><span class="cbIdeaTitle">${esc(p.name||'')}</span> — ${esc(p.description||'')}${p.parts&&p.parts.length?'<br><small style="color:var(--muted)">Uses: '+p.parts.map(n=>esc(n)).join(', ')+'</small>':''}<br><button class="cbBuildBtn" data-cbidx="${i}" style="margin-top:5px;padding:3px 10px;font-size:12px;border-radius:5px;border:1px solid #7048e8;background:color-mix(in srgb,#7048e8 12%,var(--bg2));color:#7048e8;cursor:pointer">Build this →</button></li>`).join('')}</ol>`;
      $('cbAiResult').innerHTML=html;$('cbAiResult').classList.add('on');
      // store projects for click handler
      $('cbAiResult')._cbProjects=data.projects;
    }catch(e){
      console.error('Cookbook AI error',e);
      $('cbAiResult').innerHTML=`<div style="color:var(--err,#b03a3a)">Couldn't get ideas: ${esc(e&&e.message||'AI error')}. Check your AI key and internet connection.</div>`;
      $('cbAiResult').classList.add('on');
    }finally{
      cbBusy=false;$('cbAsk').disabled=false;$('cbAsk').textContent='💡 What can I build?';
    }
  };

  // "Build this →" click handler — opens intent wizard pre-filled with the chosen project
  $('cbAiResult').addEventListener('click',e=>{
    const btn=e.target.closest('.cbBuildBtn');if(!btn)return;
    const idx=parseInt(btn.dataset.cbidx,10);
    const projects=$('cbAiResult')._cbProjects;
    if(!projects||!projects[idx])return;
    const p=projects[idx];
    const text=(p.name?p.name+': ':'')+p.description;
    // pre-fill the intent wizard description
    iw.w={text,does:[],pf:'auto',noShow:false};iw.err='';iw.step='w1';
    closeCookbook();
    iwBack.style.display='grid';renderIntent();
    WF.flash('💡 Project loaded — describe it more if you like, then click Next →');
  });

  // Expose owned-parts note for injection into other AI prompts
  window.ownedPartsNote=function(){
    const stock=getStock();
    const owned=Object.entries(stock).filter(([,q])=>q>0);
    if(!owned.length)return '';
    const list=owned.map(([id,qty])=>{const p=partById(id);return p?`${p.name} (qty: ${qty})`:null;}).filter(Boolean);
    if(!list.length)return '';
    return `\n\nThe user already owns these parts at home with quantities — PREFER these over other options when they fit the project, and respect the quantities available:\n${list.map((s,i)=>`${i+1}. ${s}`).join('\n')}`;
  };
}

// (r1) Read the wizard settings and own parts again after a saved project (version 2 file) put its own back.
function reloadState(){
  custom=readCustom();injectPhotos(custom);wiz=readWiz();lay=null;WF.setGhosts([]);
  if(ewBack.style.display==='grid')openWizard();
  if(wrBack.style.display==='grid')openWiring();
  if(plBack.style.display==='grid'&&!edDirty)renderList();
  updateStrip();
}
// ---- (wizard-r2) The guide: one step at a time (Parts → Box → Wiring → Code → Open in IDE), always with Back and Next.
var gStep=null;// 'box' | 'wiring' | 'code' | 'ready' | null
const G_STEPS=[['parts','Parts'],['box','Box'],['wiring','Wiring'],['code','Code'],['ide','On the board']];
document.body.insertAdjacentHTML('beforeend','<div id="wfGuide" role="region" aria-label="Your next step" aria-live="polite"></div>');
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-copytext]');if(b)copyText(b.dataset.copytext);});
const ideName=pf=>pf==='esphome'?'ESPHome':pf==='raspberrypi'?'Thonny':'the Arduino IDE';
function drawGuide(){
  const g=$('wfGuide');if(!g)return;
  if(gStep==='ide'&&ho&&$('iwBack').style.display!=='grid'){if(g.parentNode!==document.body)document.body.appendChild(g);drawHandoff(g);return;}
  if(!gStep||gStep==='ready'||gStep==='ide'||!intentNow()||$('iwBack').style.display==='grid'){g.style.display='none';return;}
  const host=ewBack.style.display==='grid'?ewBack.querySelector('.ewFoot'):wrBack.style.display==='grid'?wrBack.querySelector('.ewFoot'):null;
  if(host){if(g.parentNode!==host){host.style.flexWrap='wrap';host.insertBefore(g,host.firstChild);}g.className='dock';}
  else{if(g.parentNode!==document.body)document.body.appendChild(g);g.className='float';}
  const idx=G_STEPS.findIndex(x=>x[0]===gStep);
  const strip=G_STEPS.map(([k,l],i)=>i<idx?`<span class="gd">${l} ✓</span>`:i===idx?`<b>${l}</b>`:l).join(' → ');
  let txt='',next='',dis=false;
  if(gStep==='box'){
    const has=WF.model.faces.length>0,open=ewBack.style.display==='grid';
    txt=open?(has?'Your box is made. Change something and click <b>Generate base + lid</b> again, or go on to the wiring.':'Your parts are in the box designer. Click <b>Generate base + lid</b> to make a box for them. Don\'t need a box? Skip it.')
      :(has?'Your box is ready in the 3D view: drag with the mouse to turn it. Download it for your 3D printer, then go on to the wiring.':'The box designer is closed. Click <b>← Back</b> to open it again, or go on to the wiring.');
    if(has)txt+='<div class="gBtns"><button id="gBox3mf" class="primary">⬇ Download the box (3MF)</button><button id="gBoxStl">⬇ STL</button></div>';
    next=has?'Next: Wiring →':'Skip the box. Next: Wiring →';
  }else if(gStep==='wiring'){
    let pw='';try{const P=planWiring();if(!P.error)pw=' It is powered by '+esc(POW_NAME[P.power]||POW_NAME.usb)+'.';}catch(e){console.warn('EvenUCan: guide could not read the wiring',e);}
    txt='Follow the <b>Wiring list</b>: join each pair of pins with a wire and tick it off.'+pw;
    next='Next: Code →';
  }else if(gStep==='code'){
    const c=currentCode(),pf=c?c.pf:null;
    txt=c?'Your code is written. Next, put it on your board with '+esc(ideName(pf))+'.':pfBusy?'Your AI is writing the code… this usually takes 10–60 seconds.':'Click <b>Write the code with AI</b> on the right. If it shows a red box, pick one of its choices first.';
    next='Next: '+openLabel(pf||'arduino')+' →';dis=!c;
  }
  g.innerHTML=`<div class="gStrip">${strip}</div><div>${txt}</div><div class="gBtns"><button id="gBack">← Back</button><button id="gNext" class="primary"${dis?' disabled title="Write the code first"':''}>${next}</button><button id="gRestart" class="linkBtn">Start again from the beginning</button></div>`;
  g.style.display='block';
}
function guideGo(s){
  gStep=s;
  if(s==='box'){closeWiring();openWizard();}
  else if(s==='wiring'){closeWizard();wr=Object.assign(wr||{},{tab:'list'});openWiring();}
  else if(s==='code'){closeWizard();intentCode();}
  drawGuide();
}
function guideReady(){gStep='ready';closeWizard();closeWiring();iw.welcome=false;iw.step='ready';iwBack.style.display='grid';renderIntent();}
async function guideRestart(){
  if(!await askConfirm('Start again from the beginning?\nWhat you have made so far stays in this project until you change it.'))return;
  gStep=null;closeWizard();closeWiring();iw.edit=false;iw.step='result';drawGuide();openWelcome(false);
}
$('wfGuide').addEventListener('click',async e=>{
  const id=e.target.id;
  if(id==='gNext'){
    if(gStep==='box')guideGo('wiring');else if(gStep==='wiring')guideGo('code');
    else if(gStep==='code'){if(!currentCode())return;await openInIde();}
  }else if(id==='gBack'){
    if(gStep==='box'){closeWizard();iw.step='result';iw.welcome=false;iwBack.style.display='grid';renderIntent();drawGuide();}
    else if(gStep==='wiring')guideGo('box');else if(gStep==='code')guideGo('wiring');
  }else if(id==='gRestart')guideRestart();
  else if(id==='hoDone')guideReady();
  else if(id==='gBox3mf')downloadBox('3mf');
  else if(id==='gBoxStl')downloadBox('stl');
  else if(id==='hoCopy'&&ho)copyText(ho.text);
  else if(id==='hoSave'&&ho){WF.download(ho.name,ho.text,'text/plain');WF.flash('Downloaded '+ho.name+' to your Downloads folder',5000);}
  else if(id==='hoFolder')openInIde(true);
  else if(id==='hoBack'){ho=null;guideGo('code');}
});
$('wfGuide').addEventListener('change',e=>{const i=e.target.dataset&&e.target.dataset.hotick;if(i===undefined||!ho)return;ho.ticks[i]=e.target.checked;e.target.closest('li').classList.toggle('done',e.target.checked);});
$('wfGuide').addEventListener('toggle',e=>{const i=e.target.dataset&&e.target.dataset.hohelp;if(i!==undefined&&ho)ho.open[i]=e.target.open;},true);
const readySlug=()=>esphSlug(esphForm().name||'my-device');
function readyParts(){
  const it=intentNow()||{},A=it.analysis||{};
  return 'EvenUCan parts list: '+(A.name||'my gadget')+'\n\nThe idea: '+(it.desc||'')+'\n\nParts:\n'+wiz.items.map(i=>{const p=partById(i.pid);return '  [ ] '+(i.qty>1?i.qty+' x ':'')+(p?p.name:i.pid);}).join('\n')+
    '\n\nPower: '+(POW_NAME[wiz.power]||POW_NAME.usb)+(wiz.power==='battery'?' (the box designer adds the battery, charger and on/off switch)':'')+(intentTopic()?'\n\nPhone messages: install the free ntfy app and subscribe to the topic "'+intentTopic()+'".':'')+'\n';
}
function readyWiring(){const o=wr;wr={plan:planWiring(),pos:{},hi:-1,tab:'list',chat:{msgs:[],busy:false}};try{if(!wr.plan.error){placeModules();linkNets();}return wiringText();}finally{wr=o;}}// a fresh plan with its wire links, without touching the open window
updateStrip();
window.WFEnclosure={askKey,openCodeGated,openWelcome,openWizard,openLibrary,openWiring,planWiring,esphomeYaml,fritzingData,engine,autoLayout,buildSolids,softEdges,outerSize,_runInGeoWorker,get layout(){return lay;},parts:allParts,reloadState,
  // (startup-r1) exposed so the main script's page-load call can invoke the startup screen
  openStartupChoice,openSetup};
})();
