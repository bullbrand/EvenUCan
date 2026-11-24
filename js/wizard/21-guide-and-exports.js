// EvenUCan Enclosure Wizard - 21-guide-and-exports.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- (wizard-r2) The guide: one step at a time (Parts → Box → Wiring → Code → Open in IDE), always with Back and Next.
let gStep=null;// 'box' | 'wiring' | 'code' | 'ready' | null
let boxStale=false;// (box-stale) true when in box step without a freshly generated model
const G_STEPS=[['parts','Parts'],['box','Box'],['wiring','Wiring'],['code','Code'],['ide','On the board']];
document.body.insertAdjacentHTML('beforeend','<div id="wfGuide" role="region" aria-label="Your next step" aria-live="polite"></div>');
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-copytext]');if(b)copyText(b.dataset.copytext);});
const ideName=pf=>pf==='esphome'?'ESPHome':pf==='raspberrypi'?'Thonny':'the Arduino IDE';
const drawGuide=function drawGuide(){
  const g=$('wfGuide');if(!g)return;
  const _iwb=$('iwBack');if(gStep==='ide'&&ho&&(!_iwb||_iwb.style.display!=='grid')){if(g.parentNode!==document.body)document.body.appendChild(g);drawHandoff(g);return;}
  if(!gStep||gStep==='ready'||gStep==='ide'||!intentNow()||(_iwb&&_iwb.style.display==='grid')){g.style.display='none';return;}
  const host=ewBack.style.display==='grid'?ewBack.querySelector('.ewFoot'):wrBack.style.display==='grid'?wrBack.querySelector('.ewFoot'):null;
  if(host){if(g.parentNode!==host){host.style.flexWrap='wrap';host.insertBefore(g,host.firstChild);}g.className='dock';}
  else{if(g.parentNode!==document.body)document.body.appendChild(g);g.className='float';}
  const idx=G_STEPS.findIndex(x=>x[0]===gStep);
  const strip=G_STEPS.map(([k,l],i)=>i<idx?`<span class="gd">${l} ✓</span>`:i===idx?`<b>${l}</b>`:l).join(' → ');
  let txt='',next='',dis=false,showNext=true;
  if(gStep==='box'){
    const has=WF.model.faces.length>0,open=ewBack.style.display==='grid';
    txt=open?(has?'Your box is made. Change something and click <b>Generate base + lid</b> again, or go on to the wiring.':'Your parts are in the box designer. Click <b>↑ Generate base + lid</b> in the toolbar above to make a box for them.')
      :(has?'Your box is ready in the 3D view: drag with the mouse to turn it. Download it for your 3D printer, then go on to the wiring.':'The box designer is closed. Click <b>← Back</b> to open it again.');
    if(has)txt+='<div class="gBtns"><button id="gBox3mf">⬇ Download the box (3MF)</button><button id="gBoxStl">⬇ STL</button></div>';
    next=has?'Next: Wiring →':'';
    showNext=has;
    const genBtn=$('ewGen');if(genBtn)genBtn.classList.toggle('ewGenPulse',open&&!has);// no Next until the box is generated
  }else if(gStep==='wiring'){
    let pw='';try{const P=planWiring();if(!P.error)pw=' It is powered by '+esc(POW_NAME[P.power]||POW_NAME.usb)+'.';}catch(e){console.warn('EvenUCan: guide could not read the wiring',e);}
    txt='Follow the <b>Wiring list</b>: join each pair of pins with a wire and tick it off.'+pw;
    next='Next: Code →';
  }else if(gStep==='code'){
    const c=currentCode(),pf=c?c.pf:null;
    txt=c?'Your code is written. Next, put it on your board with '+esc(ideName(pf))+'.':pfBusy?'Your AI is writing the code… this usually takes 10–60 seconds.':'Click <b>Write the code with AI</b> on the right. If it shows a red box, pick one of its choices first.';
    next='Next: '+openLabel(pf||'arduino')+' →';dis=!c;
  }
  g.innerHTML=`<div class="gStrip">${strip}</div><div>${txt}</div><div class="gBtns"><button id="gBack">← Back</button>${showNext?`<button id="gNext" class="primary"${dis?' disabled title="Write the code first"':''}>${next}</button>`:''}<button id="gRestart" class="linkBtn">Start again from the beginning</button></div>`;
  g.style.display='block';
};
const guideGo=function guideGo(s){
  gStep=s;
  if(s==='box'){boxStale=true;closeWiring();openWizard();}
  else if(s==='wiring'){closeWizard();wr=Object.assign(wr||{},{tab:'list'});openWiring();}
  else if(s==='code'){closeWizard();wr=Object.assign(wr||{},{tab:'esphome'});openWiring();}
  drawGuide();
};
const guideReady=function guideReady(){gStep='ready';closeWizard();closeWiring();if(_int.iw)_int.iw.welcome=false;iw.step='ready';iwBack.style.display='grid';renderIntent();};
const guideRestart=async function guideRestart(){
  if(!await askConfirm('Start again from the beginning?\nWhat you have made so far stays in this project until you change it.'))return;
  gStep=null;closeWizard();closeWiring();if(_int.iw){_int.iw.edit=false;_int.iw.step='result';}drawGuide();openWelcome(false);
};
$('wfGuide').addEventListener('click',async e=>{
  const id=e.target.id;
  if(id==='gNext'){
    if(gStep==='box')guideGo('wiring');else if(gStep==='wiring')guideGo('code');
    else if(gStep==='code'){if(!currentCode())return;await openInIde();}
  }else if(id==='gBack'){
    if(gStep==='box'){closeWizard();iw.step='result';if(_int.iw)_int.iw.welcome=false;iwBack.style.display='grid';renderIntent();drawGuide();}
    else if(gStep==='wiring')guideGo('box');else if(gStep==='code')guideGo('wiring');
  }else if(id==='gRestart')guideRestart();
  else if(id==='hoDone')guideReady();
  else if(id==='gBox3mf')downloadBox('3mf');
  else if(id==='gBoxStl')downloadBox('stl');
  else if(id==='hoCopy'&&ho)copyText(ho.text);
  else if(id==='hoSave'&&ho){WF.download(ho.name,ho.text,'text/plain');WF.flash('Downloaded '+ho.name+' to your Downloads folder',5000);}
  else if(id==='hoSaveProject'){WF.saveFile&&WF.saveFile();}
  else if(id==='hoFolder')openInIde(true);
  else if(id==='hoBack'){ho=null;guideGo('code');}
});
$('wfGuide').addEventListener('change',e=>{const i=e.target.dataset&&e.target.dataset.hotick;if(i===undefined||!ho)return;ho.ticks[i]=e.target.checked;e.target.closest('li').classList.toggle('done',e.target.checked);});
$('wfGuide').addEventListener('toggle',e=>{const i=e.target.dataset&&e.target.dataset.hohelp;if(i!==undefined&&ho)ho.open[i]=e.target.open;},true);
const readySlug=()=>esphSlug(esphForm().name||'my-device');
const readyParts=function readyParts(){
  const it=intentNow()||{},A=it.analysis||{};
  return 'EvenUCan parts list: '+(A.name||'my gadget')+'\n\nThe idea: '+(it.desc||'')+'\n\nParts:\n'+wiz.items.map(i=>{const p=partById(i.pid);return '  [ ] '+(i.qty>1?i.qty+' x ':'')+(p?p.name:i.pid);}).join('\n')+
    '\n\nPower: '+(POW_NAME[wiz.power]||POW_NAME.usb)+(wiz.power==='battery'?' (the box designer adds the battery, charger and on/off switch)':'')+(intentTopic()?'\n\nPhone messages: install the free ntfy app and subscribe to the topic "'+intentTopic()+'".':'')+'\n';
};
const readyWiring=function readyWiring(){const o=wr;wr={plan:planWiring(),pos:{},hi:-1,tab:'list',chat:{msgs:[],busy:false}};try{if(!wr.plan.error){placeModules();linkNets();}return wiringText();}finally{wr=o;}};// a fresh plan with its wire links, without touching the open window
updateStrip();

