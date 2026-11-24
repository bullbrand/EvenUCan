// EvenUCan Enclosure Wizard - 04-settings-and-strip.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- wizard settings
const WIZ_KEY='enclosure.wizard';
const DEFAULT_WIZ={items:[{pid:'b-esp32s3',qty:1,mount:'auto',wall:'auto'}],
  style:'compact',lid:'push',power:'usb',battery:'b-lipo1000',charger:'b-tp4056c',sw:true,swPart:'b-ss12',size:'auto',sW:80,sD:60,sH:40,wallT:'',gapOv:'',gasket:false};
const freshWiz=function freshWiz(){const w=clone(DEFAULT_WIZ);const b=prefBoard();if(b&&w.items&&w.items[0])w.items[0].pid=b;return w;};
const readWiz=()=>{try{const raw=WF.store.get(WIZ_KEY);if(!raw)return freshWiz();const w=JSON.parse(raw);if(w&&Array.isArray(w.items))return Object.assign(freshWiz(),w);}catch(e){console.error('EvenUCan: the Enclosure Wizard settings could not be read, starting from the defaults',e);}return freshWiz();};
let wiz=readWiz();
const saveWiz=()=>WF.store.set(WIZ_KEY,JSON.stringify(wiz));
const PROJ_KEY='evenucan.projects';
const PROJ_CUR='evenucan.currentProject';
// Projects are saved as files in the Projects folder (server.py). The browser keeps a copy as a fallback.
const projApi=function projApi(path,body){
  const opt=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
  return fetch(path,opt).then(r=>r.json()).catch(()=>null);
};
const projSnapshot=function projSnapshot(name){
  return {name,saved:Date.now(),wiz:clone(wiz),esph:WF.store.get(ESPH_KEY)||'',intent:WF.store.get(INTENT_KEY)||'',drawing:WF.store.get('autosave')||''};
};
const ewProjList=function ewProjList(){try{return JSON.parse(WF.store.get(PROJ_KEY)||'[]');}catch(e){return[];}};
const ewProjLocalSave=function ewProjLocalSave(entry){
  const projects=ewProjList();
  const i=projects.findIndex(p=>p.name===entry.name);
  const e={name:entry.name,saved:entry.saved,wiz:entry.wiz,esph:entry.esph,intent:entry.intent};
  if(i>=0)projects[i]=e;else projects.push(e);
  WF.store.set(PROJ_KEY,JSON.stringify(projects));
};
const ewProjSave=async function ewProjSave(name){
  if(!name||!name.trim()){WF.flash('Give the project a name first',3000);return;}
  name=name.trim();
  const entry=projSnapshot(name);
  ewProjLocalSave(entry);
  WF.store.set(PROJ_CUR,name);
  const r=await projApi('/api/projects/save',entry);
  ewProjRender();
  WF.flash(r&&r.ok?'Project "'+name+'" saved to your Projects folder':'Project "'+name+'" saved in this browser only (the Projects folder is not available)',4000);
};
// Auto-save: after each change to the drawing, the current project is saved to its file (if it has one).
window.projAutoSave=function projAutoSave(){
  const name=WF.store.get(PROJ_CUR);if(!name)return;
  projApi('/api/projects/save',projSnapshot(name));
};
let projRows=[];
const ewProjLoad=async function ewProjLoad(i){
  const row=projRows[i];if(!row)return;
  if(!confirm('Open "'+row.name+'"? The drawing on screen will be replaced.'))return;
  const r=await projApi('/api/projects/load?name='+encodeURIComponent(row.name));
  const p=(r&&r.name)?r:(ewProjList().find(x=>x.name===row.name)||null);
  if(!p){WF.flash('Could not open "'+row.name+'"',4000);return;}
  Object.assign(wiz,p.wiz||{});saveWiz();
  if(p.esph)WF.store.set(ESPH_KEY,p.esph);
  if(p.intent)WF.store.set(INTENT_KEY,p.intent);
  if(p.drawing)WF.store.set('autosave',p.drawing);
  WF.store.set(PROJ_CUR,p.name);
  location.reload();   // the drawing is restored from the saved copy when the app starts
};
const ewProjDelete=async function ewProjDelete(i){
  const row=projRows[i];if(!row||!confirm('Delete "'+row.name+'"?'))return;
  await projApi('/api/projects/delete',{name:row.name});
  WF.store.set(PROJ_KEY,JSON.stringify(ewProjList().filter(p=>p.name!==row.name)));
  if(WF.store.get(PROJ_CUR)===row.name)WF.store.set(PROJ_CUR,'');
  ewProjRender();
};
const ewProjRender=async function ewProjRender(){
  const list=$('ewProjList');if(!list)return;
  const r=await projApi('/api/projects');
  projRows=(r&&r.projects)?r.projects:ewProjList().map(p=>({name:p.name,saved:p.saved}));
  const where=(r&&r.dir)?'<div class="u-mb-4 ewNote">Saved in: '+esc(r.dir)+' <button onclick="projChangeFolder()" class="u-btn-sm">Change folder…</button></div>':'';
  if(!projRows.length){list.innerHTML=where+'<div class="ewNote">No saved projects yet. Use Save to keep one.</div>';return;}
  list.innerHTML=where+projRows.map((p,i)=>`<div class="u-proj-row ewRow"><span class="u-proj-name">${esc(p.name)}</span><span class="ewNote">${new Date(p.saved).toLocaleDateString()}</span><button onclick="ewProjLoad(${i})" class="u-btn-sm">Load</button><button onclick="ewProjDelete(${i})" class="u-btn-sm u-danger-text">Delete</button></div>`).join('');
};
// Save button: the first time, name the project; after that, Save keeps it up to date in the Projects folder.
document.addEventListener('DOMContentLoaded',()=>{
  const b=document.getElementById('bSave');if(!b)return;
  b.addEventListener('click',()=>{
    if(!WF.store.get(PROJ_CUR)){const n=prompt('Name this project. It is saved to your Projects folder as you work:','My project');if(n&&n.trim())ewProjSave(n);}
    else projAutoSave();
  });
});
// First run (desktop app): ask once where projects are kept.
const PROJ_ASKED='evenucan.projectsAsked';
// Records the answer (the flag): once set, the question is never asked again. dir is optional: none means the default folder.
window.projAnswer=async function projAnswer(dir){
  if(!dir){const r=await projApi('/api/projects');dir=r&&r.dir;}
  if(dir)await projApi('/api/projects/dir',{dir});
  WF.store.set(PROJ_ASKED,'done');
  ewProjRender();
};
window.projChoose=async function projChoose(){
  if(!window.wfNative||!window.wfNative.chooseFolder){WF.flash('Choosing a folder needs the desktop app',4000);return;}
  const c=await window.wfNative.chooseFolder('projects');
  if(c&&c.ok&&c.dir)await window.projAnswer(c.dir);
};
// Old users (the setup is not shown to them): a one-time popup, skipped once the question has been answered.
const projFirstRun=async function projFirstRun(){
  if(!window.wfNative||!window.wfNative.chooseFolder)return;
  if(WF.store.get(PROJ_ASKED)==='done')return;
  if($('suBack')&&$('suBack').style.display==='grid')return;   // the new-user setup is open: it asks this question itself
  const r=await projApi('/api/projects');if(!r||r.chosen){if(r&&r.chosen)WF.store.set(PROJ_ASKED,'done');return;}
  const box=document.createElement('div');
  box.id='projFirst';
  box.className='u-backdrop';
  box.innerHTML='<div class="u-card">'+
    '<div style="font-size:17px;font-weight:700;margin-bottom:8px">📁 Where should EvenUCan keep your projects?</div>'+
    '<div style="font-size:13px;line-height:1.5;margin-bottom:14px">Each project is saved as a file in this folder, so it is kept even if the browser data is cleared:<br><b>'+esc(r.dir)+'</b></div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button id="pfChoose">Choose a different folder…</button><button id="pfUse" class="primary">Use this folder</button></div></div>';
  document.body.appendChild(box);
  const done=async(dir)=>{await window.projAnswer(dir);box.remove();};
  box.querySelector('#pfUse').onclick=()=>done(r.dir);
  box.querySelector('#pfChoose').onclick=async()=>{const c=await window.wfNative.chooseFolder('projects');if(c&&c.ok&&c.dir)done(c.dir);};
};
// Change the Projects folder (desktop app): pick a folder, then the projects are kept there from now on.
const projChangeFolder=async function projChangeFolder(){
  if(!window.wfNative||!window.wfNative.chooseFolder){WF.flash('Choosing a folder needs the desktop app',4000);return;}
  const c=await window.wfNative.chooseFolder('projects');
  if(c&&c.ok&&c.dir){await window.projAnswer(c.dir);WF.flash('Projects will be kept in '+c.dir,4000);}
};
document.addEventListener('DOMContentLoaded',()=>setTimeout(projFirstRun,1200));
// Warm up the local AI in the background, so the first question does not wait for the model to load.
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>projApi('/api/ai/warm',{}),4000));
// ---- (wizard-r1) Has the user chosen parts? The Enclosure Wizard shows example parts until a choice is saved,
// and the library always has its built-in parts, so "parts" means a saved Enclosure Wizard list with something in it.
const hasParts=()=>!!WF.store.get(WIZ_KEY)&&wiz.items.length>0;
const NEED_PARTS='Add some parts first — use the Enclosure Wizard or the Parts Library.';
// Soft gates: a nudge, never a block (the window still opens).
const openWiringGated=function openWiringGated(){if(!hasParts())WF.flash(NEED_PARTS,5000);openWiring();};
const openCodeGated=function openCodeGated(){if(!hasParts())WF.flash(NEED_PARTS,5000);wr=Object.assign(wr||{},{tab:'esphome'});openWiring();};
// ---- (wizard-r1) Workflow strip above the 3D view, worked out from what the project really has.
// Done = that step's work exists; the first step not done is the current one; the steps after it are locked.
const STRIP=[
  {k:'idea',icon:'💡',label:'Idea',open:()=>openIntent(),hint:'describe your gadget: click 💡 Idea.'},
  {k:'parts',icon:'📦',label:'Parts',open:()=>openWizard(),hint:'choose your parts: click 📦 Parts (the Enclosure Wizard).'},
  {k:'box',icon:'🏠',label:'Box',open:()=>openWizard(),hint:'design the box: click 🏠 Box and put it into your drawing.'},
  {k:'wiring',icon:'🔌',label:'Wiring',open:()=>openWiringGated(),hint:'work out the wiring: click 🔌 Wiring.'},
  {k:'code',icon:'💻',label:'Code',open:()=>openCodeGated(),hint:'get the code: click 💻 Code.'},
  {k:'done',icon:'✅',label:'Done',open:()=>WF.flash('All done! Save your project, and export the box for your 3D printer.',5000),hint:'finish the steps before it.'}];
