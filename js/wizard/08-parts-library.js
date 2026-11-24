// EvenUCan Enclosure Wizard - 08-parts-library.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- parts library window
let ed=null,edDirty=false,edSel=-1,edPin=-1,edMode='select',photo=null,rawImg=null,clicks=[],sideRef='w',plBig=false;
// Where positions are measured from, for the numbers shown and typed in the part editor only: parts are always
// stored from the bottom-left corner (x to the right, y up), so changing this never changes a part.
const ORIGINS={tl:'Top-left corner',bl:'Bottom-left corner',c:'Centre'};
const orig=()=>ORIGINS[WF.store.get('partOrigin')]?WF.store.get('partOrigin'):'tl';
const isPos=k=>k==='x'||k==='y'||k==='u';
// k: 'x', 'y' or 'u' (along an edge: up the left/right edges, across the top/bottom ones)
const toShow=function toShow(k,v,side){
  const o=orig(),vert=side==='xmin'||side==='xmax';
  if(k==='x'||(k==='u'&&!vert))return o==='c'?v-ed.w/2:v;
  if(k==='y'||(k==='u'&&vert))return o==='tl'?ed.d-v:o==='c'?v-ed.d/2:v;
  return v;
};
const fromShow=function fromShow(k,v,side){
  const o=orig(),vert=side==='xmin'||side==='xmax';
  if(k==='x'||(k==='u'&&!vert))return o==='c'?v+ed.w/2:v;
  if(k==='y'||(k==='u'&&vert))return o==='tl'?ed.d-v:o==='c'?v+ed.d/2:v;
  return v;
};
const posLabel=function posLabel(k,side){
  const o=orig(),vert=side==='xmin'||side==='xmax',down=o==='tl'?'↓':o==='c'?'↕':'↑',across=o==='c'?'↔':'→';
  return k==='x'?'X '+across:k==='y'?'Y '+down:k==='u'?FLABEL.u+' '+(vert?down:across):FLABEL[k];
};
const posTip=k=>k==='x'?(orig()==='c'?'mm right of the centre (minus = left)':'mm from the left edge'):(orig()==='tl'?'mm down from the top edge':orig()==='c'?'mm above the centre (minus = below)':'mm up from the bottom edge');
// Moved things land on 0.5 mm steps, counted from the chosen corner (fine: 0.1 mm steps).
const snapTo=(k,v,side,fine)=>{const s=toShow(k,v,side);return +fromShow(k,fine?Math.round(s*10)/10:snap(s),side).toFixed(2);};
// Bigger picture: the part picture fills the Parts Library window, so a small board's pins and their names can be read.
const setBig=function setBig(on){
  plBig=on;plBack.classList.toggle('plBig',on);
  const b=$('plBigBtn');if(b)b.textContent=on?'✕ Smaller picture':'⤢ Bigger picture';
  drawEd();
};
const imgCache=new Map();
const imgOf=function imgOf(src,cb){
  if(!src)return null;let im=imgCache.get(src);
  if(!im){im=new Image();im.onload=()=>cb&&cb();im.src=src;imgCache.set(src,im);}
  return im.complete&&im.naturalWidth?im:null;
};
const openLibrary=function openLibrary(id){
  ewBack.style.display='none';plBack.style.display='grid';
  if(id!==undefined||!ed)selectPart(id||allParts()[0].id,true);else{renderList();renderEditor();}
};
const closeLibrary=function closeLibrary(){
  if(edDirty&&!confirm('Close without saving the changes to "'+ed.name+'"?'))return;
  edDirty=false;plBack.style.display='none';setBig(false);plSelected.clear();
};
const selectPart=function selectPart(id,force){
  if(!force&&edDirty&&!confirm('Discard the changes to "'+ed.name+'"?'))return;
  const p=partById(id);if(!p)return;
  ed=tidyPart(clone(p));if(!ed.pins||!ed.pins.length)ed.pins=clone(pinsOf(p));
  const ph=photoGet(ed.id);if(ph)ed.photo=ph;else delete ed.photo;
  const im=imgGet(ed.id);if(im)ed.img=im;else delete ed.img;
  edDirty=false;edSel=-1;edPin=-1;edMode='select';clicks=[];rawImg=null;clearRef();
  renderList();renderEditor();
};
const thumbCache=new Map();// id → dataURL, cleared when a part is saved/deleted
const thumbInvalidate=function thumbInvalidate(id){thumbCache.delete(id);};
const thumb=function thumb(cv,p){
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;c.clearRect(0,0,W,H);
  const pw = Math.max(0.5, p.w || 10);
  const pd = Math.max(0.5, p.d || 10);
  const s=Math.min((W-6)/pw,(H-6)/pd),ox=(W-pw*s)/2,oy=(H+pd*s)/2;
  const X=x=>ox+x*s,Y=y=>oy-y*s;
  const im=imgOf(p.photo,()=>{
    const itemEl=document.querySelector('.plItem[data-id="'+p.id+'"]');
    if(!itemEl)return;
    const live=itemEl.querySelector('canvas');
    if(live){thumb(live,p);thumbCache.set(p.id,live.toDataURL());}
  });
  if(im){
    c.save();
    c.beginPath();
    c.roundRect ? c.roundRect(ox, oy-pd*s, pw*s, pd*s, 3) : c.rect(ox, oy-pd*s, pw*s, pd*s);
    c.clip();
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(im,ox,oy-pd*s,pw*s,pd*s);
    c.restore();
    c.strokeStyle='rgba(255,255,255,0.4)';c.lineWidth=1;
    c.beginPath();
    c.roundRect ? c.roundRect(ox, oy-pd*s, pw*s, pd*s, 3) : c.rect(ox, oy-pd*s, pw*s, pd*s);
    c.stroke();
  } else {
    // Shaded placeholder diagram for parts without photos
    c.strokeStyle=typeOf(p).color;c.lineWidth=1.5;c.fillStyle=typeOf(p).color+'40';c.beginPath();
    if(p.shape==='round')c.ellipse(ox+pw*s/2,oy-pd*s/2,pw*s/2,pd*s/2,0,0,Math.PI*2);else c.rect(ox,oy-pd*s,pw*s,pd*s);
    c.fill();c.stroke();
  }

  // Draw red port cutouts aligned 1-to-1 with physical port locations
  (p.features || []).forEach(f => {
    if (f.t === 'port' && f.side) {
      c.fillStyle = '#e0141e';
      const fw = Math.max(2, (f.pw || 8) * s);
      const fh = Math.max(1.5, (f.ph || 3) * s);
      let fx = ox, fy = oy - pd * s;
      if (f.side === 'xmin') { fx = ox; fy = Y(f.u) - fh / 2; }
      else if (f.side === 'xmax') { fx = ox + pw * s - fw; fy = Y(f.u) - fh / 2; }
      else if (f.side === 'ymin') { fx = X(f.u) - fw / 2; fy = oy - fh; }
      else if (f.side === 'ymax') { fx = X(f.u) - fw / 2; fy = oy - pd * s; }
      c.fillRect(Math.max(ox, fx), Math.max(oy - pd * s, fy), fw, fh);
    }
  });

  // Draw gold pin dots aligned 1-to-1 with pin coordinates
  (p.pins || []).forEach(q => {
    if (q.x !== undefined && q.y !== undefined) {
      const pr = Math.max(1.0, Math.min(2.5, s * 0.4));
      c.beginPath();
      c.arc(X(q.x), Y(q.y), pr, 0, Math.PI * 2);
      c.fillStyle = '#c9a227';
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 0.5;
      c.stroke();
    }
  });

  thumbCache.set(p.id,cv.toDataURL());
};
// IntersectionObserver: only draw thumbnails that scroll into view; uses cached dataURLs on revisit.
let _thumbObs=null;
const getThumbObs=function getThumbObs(){
  if(_thumbObs)return _thumbObs;
  _thumbObs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting)return;
      _thumbObs.unobserve(e.target);
      const id=e.target.closest('.plItem')?.dataset.id;
      if(!id)return;
      const p=_plPartsMap.get(id);
      if(p)thumb(e.target,p);
    });
  },{root:$('plList'),rootMargin:'120px'});
  return _thumbObs;
};
let _plPartsMap=new Map();// built once per renderList, reused by the observer
let _rlPending=false;
let plSelected=new Set();
const updateSelBar=function updateSelBar(){const bar=$('plSelBar'),n=plSelected.size;if(!bar)return;bar.style.display=n?'flex':'none';const sc=$('plSelCount');if(sc)sc.textContent=n+' part'+(n===1?'':'s')+' selected';};
let plFilterInpVal='';
const renderList=function renderList(){
  if(_rlPending)return;// coalesce rapid calls into one frame
  _rlPending=true;
  requestAnimationFrame(()=>{
    _rlPending=false;
    const L=$('plList'),all=allParts();
    _plPartsMap=new Map(all.map(p=>[p.id,p]));
    if(_thumbObs){_thumbObs.disconnect();}
    const obs=getThumbObs();
    // Split by kind (Dev boards, Sensors, Motors…), each kind sorted A → Z (or in the order added), with a dropdown to show one kind.
    const rank=p=>{const i=PL_ORDER.indexOf(TYPES[p.type]?p.type:'other');return i<0?PL_ORDER.length-1:i;};
    const kindOf=p=>TYPES[p.type]?p.type:'other';
    const counts={};all.forEach(p=>{counts[kindOf(p)]=(counts[kindOf(p)]||0)+1;});
    if(plKind!=='all'&&!counts[plKind])plKind='all';
    const byName=(a,b)=>String(a.name).localeCompare(String(b.name),undefined,{numeric:true,sensitivity:'base'});
    const idx=new Map(all.map((p,i)=>[p.id,i]));
    const fq=plFilterInpVal.toLowerCase().trim();
    const parts=all.filter(p=>(plKind==='all'||kindOf(p)===plKind)&&(!fq||p.name.toLowerCase().includes(fq)))
      .sort((a,b)=>rank(a)-rank(b)||(plSort==='added'?idx.get(a.id)-idx.get(b.id):byName(a,b)));
    const kinds=PL_ORDER.filter(k=>counts[k]);
    const bar=`<div class="plBar" style="flex-direction:column;gap:5px"><input id="plFilterInp" type="search" placeholder="🔍 Search / filter parts…" value="${esc(plFilterInpVal)}" style="width:100%;box-sizing:border-box;padding:5px 8px;font-size:12px;border:1px solid var(--line);border-radius:4px"><div style="display:flex;gap:5px;width:100%"><select id="plKindSel" style="flex:1" title="Show one kind of part, or all of them"><option value="all"${plKind==='all'?' selected':''}>All kinds (${all.length})</option>${kinds.map(k=>`<option value="${k}"${plKind===k?' selected':''}>${esc(TYPES[k].name)} (${counts[k]})</option>`).join('')}</select><select id="plSortSel" title="Order inside each kind"><option value="az"${plSort==='az'?' selected':''}>A → Z</option><option value="added"${plSort==='added'?' selected':''}>Order added</option></select></div></div>`;
    let lastKind=null;
    // the search box is rebuilt with the list: remember whether the user was typing in it, and where the cursor was
    const oldInp=document.activeElement&&document.activeElement.id==='plFilterInp'?document.activeElement:null;
    const caret=oldInp?oldInp.selectionStart:0;
    L.innerHTML=bar+parts.map(p=>{
      const head=plKind==='all'&&kindOf(p)!==lastKind?`<div class="plGroup">${esc(TYPES[kindOf(p)].name)} · ${counts[kindOf(p)]}</div>`:'';
      lastKind=kindOf(p);
      return head+plItemHtml(p);
    }).join('');
    if(oldInp){const ni=$('plFilterInp');if(ni){ni.focus();try{ni.setSelectionRange(caret,caret);}catch(e){/* search boxes always allow this; ignore if not */}}}
    L.querySelectorAll('.plItem canvas').forEach(cv=>obs.observe(cv));
    updateSelBar();
  });
};
let plKind='all',plSort='az';
try{plKind=localStorage.getItem('ev.plKind')||'all';plSort=localStorage.getItem('ev.plSort')||'az';}catch(e){/* private mode: keep the defaults */}
const plItemHtml=function plItemHtml(p){
  let thumb_el;
  if(p.img){
    thumb_el=`<img width="64" height="44" src="${esc(p.img)}" class="plThumb" style="object-fit:contain;background:#fff;border-radius:3px;border:1px solid rgba(0,0,0,0.15)">`;
  }else{
    const cached=thumbCache.get(p.id);
    thumb_el=cached?`<img width="64" height="44" src="${cached}" class="plThumb">`:`<canvas width="64" height="44"></canvas>`;
  }
  const canDel=!p.builtin&&!builtinById(p.id);
  return `<div class="plItem${ed&&ed.id===p.id?' on':''}" data-id="${esc(p.id)}">${thumb_el}<div class="t"><b>${esc(p.name)}</b><small>${esc(typeOf(p).name)}${p.type==='light'&&LED_COLOURS[p.colour]?' · '+LED_COLOURS[p.colour]:''} · ${fx(p.w)} × ${fx(p.d)} mm${p.builtin?' · built-in':builtinById(p.id)?' · edited':''}${accOf(p)==='unknown'?'':' · <span title="Sizes: '+esc(ACC[accOf(p)].slice(2))+'">'+ACC[accOf(p)].split(' ')[0]+'</span>'}</small></div>${canDel?`<input type="checkbox" class="plCheck" data-id="${esc(p.id)}" title="Tick to select for deletion"${plSelected.has(p.id)?' checked':''}>`:''}</div>`;
};
$('plList').addEventListener('input',e=>{
  if(e.target.id==='plFilterInp'){
    plFilterInpVal=e.target.value;
    renderList();
    const inp=$('plFilterInp');
    if(inp){inp.focus();inp.selectionStart=inp.selectionEnd=inp.value.length;}
  }
});
$('plList').addEventListener('change',e=>{
  const sel=e.target.closest('#plKindSel,#plSortSel');
  if(sel){
    if(sel.id==='plKindSel')plKind=sel.value;else plSort=sel.value;
    try{localStorage.setItem('ev.plKind',plKind);localStorage.setItem('ev.plSort',plSort);}catch(err){/* not saved: fine */}
    renderList();return;
  }
  const cb=e.target.closest('.plCheck');if(!cb)return;
  const id=cb.dataset.id;if(cb.checked)plSelected.add(id);else plSelected.delete(id);
  updateSelBar();
});
$('plList').addEventListener('click',e=>{
  if(e.target.closest('.plCheck'))return;
  const el=e.target.closest('.plItem');if(el)selectPart(el.dataset.id);
});
$('plSelDelBtn').onclick=()=>{
  if(!plSelected.size)return;
  if(!confirm('Delete '+plSelected.size+' part'+(plSelected.size===1?'':'s')+'? This cannot be undone.'))return;
  plSelected.forEach(id=>{const idx=custom.findIndex(c=>c.id===id);if(idx>=0){custom.splice(idx,1);photoDel(id);thumbInvalidate(id);if(ed&&ed.id===id)ed=null;}});
  plSelected.clear();saveLib();renderList();
};
$('plSelClrBtn').onclick=()=>{plSelected.clear();renderList();};
let bgPhotoState=null;
const updateBgBar=function updateBgBar(){
  const bar=$('plBgBar');if(!bar)return;
  if(!bgPhotoState){bar.style.display='none';return;}
  const {found,done,total,running}=bgPhotoState;
  bar.style.display='flex';
  $('plBgMsg').textContent=(running?'Finding photos: ':'Done — ')+(done||0)+' of '+total+(found?' · '+found+' found':'');
  $('plBgStop').style.display=running?'':'none';
};
const fetchPhotoCandidates=async function fetchPhotoCandidates(name){
  // 1. Try local server online component photo search (returns multiple candidate URLs)
  try{
    const r=await fetch('/api/find-photo?q='+encodeURIComponent(name)+'&_t='+Date.now(),{cache:'no-store'});
    if(r.ok){
      const j=await r.json();
      if(j&&Array.isArray(j.candidates)&&j.candidates.length)return j.candidates;
      if(j&&j.image)return [j.image];
    }
  }catch(e){}

  // 2. Fallback to Gemini if AI key is available
  if(aiKey('gemini')){
    try{
      const ask=`Search the web for a top-down photo of this electronic component: "${name}". Return JSON only — no other text: {"image":"<direct URL to a .jpg .jpeg .png or .webp image showing the component from straight above, component side visible>"} or {"image":null} if no suitable photo was found.`;
      const r=await gemini([{text:ask}],[{google_search:{}},{url_context:{}}]);
      if(r&&r.data&&typeof r.data.image==='string'&&/^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(r.data.image)){
        return [r.data.image];
      }
    }catch(e){console.warn('Gemini image lookup error:', e);}
  }
  return [];
};
const fetchPhotoUrl=async function fetchPhotoUrl(name){
  const list=await fetchPhotoCandidates(name);
  return list.length?list[0]:null;
};
const fetchAndResize=async function fetchAndResize(url){
  // First attempt: fetch via server proxy to bypass browser CORS completely
  try{
    const proxyRes=await fetch('/api/proxy-image?url='+encodeURIComponent(url)+'&_t='+Date.now(),{cache:'no-store'});
    if(proxyRes.ok){
      const pData=await proxyRes.json();
      if(pData&&pData.data_url){
        url=pData.data_url;
      }
    }
  }catch(e){/* ignore proxy error, fallback to direct */}

  return new Promise(res=>{
    const img=new Image();
    if(!url.startsWith('data:')) img.crossOrigin='anonymous';
    const done=v=>res(v);
    const t=setTimeout(()=>done(null),15000);
    img.onload=()=>{
      clearTimeout(t);
      try{
        const W=200,H=150,c=document.createElement('canvas');c.width=W;c.height=H;
        const cx=c.getContext('2d'),sc=Math.min(W/img.width,H/img.height),sw=img.width*sc,sh=img.height*sc;
        cx.fillStyle='#fff';cx.fillRect(0,0,W,H);cx.drawImage(img,(W-sw)/2,(H-sh)/2,sw,sh);
        done(c.toDataURL('image/jpeg',0.72));
      }catch(e){done(null);}
    };
    img.onerror=()=>{clearTimeout(t);done(null);};
    img.src=url;
  });
};
const bgFindPhotos=async function bgFindPhotos(){
  if(bgPhotoState&&bgPhotoState.running)return;
  const all=allParts();
  let todo=[];
  if(plSelected.size>0){
    plSelected.forEach(id=>{
      const p=partById(id);
      if(p&&!p.img)todo.push(p);
    });
  }
  if(!todo.length&&ed&&!ed.img){
    todo.push(ed);
  }
  if(!todo.length){
    todo=all.filter(p=>!p.img);
  }
  if(!todo.length){
    WF.flash('All parts already have product thumbnail photos in the list.',5000);
    return;
  }
  bgPhotoState={running:true,found:0,done:0,total:todo.length,stop:false};
  updateBgBar();
  for(const part of todo){
    if(bgPhotoState.stop)break;
    try{
      const cleanName=part.name.replace(/\(.*?\)/g,'').replace(/\[.*?\]/g,'').trim()||part.name;
      const urls=await fetchPhotoCandidates(cleanName);
      let dataUrl=null;
      for(const u of urls){
        dataUrl=await fetchAndResize(u);
        if(dataUrl)break;
      }
      if(dataUrl){
        part.img=dataUrl;
        imgSave(part.id,dataUrl);
        const bp=builtinById(part.id);if(bp){bp.img=dataUrl;}
        const cp=custom.find(c=>c.id===part.id);if(cp){cp.img=dataUrl;}
        if(ed&&ed.id===part.id){ed.img=dataUrl;renderEditor();}
        thumbInvalidate(part.id);
        bgPhotoState.found++;
      }
    }catch(e){/* skip */}
    bgPhotoState.done++;
    updateBgBar();
  }
  bgPhotoState.running=false;
  if(bgPhotoState.found){renderList();}
  updateBgBar();
  if(bgPhotoState.found)WF.flash('Found '+bgPhotoState.found+' photo'+(bgPhotoState.found===1?'':'s')+' — list updated.');
  else WF.flash('Could not find online photos for the selected parts.');
};
$('plFzPhoto').onclick=()=>openPhotoFinderModal(ed);
$('plBgStop').onclick=()=>{if(bgPhotoState)bgPhotoState.stop=true;};