// Export closure references onto _int for extracted sub-modules (ai-and-surgery, cookbook-and-backup)
Object.assign(_int, {
  allParts, partById, builtinById, newPartId, tidyPart, saveLib,
  aiKey, aiProv, askKey, aiRead, claude, gemini, oaAI, PROVIDERS, OA, isOA, getVisionFailoverList,
  readWiz, saveWiz, ewBack, plBack, openWizard, closeWizard,
  openLibrary, closeLibrary, updateStrip, ewProjRender,
  wrBack, openWiring, closeWiring, openWiringGated, planWiring,
  PLATFORMS, pfOk, pfNorm, CTRL_PARTS, CTRL_IDS, ctrlPart, pfMatches,
  esphomeYaml, esphForm, esphSlug, downloadBox, TYPES, BUILTIN,
  idbGet, idbSet, WIZ_KEY, searchParts, _cdStart, _cdStop,
  ESPH_KEY, ESPH_AI_KEY, ensureLibraryReady, accOf,
  drawGuide, openInIde, currentCode, copyText, POW_NAME,
  netNeeded, NO_NET, NET_RE, PHONE_RE, wifiMem, capIssues, capHtml, ntfyBox, openLabel, toolName, yq,
  get ho() { return ho; },
  set ho(v) { ho = v; }
});


