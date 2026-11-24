(function(){
'use strict';
const _int = window.WFEnclosure && window.WFEnclosure._internal;
if (!_int) return;
const {
  WF, $, esc, clone, num, fx, snap,
  allParts, partById, builtinById,
  readWiz, saveWiz, ewBack, plBack, openWizard, closeWizard,
  openLibrary, closeLibrary, updateStrip,
  wrBack, openWiring, closeWiring, openWiringGated,
  idbGet, idbSet
} = _int;

const typeOf = _int.typeOf || (p => (_int.TYPES && _int.TYPES[p.type]) || {});
const ideName = _int.ideName || (pf => pf === 'esphome' ? 'ESPHome' : pf === 'raspberrypi' ? 'Thonny' : 'the Arduino IDE');
const NOAI_EX = _int.NOAI_EX || window.NOAI_EX || [];

const iwBack = _int.iwBack || $('iwBack');
const closeIntent = (...args) => _int.closeIntent && _int.closeIntent(...args);
const drawGuide = (...args) => _int.drawGuide && _int.drawGuide(...args);

// ---- (backup-r1) Backup and restore. Everything the user makes (parts, photos, recipes, projects, the drawing in progress, settings)
// lives in this browser's own storage, so a Windows reinstall or "clear browsing data" would lose it. This makes a copy they can keep
// somewhere safe: a file (one click), and optionally an automatic copy in a folder they choose (Edge / Chrome).
// AI keys, passwords and Wi-Fi details are never put in the file, so it is safe to email or share.
const BK_KEEP=/^(opensketch\.|evp\.|ev\.)/,BK_SECRET=/key|token|secret|pass|ssid|wifi/i;
const BK_WORK=/^(opensketch\.(autosave|evenucan\.projects|parts\.\d|recipes|cookbook|enclosure\.wizard|esphome|intent)|evp\.)/;
const bkDay=()=>new Date().toISOString().slice(0,10);
function bkCollect(){
  const o={};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(BK_KEEP.test(k)&&!BK_SECRET.test(k))o[k]=localStorage.getItem(k);}}catch(e){console.warn('EvenUCan: could not read the saved work for a backup',e);}
  return o;
}
function bkHasWork(){
  const o=bkCollect();return Object.keys(o).some(k=>BK_WORK.test(k)&&o[k]&&!/^(\[\]|\{\}|null|"")$/.test(o[k]));
}
function bkText(){return JSON.stringify({kind:'evenucan-backup',version:1,app:typeof window.APP_VERSION!=='undefined'?window.APP_VERSION:'',saved:new Date().toISOString(),items:bkCollect()});}
function bkFileName(){return 'EvenUCan backup '+bkDay()+'.json';}
function bkDownload(){
  WF.download(bkFileName(),bkText(),'application/json');
  WF.store.set('last_backup',String(Date.now()));
}
const bkAgo=ms=>{const d=Math.floor((Date.now()-ms)/864e5);return d<=0?'today':d===1?'yesterday':d+' days ago';};
// ---- the automatic folder copy
const bk={dir:null,perm:'none',name:'',lastHash:'',lastTime:0};
const bkHash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return s.length+':'+h;};
async function bkWriteFile(dir,name,text){
  const fh=await dir.getFileHandle(name,{create:true}),w=await fh.createWritable();await w.write(text);await w.close();
}
async function bkWriteFolder(force){
  if(!bk.dir||bk.perm!=='granted')return false;
  const text=bkText(),h=bkHash(JSON.stringify(bkCollect()));
  if(!force&&h===bk.lastHash)return true;
  try{
    await bkWriteFile(bk.dir,'EvenUCan backup (latest).json',text);
    if(WF.store.get('folder_day')!==bkDay()){await bkWriteFile(bk.dir,bkFileName(),text);WF.store.set('folder_day',bkDay());}// one dated copy a day
    bk.lastHash=h;bk.lastTime=Date.now();WF.store.set('last_backup',String(bk.lastTime));return true;
  }catch(e){console.warn('EvenUCan: the backup folder could not be written to',e);bk.perm='error';return false;}
}
async function bkLoadFolder(){
  if(!window.showDirectoryPicker)return;
  try{
    const h=await idbGet('backupDir');if(!h)return;
    bk.dir=h;bk.name=h.name||'';
    bk.perm=await h.queryPermission({mode:'readwrite'});
    if(bk.perm==='granted')bkWriteFolder(false);
  }catch(e){console.warn('EvenUCan: could not open the saved backup folder',e);}
}
async function bkChooseFolder(){
  try{
    const h=await window.showDirectoryPicker({id:'evenucan-backup',mode:'readwrite',startIn:'documents'});
    await idbSet('backupDir',h);bk.dir=h;bk.name=h.name||'';bk.perm='granted';bk.lastHash='';
    const ok=await bkWriteFolder(true);
    WF.flash(ok?'✅ Automatic backup is on. Your work is copied to the folder "'+bk.name+'".':'Could not save into that folder. Pick another one.',7000);
  }catch(e){if(e&&e.name!=='AbortError')WF.flash('Could not use that folder.',5000);}
}
async function bkAllowFolder(){
  try{bk.perm=await bk.dir.requestPermission({mode:'readwrite'});if(bk.perm==='granted'){await bkWriteFolder(true);WF.flash('✅ Automatic backup is back on.',5000);}}catch(e){console.warn('EvenUCan: backup folder permission',e);}
}
async function bkStopFolder(){try{await idbSet('backupDir',null);}catch(e){}bk.dir=null;bk.perm='none';bk.name='';}
setInterval(()=>{if(!document.hidden)bkWriteFolder(false);},5*60*1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)bkWriteFolder(false);});
// ---- the window
document.body.insertAdjacentHTML('beforeend','<div id="bkBack" class="ewBack"><div class="ewWin" role="dialog" aria-modal="true" aria-labelledby="bkTitle" style="width:min(560px,calc(100vw - 20px));height:auto;max-height:calc(100vh - 20px)">'+
  '<div class="ewHead"><h2 id="bkTitle">🛟 Keep your work safe</h2><button id="bkX" class="u-fs-18 x" title="Close (Esc)">✕</button></div>'+
  '<div id="bkBody" style="padding:12px 16px 16px;overflow:auto;font-size:14px;line-height:1.55"></div></div></div>');
