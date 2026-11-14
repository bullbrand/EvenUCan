// ---- (backup-r1) Backup and restore. Everything the user makes (parts, photos, recipes, projects, the drawing in progress, settings)
// lives in this browser's own storage, so a Windows reinstall or "clear browsing data" would lose it. This makes a copy they can keep
// somewhere safe: a file (one click), and optionally an automatic copy in a folder they choose (Edge / Chrome / the desktop app).
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
function bkText(){return JSON.stringify({kind:'evenucan-backup',version:1,app:typeof APP_VERSION!=='undefined'?APP_VERSION:'',saved:new Date().toISOString(),items:bkCollect()});}
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
  '<div class="ewHead"><h2 id="bkTitle">🛟 Keep your work safe</h2><button id="bkX" class="x" title="Close (Esc)" style="font-size:18px">✕</button></div>'+
  '<div id="bkBody" style="padding:12px 16px 16px;overflow:auto;font-size:14px;line-height:1.55"></div></div></div>');
const bkBack=$('bkBack');
function bkRender(){
  const last=+WF.store.get('last_backup')||0,has=bkHasWork(),n=Object.keys(bkCollect()).length;
  const canFolder=!!window.showDirectoryPicker;
  let folder='';
  if(canFolder){
    folder='<div class="efbox" style="margin-top:12px"><b>📁 Automatic copy in a folder</b>'+
      (bk.dir&&bk.perm==='granted'?'<div class="ok" style="margin:4px 0">✅ On. Copied to the folder “'+esc(bk.name)+'”'+(bk.lastTime?' (last saved '+new Date(bk.lastTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+')':'')+'.</div><button id="bkFolderOff">Turn it off</button>'
        :bk.dir?'<div class="warn" style="margin:4px 0">Your folder “'+esc(bk.name)+'” needs one click to carry on.</div><button id="bkFolderAllow" class="primary">Turn it back on</button> <button id="bkFolderOff">Forget this folder</button>'
        :'<div class="ewNote" style="margin:4px 0 8px">Pick a folder once. EvenUCan then keeps a fresh copy in it by itself, and you can forget about it. <b>Best: a folder that is copied to the internet for you:</b></div>'+
        '<ul class="ewNote" style="margin:0 0 8px;padding-left:20px"><li><b>OneDrive</b> (already on most Windows 11 computers): choose the <b>OneDrive</b> folder. Your <b>Documents</b> folder is often in OneDrive already: check for a small cloud sign beside it.</li>'+
        '<li><b>Google Drive / Google One</b>: install the free <b>Google Drive for desktop</b> from google.com/drive/download, sign in, then choose the <b>Google Drive</b> folder (it may be a drive letter such as G:).</li>'+
        '<li>Or a <b>USB stick</b> left plugged in.</li></ul><button id="bkFolder" class="primary">Choose a folder…</button>')+
      '</div>';
  }else folder='<div class="ewNote" style="margin-top:12px">Your browser cannot keep an automatic copy in a folder. Use Edge or Chrome for that, or make a backup file now and then.</div>';
  $('bkBody').innerHTML=
    '<p style="margin:0 0 8px">Everything you make here (your parts, photos, recipes, projects and the drawing you are on) is kept <b>inside this browser, on this computer</b>. If Windows is reinstalled, or the browser\'s data is cleared, it is <b>gone</b>.</p>'+
    '<p style="margin:0 0 10px">A backup is a small file. Keep it <b>somewhere that is not on this computer</b>: a USB stick, <b>OneDrive</b>, <b>Google Drive</b> (your Google One storage), or email it to yourself.</p>'+
    '<div class="efbox"><b>⬇ Back up everything now</b>'+
      '<div class="ewNote" style="margin:4px 0 8px">'+(last?'Last backup: '+bkAgo(last)+' ('+new Date(last).toLocaleDateString()+').':'<span class="warn">You have not made a backup yet.</span>')+(has?'':' (There is not much to save yet.)')+'</div>'+
      '<button id="bkNow" class="primary">⬇ Save my backup file</button> <span class="ewNote">'+n+' items</span></div>'+
    folder+
    '<div class="efbox" style="margin-top:12px"><b>⬆ Put a backup back</b><div class="ewNote" style="margin:4px 0 8px">After a reinstall: install EvenUCan, open this window, and choose your backup file. Everything comes back.</div><button id="bkRestore">⬆ Restore from a backup file…</button></div>'+
    '<div class="ewNote" style="margin-top:10px">For safety, your AI keys and Wi-Fi passwords are <b>not</b> put in the file. You would type your free AI key in again after a restore.</div>';
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
    if(!await askConfirm('Put back the backup made on '+when+'?\n\nThis replaces the work in this browser with what is in the file. A copy of what you have now is saved to your Downloads folder first, just in case.'))return;
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
    if(!bkHasWork()&&!await askConfirm('There is not much to save yet. Make a backup file anyway?'))return;
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
  if(coach.on||bkBack.style.display==='grid'||$('suBack').style.display==='grid')return;
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