let stripT=null,stripAct=-1;
const stripState=function stripState(){
  const parts=hasParts();let wired=false;
  if(parts){try{wired=!planWiring().error;}catch(e){console.warn('EvenUCan: progress strip could not check the wiring',e);}}
  let coded=false;
  if(wired){try{const P=planWiring();coded=pfOfPlan(P)==='esphome'?!!WF.store.get(ESPH_KEY):pfFresh(P);}catch(e){console.warn('EvenUCan: progress strip could not check the code',e);}}
  const box=WF.model.faces.length>0;
  return {idea:!!intentNow(),parts,box,wiring:wired,code:coded,done:coded&&box};
};
const drawStrip=function drawStrip(){
  const el=$('wfStrip');if(!el)return;
  let s;try{s=stripState();}catch(e){console.warn('EvenUCan: progress strip',e);return;}
  const show=s.idea||s.parts;
  el.classList.toggle('on',show);el.setAttribute('aria-hidden',show?'false':'true');
  if(!show){el.innerHTML='';stripAct=-1;return;}
  stripAct=STRIP.findIndex(x=>!s[x.k]);
  el.innerHTML='<span class="ewNote wsLead">Your progress:</span>'+STRIP.map((x,i)=>{
    const st=s[x.k]?'done':i===stripAct?'active':'locked';
    const tip=st==='locked'?'Not yet: first '+STRIP[stripAct].hint:st==='done'?x.label+': done. Click to open it again.':x.label+': this is the next step. Click to open it.';
    return (i?'<span class="wsArr" aria-hidden="true">→</span>':'')+`<button data-ws="${i}" class="${st}" title="${esc(tip)}"${st==='active'?' aria-current="step"':''}><span aria-hidden="true">${x.icon}</span><span class="wsL">${esc(x.label)}</span>${st==='done'?'<span class="wsTick" aria-label="done">✓</span>':''}</button>`;
  }).join('');
};
const updateStrip=function updateStrip(){clearTimeout(stripT);stripT=setTimeout(()=>{drawStrip();drawGuide();},250);};
window.wfUpdateStrip=updateStrip;
$('wfStrip').addEventListener('click',e=>{
  const b=e.target.closest('button[data-ws]');if(!b)return;
  const x=STRIP[+b.dataset.ws];if(!x)return;
  if(b.classList.contains('locked')){WF.flash('Not yet: first '+(STRIP[stripAct]||x).hint,5000);return;}
  x.open();
});
const styleNow=function styleNow(){
  const s=Object.assign({},STYLES[wiz.style]||STYLES.compact);
  const wt=num(wiz.wallT,0);if(wt>=0.8){s.wall=wt;s.floor=wt;}
  const g=num(wiz.gapOv,-1);if(g>=0)s.gap=g;
  s.lid=LIDS[wiz.lid]?wiz.lid:s.lid;s.key=wiz.style;s.gasket=!!wiz.gasket;
  return s;
};
const instances=function instances(){
  const out=[];let k=0;
  const add=(p,o,auto)=>{if(p)out.push({key:'i'+(k++),part:p,mount:(o&&o.mount)||'auto',wall:(o&&o.wall)||'auto',auto:!!auto});};
  for(const it of wiz.items){const p=partById(it.pid),n=Math.max(1,Math.min(10,Math.round(num(it.qty,1))));for(let q=0;q<n;q++)add(p,it);}
  if(wiz.power==='battery'){add(partById(wiz.battery),null,true);if(wiz.charger)add(partById(wiz.charger),null,true);if(wiz.sw&&wiz.swPart)add(partById(wiz.swPart),null,true);}
  return out;
};