const bkBack=$('bkBack');
function bkRender(){
  const last=+WF.store.get('last_backup')||0,has=bkHasWork(),n=Object.keys(bkCollect()).length;
  const canFolder=!!window.showDirectoryPicker;
  let folder='';
  if(canFolder){
    folder='<div class="u-mt-12 efbox"><b>📁 Automatic copy in a folder</b>'+
      (bk.dir&&bk.perm==='granted'?'<div class="u-my-4 ok">✅ On. Copied to the folder “'+esc(bk.name)+'”'+(bk.lastTime?' (last saved '+new Date(bk.lastTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+')':'')+'.</div><button id="bkFolderOff">Turn it off</button>'
        :bk.dir?'<div class="u-my-4 warn">Your folder “'+esc(bk.name)+'” needs one click to carry on.</div><button id="bkFolderAllow" class="primary">Turn it back on</button> <button id="bkFolderOff">Forget this folder</button>'
        :'<div class="u-m4-0-8 ewNote">Pick a folder once. EvenUCan then keeps a fresh copy in it by itself, and you can forget about it. <b>Best: a folder that is copied to the internet for you:</b></div>'+
        '<ul class="ewNote" style="margin:0 0 8px;padding-left:20px"><li><b>OneDrive</b> (already on most Windows 11 computers): choose the <b>OneDrive</b> folder. Your <b>Documents</b> folder is often in OneDrive already: check for a small cloud sign beside it.</li>'+
        '<li><b>Google Drive / Google One</b>: install the free <b>Google Drive for desktop</b> from google.com/drive/download, sign in, then choose the <b>Google Drive</b> folder (it may be a drive letter such as G:).</li>'+
        '<li>Or a <b>USB stick</b> left plugged in.</li></ul><button id="bkFolder" class="primary">Choose a folder…</button>')+
      '</div>';
  }else folder='<div class="u-mt-12 ewNote">Your browser cannot keep an automatic copy in a folder. Use Edge or Chrome for that, or make a backup file now and then.</div>';
  $('bkBody').innerHTML=
    '<p class="u-m0-8">Everything you make here (your parts, photos, recipes, projects and the drawing you are on) is kept <b>inside this browser, on this computer</b>. If Windows is reinstalled, or the browser\'s data is cleared, it is <b>gone</b>.</p>'+
    '<p style="margin:0 0 10px">A backup is a small file. Keep it <b>somewhere that is not on this computer</b>: a USB stick, <b>OneDrive</b>, <b>Google Drive</b> (your Google One storage), or email it to yourself.</p>'+
    '<div class="efbox"><b>⬇ Back up everything now</b>'+
      '<div class="u-m4-0-8 ewNote">'+(last?'Last backup: '+bkAgo(last)+' ('+new Date(last).toLocaleDateString()+').':'<span class="warn">You have not made a backup yet.</span>')+(has?'':' (There is not much to save yet.)')+'</div>'+
      '<button id="bkNow" class="primary">⬇ Save my backup file</button> <span class="ewNote">'+n+' items</span></div>'+
    folder+
    '<div class="u-mt-12 efbox"><b>⬆ Put a backup back</b><div class="u-m4-0-8 ewNote">After a reinstall: install EvenUCan, open this window, and choose your backup file. Everything comes back.</div><button id="bkRestore">⬆ Restore from a backup file…</button></div>'+
    '<div class="u-mt-10 ewNote">For safety, your AI keys and Wi-Fi passwords are <b>not</b> put in the file. You would type your free AI key in again after a restore.</div>';
}
function bkOpen(){bkRender();bkBack.style.display='grid';}
function bkClose(){bkBack.style.display='none';}
async function bkRestore(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0];if(!f)return;
    let d;try{d=JSON.parse(await f.text());}catch(e){return WF.flash('That file could not be read. Is it an EvenUCan backup?',6000);}
    if(!d||d.kind!=='evenucan-backup'||!d.items||typeof d.items!=='object')return WF.flash('That is not an EvenUCan backup file.',6000);
    const keys=Object.keys(d.items).filter(k=>BK_KEEP.test(k)&&!BK_SECRET.test(k)&&typeof d.items[k]==='string');
    if(!keys.length)return WF.flash('That backup file is empty.',6000);
    const when=d.saved?new Date(d.saved).toLocaleString():'an earlier time';
    if(!await _int.askConfirm('Put back the backup made on '+when+'?\n\nThis replaces the work in this browser with what is in the file. A copy of what you have now is saved to your Downloads folder first, just in case.'))return;
    try{WF.download('EvenUCan before restore '+bkDay()+'.json',bkText(),'application/json');}catch(e){console.warn('EvenUCan: could not save the safety copy',e);}
    try{
      const old=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(BK_KEEP.test(k)&&!BK_SECRET.test(k))old.push(k);}
      old.forEach(k=>localStorage.removeItem(k));// so no leftover pieces mix with the restored ones
      keys.forEach(k=>localStorage.setItem(k,d.items[k]));
      localStorage.setItem('opensketch.last_backup',String(Date.now()));
      // the app saves the drawing as the page closes: put the backup in once more AFTER that, so nothing overwrites it
      const again=()=>{try{keys.forEach(k=>localStorage.setItem(k,d.items[k]));}catch(e){console.warn('EvenUCan: could not re-apply the restored work',e);}};
      window.addEventListener('beforeunload',again);window.addEventListener('pagehide',again);
      try{setDirty(false);}catch(e){console.warn('EvenUCan: could not clear the unsaved flag',e);}
    }catch(e){console.error('EvenUCan: restore failed',e);return WF.flash('Could not put the backup back: this browser\'s storage is full or blocked.',8000);}
    WF.flash('✅ Backup put back ('+keys.length+' items). Reloading…',4000);
    setTimeout(()=>location.reload(),1200);
  };
  inp.click();
}
bkBack.addEventListener('click',async e=>{
  const id=e.target&&e.target.id;
  if(id==='bkX'||e.target===bkBack)bkClose();
  else if(id==='bkNow'){
    if(!bkHasWork()&&!await _int.askConfirm('There is not much to save yet. Make a backup file anyway?'))return;
    bkDownload();WF.flash('✅ Backup saved to your Downloads folder: '+bkFileName()+'. Now copy it somewhere safe (USB stick, OneDrive, email).',10000);bkRender();
  }
  else if(id==='bkRestore')bkRestore();
  else if(id==='bkFolder'){await bkChooseFolder();bkRender();}
  else if(id==='bkFolderAllow'){await bkAllowFolder();bkRender();}
  else if(id==='bkFolderOff'){await bkStopFolder();bkRender();}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bkBack.style.display==='grid')bkClose();});