// Explicit direct window functions
window.openWizard = openWizard;
window.openLibrary = openLibrary;
window.openWiring = openWiring;
window.openWiringGated = openWiringGated;
window.askKey = askKey;
window.openCodeGated = openCodeGated;

// Expose public API on window.WFEnclosure while preserving _internal
window.WFEnclosure = Object.assign(window.WFEnclosure || {}, {
  askKey,openCodeGated,openWelcome,openWizard,openLibrary,openWiring,planWiring,esphomeYaml,fritzingData,engine,autoLayout,buildSolids,softEdges,outerSize,_runInGeoWorker,parts:allParts,reloadState,
  openStartupChoice,openSetup,
  _internal: _int
});
Object.defineProperty(window.WFEnclosure, 'layout', {
  get(){ return lay; },
  configurable: true,
  enumerable: true
});

// (box-stale) Block main toolbar Export buttons when the box step has uncommitted changes
(function(){
  const wrap=id=>{
    const btn=$(id);if(!btn)return;
    const orig=btn.onclick;
    btn.onclick=function(e){
      if(boxStale&&gStep==='box'){
        WF.flash('Generate the box first — the current model is from a previous session.',5000);
        return;
      }
      if(orig)orig.call(this,e);
    };
  };
  wrap('b3mf');wrap('bStl');
})();

// (bridge) names other files use
Object.defineProperty(_int,'bwDetected',{get:()=>bwDetected,configurable:true});
_int.BW_PART = BW_PART; _int.bwDesc = bwDesc; _int.bwName = bwName; _int.bwStart = bwStart; _int.prefBoard = prefBoard; _int.prefBoardFamily = prefBoardFamily;
Object.defineProperty(_int,'photoFrom',{get:()=>photoFrom,set:v=>{photoFrom=v},configurable:true});
_int.applyFritzing = applyFritzing;
_int.applyFritzingData = applyFritzingData;
_int.guideGo = guideGo;
_int.guideRestart = guideRestart;
_int.intentTopic = intentTopic;
_int.keyLabel = keyLabel;
_int.partsSource = partsSource;
Object.defineProperty(_int,'photoKind',{get:()=>photoKind,set:v=>{photoKind=v},configurable:true});
_int.readyParts = readyParts;
_int.readySlug = readySlug;
_int.readyWiring = readyWiring;
_int.savePart = savePart;
_int.setHint = setHint;