const openPhotoFinderModal=async function openPhotoFinderModal(targetPart){
  if(!targetPart){
    targetPart=ed||allParts()[0];
    if(!targetPart){WF.flash('Please select a part first.');return;}
  }
  const cleanDefault=targetPart.name.replace(/\(.*?\)/g,'').replace(/\[.*?\]/g,'').trim()||targetPart.name;
  
  const oldModal=document.getElementById('photoFinderModal');
  if(oldModal) oldModal.remove();

  const modal=document.createElement('div');
  modal.id='photoFinderModal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:999999;padding:16px;';
  
  modal.innerHTML=`<div style="background:#fff;border-radius:10px;padding:22px;max-width:480px;width:100%;box-shadow:0 10px 35px rgba(0,0,0,0.35);font-family:system-ui,-apple-system,Segoe UI,sans-serif;box-sizing:border-box">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div style="flex:1;padding-right:10px">
        <h3 style="margin:0 0 4px;font-size:16px;color:var(--text)">Find identification photo for:</h3>
        <div style="font-size:13px;font-weight:600;color:var(--accent);word-break:break-word">${esc(targetPart.name)}</div>
      </div>
      <button id="pfmCloseX" style="border:none;background:transparent;font-size:22px;cursor:pointer;color:var(--text-muted);padding:0 4px;line-height:1">✕</button>
    </div>
    
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <input id="pfmInput" type="search" value="${esc(cleanDefault)}" placeholder="Type model or search keywords…" style="flex:1;padding:8px 12px;font-size:13px;border:1px solid var(--line);border-radius:6px;outline:none">
      <button id="pfmSearchBtn" class="primary" style="padding:8px 16px;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;white-space:nowrap">🔍 Search</button>
    </div>

    <div id="pfmStatus" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;min-height:18px">Searching online…</div>

    <div id="pfmImgWrap" style="background:var(--panel-hover);border:1px solid var(--line);border-radius:8px;padding:12px;min-height:220px;max-height:260px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;position:relative">
      <div id="pfmSpinner" style="color:var(--text-muted);font-size:13px;text-align:center">Loading photo candidates…</div>
      <img id="pfmImg" style="display:none;max-height:236px;max-width:100%;object-fit:contain;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.1)">
    </div>

    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button id="pfmUseBtn" class="primary" style="padding:8px 18px;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;display:none">✓ Use this photo</button>
      <button id="pfmPrevBtn" style="padding:8px 14px;font-size:13px;border-radius:6px;cursor:pointer;display:none">◀ Previous</button>
      <button id="pfmNextBtn" style="padding:8px 14px;font-size:13px;border-radius:6px;cursor:pointer;display:none">Next photo ▶</button>
      <button id="pfmCancelBtn" style="padding:8px 14px;font-size:13px;border-radius:6px;cursor:pointer;color:var(--text-muted)">Cancel</button>
    </div>
  </div>`;

  document.body.appendChild(modal);

  const inp = modal.querySelector('#pfmInput');
  const searchBtn = modal.querySelector('#pfmSearchBtn');
  const statusEl = modal.querySelector('#pfmStatus');
  const spinnerEl = modal.querySelector('#pfmSpinner');
  const imgEl = modal.querySelector('#pfmImg');
  const useBtn = modal.querySelector('#pfmUseBtn');
  const prevBtn = modal.querySelector('#pfmPrevBtn');
  const nextBtn = modal.querySelector('#pfmNextBtn');
  const cancelBtn = modal.querySelector('#pfmCancelBtn');
  const closeX = modal.querySelector('#pfmCloseX');

  let candidates = [];
  let currentIdx = 0;
  let cachedDataUrls = {};
  let isSearching = false;

  const close = () => { modal.remove(); };
  cancelBtn.onclick = close;
  closeX.onclick = close;

  async function performSearch(query){
    if(!query || !query.trim() || isSearching) return;
    isSearching = true;
    candidates = [];
    currentIdx = 0;
    cachedDataUrls = {};

    statusEl.textContent = 'Searching online for photos of "' + query.trim() + '"…';
    spinnerEl.style.display = 'block';
    spinnerEl.textContent = 'Searching web for photos…';
    imgEl.style.display = 'none';
    imgEl.src = '';
    imgEl.removeAttribute('src');
    useBtn.style.display = 'none';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    searchBtn.disabled = true;

    try {
      const urls = await fetchPhotoCandidates(query.trim());
      candidates = urls || [];
      if(!candidates.length){
        statusEl.textContent = 'No photos found for "' + query.trim() + '".';
        spinnerEl.innerHTML = 'Could not find any photos.<br><small style="color:var(--text-muted);margin-top:4px;display:inline-block">Try editing the keywords in the box above (e.g. shorter part name) and click Search.</small>';
        return;
      }
      statusEl.textContent = 'Found ' + candidates.length + ' photo candidate' + (candidates.length === 1 ? '' : 's') + '. Loading preview…';
      await showCandidate(0);
    } catch(err) {
      statusEl.textContent = 'Error: ' + (err.message || err);
      spinnerEl.textContent = 'Search failed. Please try again.';
    } finally {
      isSearching = false;
      searchBtn.disabled = false;
    }
  }

  async function showCandidate(idx){
    if(idx < 0 || idx >= candidates.length) return;
    currentIdx = idx;
    statusEl.textContent = 'Photo ' + (idx + 1) + ' of ' + candidates.length;
    spinnerEl.style.display = 'block';
    spinnerEl.textContent = 'Loading photo ' + (idx + 1) + ' of ' + candidates.length + '…';
    imgEl.style.display = 'none';
    useBtn.style.display = 'none';

    let dataUrl = cachedDataUrls[idx];
    if(!dataUrl){
      dataUrl = await fetchAndResize(candidates[idx]);
      if(dataUrl) cachedDataUrls[idx] = dataUrl;
    }

    if(!dataUrl){
      if(idx + 1 < candidates.length){
        showCandidate(idx + 1);
        return;
      } else {
        spinnerEl.textContent = 'Could not display image format. Try clicking Previous or another search.';
        prevBtn.style.display = idx > 0 ? '' : 'none';
        nextBtn.style.display = 'none';
        return;
      }
    }

    spinnerEl.style.display = 'none';
    imgEl.src = dataUrl;
    imgEl.style.display = 'block';
    useBtn.style.display = '';
    prevBtn.style.display = idx > 0 ? '' : 'none';
    nextBtn.style.display = idx < candidates.length - 1 ? '' : 'none';
  }

  searchBtn.onclick = () => performSearch(inp.value);
  inp.onkeydown = (e) => { if(e.key === 'Enter') performSearch(inp.value); };
  prevBtn.onclick = () => { if(currentIdx > 0) showCandidate(currentIdx - 1); };
  nextBtn.onclick = () => { if(currentIdx < candidates.length - 1) showCandidate(currentIdx + 1); };

  useBtn.onclick = () => {
    const dataUrl = cachedDataUrls[currentIdx];
    if(!dataUrl) return;

    targetPart.img = dataUrl;
    imgSave(targetPart.id, dataUrl);
    const bp = builtinById(targetPart.id); if(bp) bp.img = dataUrl;
    const cp = custom.find(c => c.id === targetPart.id); if(cp) cp.img = dataUrl;
    if(ed && ed.id === targetPart.id) { ed.img = dataUrl; renderEditor(); }
    thumbInvalidate(targetPart.id);
    renderList();

    close();
    WF.flash('✓ Photo set for ' + targetPart.name + ' — thumbnail updated in list!', 5000);
  };

  performSearch(cleanDefault);
};
const renderEditor=function renderEditor(){
  const p=ed,isB=!!builtinById(p.id),overridden=isB&&custom.some(c=>c.id===p.id);
  const opt=(o,v)=>Object.entries(o).map(([k,n])=>`<option value="${k}"${v===k?' selected':''}>${esc(n)}</option>`).join('');
  $('plEdit').innerHTML=`<div class="plForm">
<div class="plAuto"><b>Fill in automatically</b> <span class="ewNote">(optional, uses the internet and an AI key)</span>
<div class="ewRow"><label>AI <select id="plProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${aiProv()===k?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></label></div>
<div class="ewRow"><button id="plLook" class="primary" title="Type the part number: the free Google Gemini AI searches the web, reads the datasheet and fills in this part as a draft"${aiBusy?' disabled':''}>${aiBusy?'Looking up… please wait':'Look up online…'}</button><button id="plRead" title="Let the AI read a dimension drawing (picture or PDF) you have saved"${aiBusy?' disabled':''}>Read a drawing…</button></div>
<div class="ewRow"><button id="plFind" title="Open a web search for the part's documentation in your browser, to look yourself">Search the web myself…</button><button id="plFindImg" title="Open Google Images for the part's dimension drawings: copy one, then press Ctrl+V here">Search images myself…</button></div>
<div class="ewRow"><button id="plFindFz" title="Search the web for a ready-made part file (.fzpz): it brings the pins, the board size and a picture all at once">Search for a part file (.fzpz)…</button></div>
<div class="ewRow"><button id="plKey">${keyLabel()}</button></div>
${aiProv()==='claude'?'<div class="ewNote">Claude is paid per use from your Anthropic credit: roughly US$0.10–0.40 per web look-up, a few cents to read a drawing (an estimate; it depends how much it reads).</div>':
  aiProv()==='localai'?'<div class="ewNote">Local AI is on this computer: <b>Look up online</b> uses what it already knows, so check every size. It reads pictures of drawings (not PDFs).</div>':
  OA[aiProv()]&&!OA[aiProv()].free?'<div class="ewNote">'+OA[aiProv()].name+' can\'t search the web from here: <b>Look up online</b> uses what it already knows, so check every size. It reads pictures of drawings (not PDFs).</div>':
  isOA()?'<div class="ewNote">'+OA[aiProv()].name+' is free but can\'t search the web: <b>Look up online</b> uses what it already knows, so check every size. It reads pictures of drawings (not PDFs).'+(aiProv()==='openrouter'?' The free tier allows about 50 requests a day.':'')+'</div>':''}
<div class="ewNote"><b>Look up online</b>: type the part number and the AI finds the sizes and fills them in. Or save a dimension drawing and use <b>Read a drawing</b> (or drag it onto the picture, or Ctrl+V). Always check the draft before saving.</div></div>
<label class="f"><span>Name</span><input type="text" data-p="name" value="${p.name==='New part'?'':esc(p.name)}" placeholder="New part: type its name"></label>
<div class="ewRow"><label title="How far this part's sizes can be trusted. Fritzing pictures are drawn for wiring diagrams, so their outlines are often too small: measure the board and use Check size.">Sizes <select data-p="acc">${opt(ACC,accOf(p))}</select></label><button id="plCheck" title="Type the sizes you measured with calipers or a ruler: the outline changes, pins and features keep their spacing">Check size…</button></div>
${accOf(p)==='measured'?'':'<div class="ewNote plSizeWarn">⚠ Sizes can differ a little between makers and batches. <b>If you have this part in your hand, measure it</b> (calipers or a ruler) and compare with the numbers below. If it is different, change the sizes (or use <b>Check size…</b>), then set <b>Sizes</b> to ✅ Measured.</div>'}
<label class="f"><span>Type</span><select data-p="type">${opt(Object.fromEntries(Object.entries(TYPES).map(([k,v])=>[k,v.name])),p.type)}</select></label>
${p.type==='light'?`<label class="f"><span>Colour</span><select data-p="colour">${opt(LED_COLOURS,LED_COLOURS[p.colour]?p.colour:'red')}</select></label><div class="ewNote">Pick the colour of the LED you have. Always put a resistor in series. Typical: red, yellow, orange and green about 330 Ω at 5 V or 150 Ω at 3.3 V; blue and white about 150 Ω at 5 V or 47 Ω at 3.3 V (they need nearly 3 V themselves, so they look dim on 3.3 V).</div>`:''}
<label class="f"><span>Shape</span><select data-p="shape">${opt({rect:'Rectangle',round:'Round'},p.shape)}</select></label>
<label class="f"><span>${p.shape==='round'?'Diameter':'Length (left → right)'}</span><input type="number" data-p="w" value="${p.w}" step="0.1" min="0.5"> mm</label>
${p.shape==='round'?'':`<label class="f"><span>Width (bottom → top)</span><input type="number" data-p="d" value="${p.d}" step="0.1" min="0.5"> mm</label>
<div class="ewRow"><button id="plTurn90" title="Turn the whole part (sizes, picture, features and pins) a quarter turn clockwise, so its long side runs left to right">Turn part 90°</button></div>`}
<label class="f"><span>Board thickness</span><input type="number" data-p="pcb" value="${p.pcb}" step="0.1" min="0"> mm</label>
<label class="f"><span>${p.pcb>0?'Tallest part on top':'Height / thickness'}</span><input type="number" data-p="h" value="${p.h}" step="0.1" min="0"> mm</label>
<div class="ewRow"><label title="Many boards are sold both bare and with header pins already soldered on. Pick which this part is: it changes how far anything sticks out underneath, so the mounting posts and any flex button adjust to match.">Header pins <select data-p="hdr">${opt({on:'Soldered (pins stick out below)',off:'Bare board (no pins)'},p.hdr)}</select></label></div>
<label class="f"><span>With pins fitted</span><input type="number" data-p="belowOn" value="${fx(p.belowOn)}" step="0.1" min="0"> mm</label>
<label class="f"><span>Bare board</span><input type="number" data-p="belowBare" value="${fx(p.belowBare)}" step="0.1" min="0"> mm</label>
<div class="ewNote" style="margin:-2px 0 6px">Used now (Pins / parts underneath): <b>${fx(p.below)} mm</b>.</div>
<label class="f" title="Where this part lives: floor/wall means inside the box; Outside means it goes in the environment (soil probes, outdoor sensors) — the box only needs cable exits for its wires"><span>Usually mounted</span><select data-p="mount">${opt({floor:'Flat on the floor',wall:'Face against a wall',outside:'Outside the enclosure'},p.mount)}</select></label>
<div class="ewNote" style="margin:2px 0 6px">Board thickness 0 = a solid block (battery, speaker). For wall parts, the photo and positions are of the side that faces out.</div>
<div class="ewRow" style="flex-wrap:wrap;gap:4px 14px" title="Keeps that edge back from the wall by this much when the Enclosure Wizard builds the box - for screw terminals, a row of header pins, or anything else that needs working space on a side, even one with no hole through it. 0 = no extra room."><span style="width:100%">Extra room on an edge (mm)</span>${['xmin','xmax','ymin','ymax'].map(s=>`<label style="text-transform:capitalize">${EDGE_NAME[s]} <input type="number" step="0.5" min="0" style="width:52px" data-pec="${s}" value="${fx((p.edgeClear&&p.edgeClear[s])||0)}"></label>`).join('')}</div>
<label>Notes<textarea data-p="notes">${esc(p.notes||'')}</textarea></label>
<h4>Photo</h4>
<div class="ewRow"><button id="plTop">${p.photo?'Replace top photo…':'Top photo…'}</button><button id="plTopSnap" type="button" onclick="openEucSnapModal('top')" title="Snap photo with phone">📱 Snap with phone</button>${p.photo?'<button id="plTurnPhoto90" title="Rotate photo 90° clockwise to align with part outline">↻ Rotate 90°</button><button id="plTurn" title="Turn the photo upside down (180°), if it came out the wrong way round">↻ Rotate 180°</button><button id="plNoPhoto">Remove canvas photo</button>':''}</div>
<div class="ewRow"><button id="plSide">Side photo for heights…</button><button id="plSideSnap" type="button" onclick="openEucSnapModal('side', 'wifi')" title="Snap side photo with phone">📱 Snap side photo</button><label>shows the <select id="plSideRef"><option value="w"${sideRef==='w'?' selected':''}>long side</option><option value="d"${sideRef==='d'?' selected':''}>short side</option></select></label></div>
<h4>Product image</h4>
<div class="ewNote" style="margin-bottom:6px">A catalog or identification photo — used strictly as the thumbnail icon in the parts list on the left.</div>
<div class="ewRow"><button id="plFindProductImg" class="primary" type="button" title="Search online photo to identify this part in the list on the left">🔍 Find photo online…</button>${p.img?`<button id="plImgReplace">Replace from disk…</button><button id="plNoImg">Remove thumbnail</button>`:`<button id="plImgAdd">Upload from disk…</button>`}</div>
${p.img?`<div style="margin:4px 0 2px"><img src="${esc(p.img)}" style="max-height:88px;max-width:200px;border:1px solid var(--line);border-radius:4px;object-fit:contain;background:var(--panel-hover)"></div>`:''}
<h4>Features <span class="ewNote">(${p.features.length})</span></h4>
<label class="f" title="Where the X and Y numbers of features and pins are measured from (the red 0,0 mark on the picture). It only changes the numbers shown, not the part."><span>Measure from</span><select id="plOrigin">${opt(ORIGINS,orig())}</select></label>
<div id="plFeats"></div>
<div class="ewRow" style="margin-top:10px"><button id="plTypical" title="Add the features this type of part usually has">Add typical features</button></div>
<h4>Pins <span class="ewNote">(${(p.pins||[]).length}) for the wiring diagram</span></h4>
${(p.pins||[]).length?`<table class="plPins"><tr class="hd"><td>Name</td><td title="${esc(posTip('x'))}">${posLabel('x')}</td><td title="${esc(posTip('y'))}">${posLabel('y')}</td><td>Role</td><td></td></tr>${p.pins.map((q,i)=>`<tr data-prow="${i}"${i===edPin?' class="on"':''}><td style="width:30%"><input data-pn="${i}" value="${esc(q.n)}"></td><td style="width:58px"><input type="number" step="0.1" data-px="${i}" value="${q.x===undefined?'':fx(toShow('x',q.x))}" placeholder="–"></td><td style="width:58px"><input type="number" step="0.1" data-py="${i}" value="${q.y===undefined?'':fx(toShow('y',q.y))}" placeholder="–"></td><td><select data-pr="${i}">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}"${q.r===k?' selected':''}>${esc(v)}</option>`).join('')}</select></td><td style="width:22px"><button class="x" data-pdel="${i}" title="Delete this pin">✕</button></td></tr>`).join('')}</table>`:'<div class="ewNote">No pins yet. Click Import pins…, or add them here.</div>'}
<div class="ewRow"><button id="plPinAdd">+ Pin</button><button id="plFz" title="Take this part's pins (names and positions) and picture from a parts library on this computer, or from a part file (.fzpz)">Import pins…</button></div>
<div class="ewRow plActions"><button id="plSave" class="primary">Save part</button><button id="plDup">Duplicate</button>
${!isB ? '<button id="plDel" class="sec danger" style="color:var(--danger,var(--danger));border-color:var(--danger-border);background:var(--danger-subtle);font-weight:500" title="Delete this custom part from your library">Delete</button>' : (overridden ? '<button id="plReset" title="Reset changes back to original built-in part">Reset to original</button>' : '')}<button id="plUse" title="Add this part to the Enclosure Wizard">Use in enclosure</button></div>
</div>
<div class="plCanvasCol"><div class="plPal" id="plPal"><button data-mode="select" class="${edMode==='select'?'on':''}">Select / move</button>${Object.entries(FEAT).map(([k,v])=>`<button data-mode="add:${k}" class="${edMode==='add:'+k?'on':''}" title="${esc(v.tip)}">+ ${esc(v.name)}</button>`).join('')}</div>
<div class="plHint" id="plHint"></div>
<div class="ewCanvasWrap"><canvas id="plCanvas" tabindex="0"></canvas><div id="plXY"></div><div class="plCanvasBtns"><button id="plRotatePart90Btn" type="button" title="Rotate part 90° clockwise (photo, sizes, pins & ports all rotate together)">↻ Rotate 90°</button><button id="plBigBtn" type="button" title="Show the picture across the whole window, to read small pins (or double-click the picture). Esc goes back.">${plBig?'✕ Smaller picture':'⤢ Bigger picture'}</button></div>${refDraw&&edMode!=='corners'&&edMode!=='side'?`<div id="plRef" class="${refDraw.big?'big':''}" title="Click to make bigger or smaller"><button id="plRefX" title="Hide this reference picture">✕</button>${refDraw.url?`<img src="${refDraw.url}" alt="">`:'<div class="pdf">PDF</div>'}<span>${esc(refDraw.name)}</span></div>`:''}</div></div>`;
  renderFeats();setHint();drawEd();
};
const renderFeats=function renderFeats(){
  const box=$('plFeats');if(!box)return;
  box.innerHTML=ed.features.map((f,i)=>{
    const fields=fieldsOf(f).map(k=>{
      if(k==='thru')return `<label>${FLABEL[k]} <select data-fi="${i}" data-fk="thru">${Object.entries(THRU).map(([v,n])=>`<option value="${v}"${(f.thru||'wall')===v?' selected':''}>${n}</option>`).join('')}</select></label>`;
      if(k==='lid')return `<label>${FLABEL[k]} <select data-fi="${i}" data-fk="lid">${Object.entries(BUTTON_LID).map(([v,n])=>`<option value="${v}"${(f.lid||'hole')===v?' selected':''}>${n}</option>`).join('')}</select></label>`;
      if(k==='shape')return `<label>${FLABEL[k]} <select data-fi="${i}" data-fk="shape"><option value="round"${f.shape!=='rect'?' selected':''}>round</option><option value="rect"${f.shape==='rect'?' selected':''}>rectangle</option></select></label>`;
      if(f.t==='cutout'&&(k==='cw'||k==='ch'))return `<label>${k==='cw'?(f.shape==='rect'?(isEdge(f)?'Width':'Length'):'Ø'):(isEdge(f)?'Height':'Width')} <input type="number" step="0.1" data-fi="${i}" data-fk="${k}" value="${fx(f[k])}"></label>`;
      if(k==='side')return `<label>${FLABEL[k]} <select data-fi="${i}" data-fk="side">${['xmin','xmax','ymin','ymax'].map(s=>`<option value="${s}"${f.side===s?' selected':''}>${EDGE_NAME[s]}</option>`).join('')}</select></label>`;
      if(k==='dir')return `<label>${FLABEL[k]} <select data-fi="${i}" data-fk="dir"><option value="down"${f.dir==='down'?' selected':''}>down</option><option value="up"${f.dir==='up'?' selected':''}>up</option></select></label>`;
      if(k==='kind')return `<label>${FLABEL[k]} <select data-fi="${i}" data-fk="kind">${Object.keys(PORT_KINDS).map(s=>`<option${f.kind===s?' selected':''}>${esc(s)}</option>`).join('')}</select></label>`;
      if(k==='mount')return `<label>${FLABEL[k]} <select data-fi="${i}" data-fk="mount"><option value="screw"${(f.mount||'screw')==='screw'?' selected':''}>Screw post (pilot hole)</option><option value="peg"${f.mount==='peg'?' selected':''}>Push-fit peg</option></select></label>`;
      return isPos(k)?`<label title="${esc(posTip(k==='u'?(f.side==='xmin'||f.side==='xmax'?'y':'x'):k))}">${posLabel(k,f.side)} <input type="number" step="0.1" data-fi="${i}" data-fk="${k}" value="${fx(toShow(k,f[k],f.side))}"></label>`
        :`<label>${FLABEL[k]} <input type="number" step="0.1" data-fi="${i}" data-fk="${k}" value="${fx(f[k])}"></label>`;
    }).join('');
    return `<div class="plFeat${i===edSel?' on':''}" data-fsel="${i}"><div class="hd" data-fsel="${i}"><span data-fsel="${i}">${esc(FEAT[f.t].name)}</span><button class="x" data-fdel="${i}" title="Delete this feature">✕</button></div><div class="fl">${fields}</div>${f.t==='button'?`<div class="ewNote" style="margin-top:3px">${BUTTON_HELP[f.lid||'hole']}</div>`:''}</div>`;
  }).join('')||'<div class="ewNote">None yet. Pick a feature above the picture, then click or drag on the part. Ports, antennas and switches go on an edge.</div>';
};
const HINTS={
  select:()=>ed.features.length||(ed.pins||[]).some(q=>q.x!==undefined)?'Click a feature or a gold pin to select it, drag to move it (it snaps to 0.5 mm; hold Alt for 0.1 mm). Arrow keys nudge it 0.1 mm (Shift: 1 mm). Pick a "+" button to add a feature.':'Pick a feature button above, then click or drag on the part to place it.',
  corners:()=>ed.shape==='round'?`Click 3 points around the edge of the round board (${clicks.length}/3).`:`Click the 4 corners of the board in order: top-left, top-right, bottom-right, bottom-left (${clicks.length}/4). Take the photo from straight above if you can.`,
  side:()=>['Click the LEFT end of the board, at the bottom of the board','Click the RIGHT end of the board, at the bottom of the board','Click the TOP surface of the board','Click the TOP of the tallest part','Click the bottom tip of the pins underneath'][clicks.length]||''
};
const setHint=function setHint(){
  const h=$('plHint');if(!h)return;
  if(edMode.startsWith('add:')){const k=edMode.slice(4),f=FEAT[k];
    h.innerHTML=esc(EDGE_FEATS.includes(k)?`Click on the edge where the ${f.name.toLowerCase()} is.`:RECT_FEATS.includes(k)?`Drag a box over the ${f.name.toLowerCase()}.`:`Click the centre of the ${f.name.toLowerCase()}.`)+' <span class="ewNote">'+esc(f.tip)+'</span>';return;}
  if(edMode==='select'&&aiBusy){h.textContent=aiBusy;return;}
  if(edMode==='select'&&aiNote){h.innerHTML=aiNote+'<button id="plAiOk">OK</button>';return;}
  h.innerHTML=esc(HINTS[edMode]())+(edMode==='side'&&clicks.length===4?'<button id="plNoPins">No pins underneath</button>':'')+(edMode!=='select'?'<button id="plCancelPhoto">Cancel</button>'+(clicks.length?'<button id="plUndoClick">Undo click</button>':''):'');
};
const markDirty=function markDirty(){edDirty=true;};
$('plEdit').addEventListener('input',e=>{
  const el=e.target;
  if(el.dataset.p){const k=el.dataset.p;ed[k]=el.type==='number'?num(el.value,ed[k]):k==='name'?(el.value.trim()?el.value:'New part'):el.value;if(k==='w'&&ed.shape==='round')ed.d=ed.w;if(k==='belowOn'||k==='belowBare')ed.below=ed.hdr==='off'?num(ed.belowBare,0):num(ed.belowOn,0);markDirty();drawEd();return;}
  if(el.dataset.fk&&el.type==='number'){const f=ed.features[+el.dataset.fi],k=el.dataset.fk;
    if(isPos(k)){const v=parseFloat(el.value);if(isFinite(v))f[k]=+fromShow(k,v,f.side).toFixed(2);}else f[k]=num(el.value,f[k]);
    edSel=+el.dataset.fi;edPin=-1;markDirty();drawEd();}
  if(el.dataset.pn!==undefined){ed.pins[+el.dataset.pn].n=el.value;markDirty();drawEd();}
  if(el.dataset.px!==undefined||el.dataset.py!==undefined){// a pin's position, typed
    const k=el.dataset.px!==undefined?'x':'y',i=+(k==='x'?el.dataset.px:el.dataset.py),q=ed.pins[i],v=parseFloat(el.value);if(!isFinite(v))return;
    if(q.x===undefined){q.x=+fromShow('x',0).toFixed(2);q.y=+fromShow('y',0).toFixed(2);}
    q[k]=+fromShow(k,v).toFixed(2);edPin=i;edSel=-1;updPinRow(i,el);markDirty();drawEd();}
  if(el.dataset.pec){ed.edgeClear=ed.edgeClear||{};ed.edgeClear[el.dataset.pec]=Math.max(0,num(el.value,0));markDirty();}
});
$('plEdit').addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.p==='shape'){if(ed.shape==='round')ed.d=ed.w;renderEditor();return;}
  if(el.dataset.p==='type'){if(!edDirty||!ed.features.length)ed.mount=TYPES[ed.type].mount;renderEditor();return;}
  if(el.dataset.p==='hdr'){ed.hdr=el.value;ed.below=ed.hdr==='off'?num(ed.belowBare,0):num(ed.belowOn,0);markDirty();renderEditor();return;}
  if(el.id==='plSideRef'){sideRef=el.value;return;}
  if(el.dataset.pr!==undefined){const q=ed.pins[+el.dataset.pr];q.r=el.value;if(q.r==='gpio'&&q.g===undefined){const m=q.n.match(/(\d+)/);if(m)q.g=+m[1];}markDirty();return;}
  if(el.id==='plProv'){WF.store.set('aiProvider',el.value);renderEditor();if(!aiKey())WF.flash('Click "'+keyLabel()+'" to add the key for this AI',5000);return;}
  if(el.id==='plOrigin'){WF.store.set('partOrigin',el.value);const fm=document.querySelector('.plForm'),st=fm?fm.scrollTop:0;renderEditor();const f2=document.querySelector('.plForm');if(f2)f2.scrollTop=st;return;}
  if(el.dataset.fk&&el.tagName==='SELECT'){
    const f=ed.features[+el.dataset.fi];
    if(el.dataset.fk==='thru')setThru(f,el.value);else f[el.dataset.fk]=el.value;
    // a first guess for a new flex button: a small switch on the board, the part resting on what sticks out underneath
    if(el.dataset.fk==='lid'&&el.value==='flex'&&f.btop===FEAT.button.def.btop)f.btop=+(ed.below+ed.pcb+1.5).toFixed(2);
    if(el.dataset.fk==='kind'&&PORT_KINDS[el.value]){[f.pw,f.ph]=PORT_KINDS[el.value];}
    markDirty();renderFeats();drawEd();
  }
});
$('plEdit').addEventListener('click',async e=>{
  const el=e.target,id=el.id;
  if(el.dataset.mode){edMode=el.dataset.mode;clicks=[];rawImg=null;document.querySelectorAll('#plPal button').forEach(b=>b.classList.toggle('on',b===el));setHint();drawEd();return;}
  if(el.dataset.fdel!==undefined){ed.features.splice(+el.dataset.fdel,1);edSel=-1;markDirty();renderFeats();drawEd();return;}
  if(el.dataset.fsel!==undefined&&el.tagName!=='INPUT'&&el.tagName!=='SELECT'){edSel=+el.dataset.fsel;renderFeats();drawEd();return;}
  if(id==='plFindProductImg'){
    openPhotoFinderModal(ed);
    return;
  }
  if(id==='plTop'){pickPhoto('top');return;}
  if(id==='plSide'){pickPhoto('side');return;}
  if(id==='plNoPhoto'){
    delete ed.photo; photoDel(ed.id);
    const bp=builtinById(ed.id); if(bp) delete bp.photo;
    const cp=custom.find(c=>c.id===ed.id); if(cp) delete cp.photo;
    drawEd(); renderEditor(); return;
  }
  if(id==='plTurnPhoto90'){turnPhoto90();return;}
  if(id==='plTurn'){turnPhoto();return;}
  if(id==='plImgAdd'||id==='plImgReplace'){$('plImgIn').click();return;}
  if(id==='plNoImg'){
    delete ed.img; imgDel(ed.id);
    const bp=builtinById(ed.id); if(bp) delete bp.img;
    const cp=custom.find(c=>c.id===ed.id); if(cp) delete cp.img;
    thumbInvalidate(ed.id); renderEditor(); renderList(); return;
  }
  if(id==='plRotatePart90Btn'||id==='plTurn90'){turnPart(ed).then(()=>{markDirty();renderEditor();renderList();WF.flash('Part rotated 90°: photo, sizes, pins & ports moved together.',6000);});return;}
  if(el.dataset.pdel!==undefined){ed.pins.splice(+el.dataset.pdel,1);edPin=-1;markDirty();renderEditor();return;}
  if(id==='plPinAdd'){(ed.pins=ed.pins||[]).push({n:'PIN '+(ed.pins.length+1),r:'sig'});markDirty();renderEditor();return;}
  if(id==='plFz'){fritzingImport();return;}
  if(id==='plFind'){findDrawings(false);return;}
  if(id==='plFindImg'){findDrawings(true);return;}
  if(id==='plFindFz'){findPartFile();return;}
  if(id==='plLook'){lookupOnline();return;}
  if(el.tagName==='A'&&el.dataset.ext){e.preventDefault();openWeb(el.href);return;}
  if(id==='plRead'){$('plDrawIn').click();return;}
  if(id==='plKey'){askKey();return;}
  if(id==='plAiOk'){aiNote='';setHint();return;}
  if(id==='plAiReply'){WF.askText('This is exactly what Google sent back. To get help, take a screenshot of this box.\n\n'+aiLastReply.slice(0,2500),'');return;}
  if(id==='plAiBug'){WF.askText('A bug in EvenUCan, not something you did. To report it, take a screenshot of this box.\n\n'+aiBugDetail.slice(0,2500),'');return;}
  if(id==='plRefX'){clearRef();renderEditor();return;}
  if(el.closest&&el.closest('#plRef')){refDraw.big=!refDraw.big;$('plRef').classList.toggle('big',refDraw.big);return;}
  if(id==='plBigBtn'){setBig(!plBig);return;}
  if(id==='plCheck'){checkSize();return;}
  if(id==='plCancelPhoto'){edMode='select';clicks=[];rawImg=null;renderEditor();return;}
  if(id==='plUndoClick'){clicks.pop();setHint();drawEd();return;}
  if(id==='plNoPins'){finishSide(null);return;}
  if(id==='plTypical'){addTypical();return;}
  if(id==='plSave'){savePart();return;}
  if(id==='plDup'){const c=clone(ed);c.id=newPartId();c.name=ed.name+' (copy)';delete c.builtin;ed=c;edDirty=true;savePart();return;}
  if(id==='plDel'){if(!confirm('Delete "'+ed.name+'" from your library?'))return;const _delId=ed.id,_delName=ed.name;custom=custom.filter(c=>c.id!==_delId);photoDel(_delId);saveLib();thumbInvalidate(_delId);edDirty=false;selectPart(allParts()[0].id,true);WF.flash('Deleted "'+_delName+'" from your library');return;}
  if(id==='plReset'){if(!confirm('Put "'+ed.name+'" back to the original built-in part?'))return;custom=custom.filter(c=>c.id!==ed.id);saveLib();edDirty=false;selectPart(ed.id,true);return;}
  if(id==='plUse'){if(edDirty&&!savePart())return;wiz.items.push({pid:ed.id,qty:1,mount:'auto',wall:'auto'});saveWiz();lay=null;WF.flash(ed.name+' added to the Enclosure Wizard');openWizard();}
});
const savePart=function savePart(){
  const p=tidyPart(ed);
  if(!p.name.trim())return WF.flash('Give the part a name first'),false;
  if(p.shape==='round')p.d=p.w;
  const c=clone(p);delete c.builtin;
  const i=custom.findIndex(x=>x.id===c.id);if(i>=0)custom[i]=c;else custom.push(c);
  if(!saveLib()){if(i<0)custom.pop();return false;}
  thumbInvalidate(c.id);
  edDirty=false;lay=null;renderList();renderEditor();WF.flash('Saved "'+p.name+'"');return true;
};
$('plNew').onclick=()=>{
  if(edDirty&&!confirm('Discard the changes to "'+ed.name+'"?'))return;
  ed=tidyPart({id:newPartId(),name:'New part',type:'board',shape:'rect',w:30,d:20,pcb:1.6,h:3,below:0,mount:'floor',features:[]});clearRef();
  edDirty=true;edSel=-1;edMode='select';clicks=[];renderList();renderEditor();
  WF.flash('Type the size, or load a top photo and click its corners',4000);
};
$('plX').onclick=closeLibrary;
// A small dialog with named buttons; resolves to the index of the button clicked, or -1 (Esc / outside).
const choose=function choose(message,buttons){
  return new Promise(done=>{
    const back=document.createElement('div');back.id='askBack';
    back.innerHTML='<div id="askBox"><div class="msg"></div><div class="btns"></div></div>';
    back.querySelector('.msg').textContent=message;
    const row=back.querySelector('.btns');
    buttons.forEach((b,i)=>{const el=document.createElement('button');el.textContent=b;if(!i)el.dataset.ok='1';el.onclick=()=>fin(i);row.appendChild(el);});
    const fin=i=>{back.remove();done(i);};
    back.addEventListener('mousedown',e=>{if(e.target===back)fin(-1);});
    back.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')fin(-1);});
    document.body.appendChild(back);row.firstChild.focus();
  });
};
$('plExport').onclick=async()=>{
  if(!custom.length)return WF.flash('You have no parts of your own yet (built-in parts are already in every copy of the app)');
  let parts=custom;
  if(custom.some(p=>p.photo||p.img)){
    const c=await choose('Some of your parts have photos or product images.\n\nPhotos you took yourself are fine to share. Images downloaded from websites belong to whoever took them, so leave them out when giving parts to other people.',['Export without images','Export with images','Cancel']);
    if(c<0||c===2)return;
    if(c===0)parts=custom.map(p=>{const q=clone(p);delete q.photo;delete q.img;return q;});
  }
  WF.download('EvenUCan parts.json',JSON.stringify({app:'EvenUCan',kind:'parts',version:1,parts},null,1),'application/json');
};
$('plImport').onclick=()=>$('plFile').click();
$('plMeasure').onclick=()=>openPhotoMeasurement();
$('plSnapBtn').onclick=()=>{
  if(!ed){
    $('plNew').click();
  }
  openEucSnapModal('top', 'wifi');
};
$('plFzBulk').onclick=()=>{$('fzImLog').innerHTML='';$('fzImBack').style.display='grid';};// opens in-app drop dialog
$('plBrowse').onclick=()=>browseParts();
$('plFile').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    const d=JSON.parse(await file.text()),list=Array.isArray(d)?d:d.parts;
    if(!Array.isArray(list))throw new Error('no parts');
    let n=0;
    for(const raw of list){
      if(!raw||typeof raw!=='object')continue;
      const p=tidyPart(clone(raw));p.name=String(p.name||'Imported part');
      if(!p.id||(custom.some(c=>c.id===p.id)&&!builtinById(p.id)))p.id=newPartId();
      // Save any embedded photo to sidecar before saveLib strips it
      if(p.photo&&p.photo.startsWith('data:'))photoSave(p.id,p.photo);
      const i=custom.findIndex(c=>c.id===p.id);if(i>=0)custom[i]=p;else custom.push(p);n++;
    }
    saveLib();lay=null;renderList();WF.flash('Imported '+n+' part'+(n===1?'':'s'));
  }catch(err){WF.flash('That file has no EvenUCan parts in it');}
});

// Receive scanned part directly from Photo Measuring tool (measure-part.html)
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'evenucan_add_part' && e.data.part) {
    const raw = e.data.part;
    const p = tidyPart(clone(raw));
    p.name = String(p.name || 'Measured part');
    if (!p.id || (custom.some(c => c.id === p.id) && !builtinById(p.id))) p.id = newPartId();
    if (p.photo && p.photo.startsWith('data:')) photoSave(p.id, p.photo);
    const i = custom.findIndex(c => c.id === p.id);
    if (i >= 0) custom[i] = p; else custom.push(p);
    saveLib();
    lay = null;
    renderList();
    if (typeof WF !== 'undefined' && WF.flash) {
      WF.flash('✓ Added "' + p.name + '" (' + (p.pins ? p.pins.length : 0) + ' pins) to Parts Library!', 8000);
    }
  }
});