$('bBackup').onclick=bkOpen;
// ---- a friendly nudge (a slim bar at the bottom, never a blocking box)
document.body.insertAdjacentHTML('beforeend','<div id="bkBar" role="status" style="display:none"></div>');
const bkBar=$('bkBar');
function bkNudge(){
  if(bkBack.style.display==='grid'||($('suBack')&&$('suBack').style.display==='grid'))return;
  if(bk.dir&&bk.perm==='prompt'){
    bkBar.innerHTML='<span>🛟 Your automatic backup needs one click to carry on.</span><button id="bkbAllow" class="primary">Turn it on</button><button id="bkbLater" class="linkBtn">Later</button>';bkBar.style.display='flex';return;
  }
  if(!bkHasWork()||(bk.dir&&bk.perm==='granted'))return;
  const now=Date.now(),last=+WF.store.get('last_backup')||0,first=+WF.store.get('first_seen')||now,snooze=+WF.store.get('backup_snooze')||0;
  if(now<snooze)return;
  const due=last?now-last>14*864e5:now-first>3*864e5;
  if(!due)return;
  bkBar.innerHTML='<span>🛟 '+(last?'You have not backed up your work for '+Math.floor((now-last)/864e5)+' days.':'Your work is not backed up yet.')+' It only takes a second.</span><button id="bkbNow" class="primary">Back up now</button><button id="bkbLater" class="linkBtn">Remind me next week</button>';
  bkBar.style.display='flex';
}
bkBar.addEventListener('click',async e=>{
  const id=e.target&&e.target.id;
  if(id==='bkbNow'){bkBar.style.display='none';bkOpen();}
  else if(id==='bkbAllow'){bkBar.style.display='none';await bkAllowFolder();}
  else if(id==='bkbLater'){WF.store.set('backup_snooze',String(Date.now()+7*864e5));bkBar.style.display='none';}
});
if(!WF.store.get('first_seen'))WF.store.set('first_seen',String(Date.now()));
bkLoadFolder().finally(()=>setTimeout(bkNudge,6000));
// ---------------------------------------------------------------- keys and menu wiring
// While a window is open, keys belong to it (so typing doesn't switch drawing tools).
document.addEventListener('keydown',e=>{
  const open=iwBack.style.display==='grid'?iwBack:ewBack.style.display==='grid'?ewBack:plBack.style.display==='grid'?plBack:wrBack.style.display==='grid'?wrBack:null;
  if(!open||document.getElementById('askBack'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(open===plBack&&_int.edMode!=='select'){_int.edMode='select';_int.clicks=[];_int.rawImg=null;_int.renderEditor();}else if(open===plBack&&_int.plBig)_int.setBig(false);else if(open===iwBack)closeIntent();else if(open===ewBack)closeWizard();else if(open===wrBack)closeWiring();else closeLibrary();return;}
  if(!open.contains(e.target))e.stopImmediatePropagation();
},true);
for(const b of [ewBack,plBack,wrBack,iwBack].filter(Boolean))b.addEventListener('keydown',e=>e.stopPropagation());
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

  function openCookbook(){
    cbQuery='';$('cbSearch').value='';$('cbAiResult').classList.remove('on');
    cbBack.style.display='grid';renderCookbook();
    cbForm=null;showTab('ideas');
  }
  window.openCookbook=openCookbook;
  function closeCookbook(){cbBack.style.display='none';}
  function renderCookbook(){
    const stock=getStock(),q=cbQuery.toLowerCase().trim();
    const parts=allParts().filter(p=>!q||p.name.toLowerCase().includes(q)||(p.type||'').toLowerCase().includes(q)||p.id.toLowerCase().includes(q));
    $('cbList').innerHTML=parts.map(p=>{const qty=stock[p.id]||0;return`<div class="cbItem${qty>0?' cbOwned':''}" data-cbid="${esc(p.id)}"><input type="number" class="cbQty" min="0" max="9999" value="${qty}" data-cbid="${esc(p.id)}" title="How many do you have?"><div class="u-grow"><div class="cbName">${esc(p.name)}</div><div class="cbMeta">${esc(typeOf(p).name)}${p.id?' · '+esc(p.id):''}</div></div></div>`;}).join('');
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
  // ---- Ready-made ideas (COOKBOOK_RECIPES) and the user's own saved recipes (kept on this computer, like the stock list)
  const RKEY='recipes',WHERE=['House','Garden','Workshop','Other'];
  const getMine=()=>{try{const v=JSON.parse(store.get(RKEY)||'[]');return Array.isArray(v)?v.filter(r=>r&&r.id&&r.title):[];}catch(e){return [];}};
  const setMine=a=>store.set(RKEY,JSON.stringify(a));
  let cbTab='ideas',cbFilter='all',cbForm=null;// cbForm: null, or the recipe being written {id,title,where,blurb,ids,extra}
  const allRecipes=()=>[..._int.COOKBOOK_RECIPES.map(r=>({...r,mine:false})),...getMine().map(r=>({...r,mine:true}))];
  const recipeText=r=>r.build||((r.title||'')+': '+(r.blurb||'')+' Parts: '+(r.parts||[]).map(pr=>(partById(pr[0])||{name:pr[1]||pr[0]}).name).join(', ')+'.'+((r.extra&&r.extra.length)?' Also needed: '+r.extra.join('; ')+'.':''));
  function showTab(t){
    cbTab=t;
    const ideas=t==='ideas';
    $('cbIdeas').style.display=ideas?'block':'none';
    for(const sel of ['.cbSearch','.cbList'])cbBack.querySelector(sel).style.display=ideas?'none':'';
    if(ideas)$('cbAiResult').classList.remove('on');
    for(const id of ['cbClear','cbSave','cbAsk'])$(id).style.display=ideas?'none':'';
    $('cbTabIdeas').classList.toggle('on',ideas);$('cbTabParts').classList.toggle('on',!ideas);
    if(ideas)renderIdeas();
  }
  function renderIdeas(){
    const box=$('cbIdeas'),stock=getStock();
    if(cbForm){box.innerHTML=recipeFormHtml();renderFormParts();return;}
    const all=allRecipes();
    const list=all.filter(r=>cbFilter==='all'||(cbFilter==='mine'?r.mine:r.where===cbFilter));
    const opts=[['all','All ideas ('+all.length+')'],...WHERE.filter(w=>all.some(r=>r.where===w)).map(w=>[w,w]),['mine','My recipes ('+all.filter(r=>r.mine).length+')']];
    box.innerHTML=`<div class="cbIdeaBar"><select id="cbIdeaFilter" title="Show one kind of idea">${opts.map(([v,l])=>`<option value="${v}"${cbFilter===v?' selected':''}>${esc(l)}</option>`).join('')}</select><button id="cbNewRecipe" class="primary" title="Write down your own project and the parts it uses">+ New recipe</button><button id="cbExport" title="Save your own recipes to a file, to keep or to give to a friend">⬇ Save mine to a file</button><button id="cbImport" title="Add recipes from a file someone gave you, or one you saved before">⬆ Add from a file</button></div>`+
      (list.length?list.map(r=>{
        const need=(r.parts||[]).map(pr=>{const p=partById(pr[0]);const own=(stock[pr[0]]||0)>0;return `<li class="${own?'cbHave':''}">${own?'✓ ':''}${esc(p?p.name:(pr[1]||pr[0]))}${p?'':' <small>(not in the parts list yet)</small>'}</li>`;}).join('');
        const extra=(r.extra||[]).map(x=>`<li>${esc(x)}</li>`).join('');
        return `<div class="cbCard" data-rid="${esc(r.id)}"><div class="cbCardHead"><span class="cbIcon">${esc(r.icon||'🛠️')}</span><b>${esc(r.title)}</b>${r.mine?'<span class="cbTag mine">My recipe</span>':''}<span class="cbTag">${esc(r.where||'Other')}</span></div>`+
          `<div class="cbBlurb">${esc(r.blurb||'')}</div>${need?`<div class="cbNeed">You will need:<ul>${need}</ul></div>`:''}${extra?`<div class="cbExtra">Also:<ul>${extra}</ul></div>`:''}`+
          `<div class="cbCardBtns"><button class="primary cbBuild" data-rid="${esc(r.id)}">Build this →</button>${r.mine?`<button class="cbEdit" data-rid="${esc(r.id)}">Edit</button><button class="cbDel" data-rid="${esc(r.id)}">Delete</button>`:''}</div></div>`;}).join(''):
        '<div class="u-noborder cbDesc">Nothing here yet. Press <b>+ New recipe</b> to write down a project of your own: its name, what it does and the parts it uses.</div>');
  }
  function recipeFormHtml(){
    const f=cbForm;
    return `<div class="cbForm"><b>${f.id?'Edit recipe':'New recipe'}</b>`+
      `<label for="cbfTitle">Name of the project</label><input type="text" id="cbfTitle" maxlength="80" value="${esc(f.title)}" placeholder="e.g. Shed door alarm">`+
      `<label for="cbfWhere">Where does it go?</label><select id="cbfWhere">${WHERE.map(w=>`<option${f.where===w?' selected':''}>${w}</option>`).join('')}</select>`+
      `<label for="cbfBlurb">What does it do?</label><textarea id="cbfBlurb" rows="3" maxlength="400" placeholder="A sentence or two about how it works">${esc(f.blurb)}</textarea>`+
      `<label for="cbfSearch">Parts it uses: tick them (${(f.ids||[]).length} chosen)</label><input type="search" id="cbfSearch" placeholder="Search the parts list…" autocomplete="off"><div class="cbFormParts" id="cbfParts"></div>`+
      `<label for="cbfExtra">Other things to buy (one per line, optional)</label><textarea id="cbfExtra" rows="3" maxlength="600" placeholder="e.g. A small water pump">${esc(f.extra)}</textarea>`+
      `<div class="u-mt-10 cbCardBtns"><button class="primary" id="cbfSave">Save recipe</button><button id="cbfCancel">Cancel</button></div></div>`;
  }
  function renderFormParts(){
    const q=(($('cbfSearch')||{}).value||'').toLowerCase().trim(),chosen=new Set(cbForm.ids||[]);
    const parts=allParts().filter(p=>chosen.has(p.id)||!q||p.name.toLowerCase().includes(q)||(typeOf(p).name||'').toLowerCase().includes(q));
    parts.sort((a,b)=>(chosen.has(b.id)-chosen.has(a.id))||String(a.name).localeCompare(String(b.name),undefined,{numeric:true,sensitivity:'base'}));
    $('cbfParts').innerHTML=parts.slice(0,300).map(p=>`<label><input type="checkbox" data-pid="${esc(p.id)}"${chosen.has(p.id)?' checked':''}> ${esc(p.name)} <small class="u-muted">· ${esc(typeOf(p).name)}</small></label>`).join('')||'<div class="u-noborder cbDesc">No parts match.</div>';
  }
  function readForm(){
    cbForm.title=$('cbfTitle').value.trim();cbForm.where=$('cbfWhere').value;cbForm.blurb=$('cbfBlurb').value.trim();cbForm.extra=$('cbfExtra').value;
  }
  $('cbTabIdeas').onclick=()=>showTab('ideas');
  $('cbTabParts').onclick=()=>showTab('parts');
  $('cbIdeas').addEventListener('change',e=>{
    if(e.target.id==='cbIdeaFilter'){cbFilter=e.target.value;renderIdeas();return;}
    const cb=e.target.closest('input[data-pid]');
    if(cb&&cbForm){const s=new Set(cbForm.ids||[]);if(cb.checked)s.add(cb.dataset.pid);else s.delete(cb.dataset.pid);cbForm.ids=[...s];const lab=cbBack.querySelector('label[for="cbfSearch"]');if(lab)lab.textContent='Parts it uses: tick them ('+cbForm.ids.length+' chosen)';}
  });
  $('cbIdeas').addEventListener('input',e=>{if(e.target.id==='cbfSearch'&&cbForm)renderFormParts();});
  $('cbIdeas').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const rid=b.dataset.rid;
    if(b.id==='cbNewRecipe'){cbForm={id:'',title:'',where:'House',blurb:'',ids:[],extra:''};renderIdeas();return;}
    if(b.id==='cbfCancel'){cbForm=null;renderIdeas();return;}
    if(b.id==='cbExport'){
      const mine=getMine();
      if(!mine.length){WF.flash('You have no recipes of your own yet. Press + New recipe to write one.',5000);return;}
      WF.download('my-evenucan-recipes.json',JSON.stringify({kind:'evenucan-recipes',version:1,recipes:mine},null,1),'application/json');
      WF.flash('✅ Saved '+mine.length+' recipe'+(mine.length===1?'':'s')+' to your Downloads folder: my-evenucan-recipes.json',7000);return;
    }
    if(b.id==='cbImport'){
      const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
      inp.onchange=async()=>{
        const f=inp.files&&inp.files[0];if(!f)return;
        try{
          const d=JSON.parse(await f.text());
          const list=Array.isArray(d)?d:(d&&d.kind==='evenucan-recipes'&&Array.isArray(d.recipes)?d.recipes:null);
          if(!list)return WF.flash('That file does not hold EvenUCan recipes.',6000);
          const str=(v,n)=>String(v==null?'':v).slice(0,n);
          const mine=getMine();let added=0,updated=0;
          for(const r of list){
            if(!r||!r.title)continue;
            const rec={id:str(r.id||'u-'+Date.now().toString(36)+added,40).replace(/[^\w-]/g,'')||'u-'+Date.now().toString(36)+added,title:str(r.title,80),
              where:WHERE.includes(r.where)?r.where:'Other',blurb:str(r.blurb,400),icon:str(r.icon||'🛠️',8),
              parts:(Array.isArray(r.parts)?r.parts:[]).filter(p=>Array.isArray(p)&&p[0]).slice(0,60).map(p=>[str(p[0],80),str(p[1]||p[0],80)]),
              extra:(Array.isArray(r.extra)?r.extra:[]).slice(0,30).map(x=>str(x,200)).filter(Boolean)};
            if(_int.COOKBOOK_RECIPES.some(c=>c.id===rec.id))rec.id='u-'+rec.id;// never overwrite a ready-made idea
            const i=mine.findIndex(x=>x.id===rec.id);if(i>=0){mine[i]=rec;updated++;}else{mine.push(rec);added++;}
          }
          if(!added&&!updated)return WF.flash('No recipes were found in that file.',6000);
          setMine(mine);cbFilter='mine';renderIdeas();
          WF.flash('✅ Added '+added+' recipe'+(added===1?'':'s')+(updated?' and updated '+updated:'')+'. They are under "My recipes".',7000);
        }catch(err){console.warn('EvenUCan: could not read the recipes file',err);WF.flash('Could not read that file. Is it a recipes file saved from EvenUCan?',6000);}
      };
      inp.click();return;
    }
    if(b.id==='cbfSave'){
      readForm();
      if(!cbForm.title){WF.flash('Give your recipe a name first');$('cbfTitle').focus();return;}
      if(!(cbForm.ids||[]).length&&!cbForm.extra.trim()){WF.flash('Tick at least one part, or list something to buy');return;}
      const mine=getMine(),rec={id:cbForm.id||'u-'+Date.now().toString(36),title:cbForm.title,where:cbForm.where,blurb:cbForm.blurb,icon:'🛠️',
        parts:(cbForm.ids||[]).map(id=>[id,(partById(id)||{}).name||id]),extra:cbForm.extra.split('\n').map(s=>s.trim()).filter(Boolean)};
      const i=mine.findIndex(r=>r.id===rec.id);if(i>=0)mine[i]=rec;else mine.push(rec);
      setMine(mine);cbForm=null;cbFilter='mine';renderIdeas();WF.flash('✅ Recipe saved: it is under "My recipes"');return;
    }
    if(!rid)return;
    const r=allRecipes().find(x=>x.id===rid);if(!r)return;
    if(b.classList.contains('cbEdit')){cbForm={id:r.id,title:r.title,where:r.where||'Other',blurb:r.blurb||'',ids:(r.parts||[]).map(pr=>pr[0]),extra:(r.extra||[]).join('\n')};renderIdeas();return;}
    if(b.classList.contains('cbDel')){if(confirm('Delete the recipe "'+r.title+'"?')){setMine(getMine().filter(x=>x.id!==rid));renderIdeas();}return;}
    if(b.classList.contains('cbBuild')){
      _int.iw.w={text:recipeText(r),does:[],pf:'auto',noShow:false};_int.iw.err='';_int.iw.step='w1';
      closeCookbook();iwBack.style.display='grid';_int.renderIntent();
      WF.flash('💡 Project loaded — describe it more if you like, then click Next →');
    }
  });

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
    if(!window.aiKey()){if(window.WFEnclosure)WFEnclosure.askKey();return;}
    const ownedList=owned.map(([id,qty])=>{const p=partById(id);return p?{name:p.name,qty}:null;}).filter(Boolean);
    if(!ownedList.length){WF.flash('No recognised parts found.');return;}
    cbBusy=true;$('cbAsk').disabled=true;$('cbAsk').textContent='Thinking…';
    $('cbAiResult').classList.remove('on');$('cbAiResult').innerHTML='';
    try{
      const prompt=`You are an expert electronics engineer and maker. The user has these electronic parts in their stock at home (name · quantity available):\n${ownedList.map((x,i)=>`${i+1}. ${x.name} × ${x.qty}`).join('\n')}\n\nSuggest up to 6 fun projects they could build RIGHT NOW using only parts from this list (quantities matter — never require more of a part than the user has). For each project:\n- Give it a short catchy name\n- One clear sentence explaining what it does and why it is useful\n- List which parts from their stock it uses, with quantities needed\n\nOutput ONLY valid JSON (no other text): {"projects":[{"name":"...","description":"...","parts":["part name",...]},...]}\``;
      const {data}=await callAI(prompt);
      if(!data||!Array.isArray(data.projects)||!data.projects.length)throw new Error('No projects in response — try rephrasing or check your AI key.');
      const html=`<h4>Here are ${data.projects.length} project${data.projects.length>1?'s':''} you can build today:</h4><ol>${data.projects.map((p,i)=>`<li class="u-mb-10"><span class="cbIdeaTitle">${esc(p.name||'')}</span> — ${esc(p.description||'')}${p.parts&&p.parts.length?'<br><small class="u-muted">Uses: '+p.parts.map(n=>esc(n)).join(', ')+'</small>':''}<br><button class="u-build-btn cbBuildBtn" data-cbidx="${i}">Build this →</button></li>`).join('')}</ol>`;
      $('cbAiResult').innerHTML=html;$('cbAiResult').classList.add('on');
      // store projects for click handler
      $('cbAiResult')._cbProjects=data.projects;
    }catch(e){
      console.error('Cookbook AI error',e);
      $('cbAiResult').innerHTML=`<div class="u-danger-text">Couldn't get ideas: ${esc(e&&e.message||'AI error')}. Check your AI key and internet connection.</div>`;
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
    _int.iw.w={text,does:[],pf:'auto',noShow:false};_int.iw.err='';_int.iw.step='w1';
    closeCookbook();
    iwBack.style.display='grid';_int.renderIntent();
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

// Register reverse callbacks onto _int and window
_int.exportBackup = window.exportBackup = typeof bkDownload !== 'undefined' ? bkDownload : null;
_int.importBackup = window.importBackup = typeof bkRestore !== 'undefined' ? bkRestore : null;
_int.openBackup = window.openBackup = typeof bkOpen !== 'undefined' ? bkOpen : null;
_int.openCookbook = window.openCookbook = typeof openCookbook !== 'undefined' ? openCookbook : null;
_int.closeCookbook = window.closeCookbook = typeof closeCookbook !== 'undefined' ? closeCookbook : null;
})();
