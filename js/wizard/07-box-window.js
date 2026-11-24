// EvenUCan Enclosure Wizard - 07-box-window.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- wizard window
let lay=null,selIt=null,layTimer=0,view=null,drag=null;
const ewBack=$('ewBack'),plBack=$('plBack');
const busy=msg=>{$('ewBusy').textContent=msg;$('ewGen').disabled=!!msg;};
const openWizard=function openWizard(){
  plBack.style.display='none';ewBack.style.display='grid';renderSide();
  if(!lay)runAuto();else{drawLayout();$('ewInfo').innerHTML=lay.error?'<span class="bad">'+esc(lay.error)+'</span>':report(lay);}
  $('ewCanvas').focus();drawGuide();
};
const closeWizard=function closeWizard(){ewBack.style.display='none';drawGuide();};
const runAuto=function runAuto(){
  busy('Arranging…');$('ewInfo').innerHTML='<span class="ewNote">Working out the smallest box…</span>';
  clearTimeout(layTimer);
  layTimer=setTimeout(()=>{
    try{lay=autoLayout();}catch(e){console.error(e);lay={error:'Layout failed: '+e.message};}
    selIt=null;busy('');drawLayout();
    $('ewInfo').innerHTML=lay.error?'<span class="bad">'+esc(lay.error)+'</span>':report(lay);
  },30);
};
const partOptions=function partOptions(sel,filter){
  return allParts().filter(filter||(()=>true)).map(p=>`<option value="${esc(p.id)}"${p.id===sel?' selected':''}>${esc(p.name)}</option>`).join('');
};
const smartHints=function smartHints(){
  if(!wiz.items.length)return'';
  const pts=wiz.items.map(it=>partById(it.pid)).filter(Boolean);
  const tx=p=>((p.title||'')+' '+(p.family||'')+' '+(p.tags||[]).join(' ')).toLowerCase();
  const hasSpeaker=pts.some(p=>/speaker|buzzer|piezo/.test(tx(p)));
  const hasMic=pts.some(p=>/microphone|\bmic\b/.test(tx(p)));
  const hasDisplay=pts.some(p=>partKind(p)==='display');
  const hasStepper=pts.some(p=>/stepper/.test(tx(p)));
  const hasDriver=pts.some(p=>/a4988|drv8825|tb67|l298|l293|uln2003|motor.?driver|stepper.?driver/.test(tx(p)));
  const h=[];
  if(hasSpeaker)h.push('<div class="ewHint">🔊 <b>Speaker / buzzer</b> — plan a ventilation grill on the facing wall so sound can get out</div>');
  if(hasMic)h.push('<div class="ewHint">🎙 <b>Microphone</b> — plan a small hole, ideally centred on the facing wall</div>');
  if(hasDisplay)h.push('<div class="ewHint">📺 <b>Display</b> — plan a viewport cutout on the facing wall or lid</div>');
  if(hasStepper&&!hasDriver)h.push('<div class="ewHint">⚙️ <b>Stepper motor</b> — also needs a motor driver (A4988, DRV8825…) — consider adding it to your parts list</div>');
  return h.length?'<div class="ewHints"><b>💡 Things to plan:</b>'+h.join('')+'</div>':'';
};
const renderSide=function renderSide(){
  const s=$('ewSide');
  const rows=wiz.items.map((it,i)=>{
    const p=partById(it.pid);
    if(!p)return `<div class="ewPart"><div class="nm"><span class="bad">Missing part (deleted from the library)</span><button class="x" data-del="${i}">✕</button></div></div>`;
    const effMount=it.mount==='auto'?(p.mount||typeOf(p).mount):it.mount;
    const hasPort=(p.features||[]).some(f=>(f.t==='port'||f.t==='switch'||f.t==='cutout')&&isEdge(f)),wallM=effMount==='wall';
    const wallSel=(hasPort||wallM)&&effMount!=='outside'?`<label>${wallM?'Wall':'Port faces'} <select data-k="wall" data-i="${i}">${['auto','xmin','xmax','ymin','ymax'].map(v=>`<option value="${v}"${it.wall===v?' selected':''}>${v==='auto'?'Auto':SIDE_NAME[v]}</option>`).join('')}</select></label>`:'';
    const autoLabel=effMount==='outside'?'outside':effMount==='wall'?'wall':'floor';
    return `<div class="ewPart"><div class="nm"><span title="${esc(p.name)}">${esc(p.name)}</span><label title="How many">× <input type="number" min="1" max="10" step="1" data-k="qty" data-i="${i}" value="${esc(it.qty||1)}"></label><button class="x" data-del="${i}" title="Remove from the box">✕</button></div>
<div class="ewRow"><label>Mount <select data-k="mount" data-i="${i}"><option value="auto"${it.mount==='auto'?' selected':''}>Auto (${autoLabel})</option><option value="floor"${it.mount==='floor'?' selected':''}>Floor</option><option value="wall"${it.mount==='wall'?' selected':''}>Against a wall</option><option value="outside"${it.mount==='outside'?' selected':''}>Outside the enclosure</option></select></label>${wallSel}</div>${effMount==='outside'?'<div class="ewNote" style="margin:-2px 0 4px">This part lives outside the box — only wire exits are needed. It won\'t be counted in the box size.</div>':''}</div>`;
  }).join('');
  const st=wiz.style;
  s.innerHTML=`<h4>1. Parts in the box</h4>
<div class="ewRow"><input id="ewAddSearch" type="search" placeholder="Search all parts…" style="flex:1;min-width:0" autocomplete="off"><button id="ewAdd">Add</button></div>
<div class="ewRow" id="ewAddSelRow"><select id="ewAddSel" style="flex:1;width:100%">${partOptions(null)}</select></div>
<div class="ewNote">Not in the list? Open the <a href="#" id="ewLib2">Parts Library</a> to add one from a photo.</div>
<div class="mfNote">📏 <b>Check your sizes.</b> Parts with the same part number can differ in size from one maker to the next. The box is built from the sizes in your list, so measure the real part in your hand, compare it with the built-in one, and correct it in the Parts Library if it differs. If the sizes are not right, the box cannot be guaranteed to fit.</div>
${rows||'<div class="ewNote">No parts yet.</div>'}
<h4>2. Power</h4>
<div class="ewRow" style="flex-wrap:wrap"><label><input type="radio" name="ewPow" value="usb"${wiz.power!=='battery'&&wiz.power!=='mains'?' checked':''}> USB cable</label><label><input type="radio" name="ewPow" value="mains"${wiz.power==='mains'?' checked':''}> Mains adapter (USB plug)</label><label><input type="radio" name="ewPow" value="battery"${wiz.power==='battery'?' checked':''}> Battery inside</label></div>
${wiz.power==='battery'?`<div class="ewRow"><label style="flex:1">Battery <select data-w="battery" style="flex:1">${partOptions(wiz.battery,p=>p.type==='battery')}</select></label></div>
<div class="ewRow"><label style="flex:1">Charger <select data-w="charger" style="flex:1"><option value="">None</option>${partOptions(wiz.charger,p=>p.type==='charger')}</select></label></div>
<div class="ewRow"><label><input type="checkbox" data-w="sw"${wiz.sw?' checked':''}> On/off switch</label><select data-w="swPart" style="flex:1">${partOptions(wiz.swPart,p=>p.type==='switch')}</select></div>
<div class="ewNote">The charger is kept near the battery; the battery is kept away from the speaker magnet and the antenna.</div>
<div class="ewNote" style="margin-top:5px;padding:7px 10px;background:var(--warn-subtle);border-left:3px solid var(--warn);border-radius:3px;line-height:1.5">🔋 <b>Battery reminder:</b> it will need periodic recharging. EvenUCan will include code to send your phone an alert when the battery reaches 20% — make sure your ntfy topic is set up in the ESPHome tab so the alert gets through.</div>`:''}
<h4>3. Style</h4>
<div class="ewStyle">${Object.entries(STYLES).map(([k,v])=>`<label class="${st===k?'on':''}"><input type="radio" name="ewSty" value="${k}"${st===k?' checked':''}><b>${esc(v.name)}</b>${esc(v.desc)}</label>`).join('')}</div>
${STYLES[st].groove?`<div class="ewRow"><label><input type="checkbox" data-w="gasket"${wiz.gasket?' checked':''}> Also print a TPU gasket for the groove</label></div>`:''}
<h4>4. Lid</h4>
<select data-w="lid" style="width:100%">${Object.entries(LIDS).map(([k,v])=>`<option value="${k}"${wiz.lid===k?' selected':''}>${esc(v)}</option>`).join('')}</select>
<h4>5. Box size</h4>
<div class="ewRow"><select data-w="size"><option value="auto"${wiz.size==='auto'?' selected':''}>Smallest that fits</option><option value="min"${wiz.size==='min'?' selected':''}>At least this big</option><option value="exact"${wiz.size==='exact'?' selected':''}>Exactly this size</option></select></div>
${wiz.size!=='auto'?`<div class="ewRow"><label>W <input type="number" data-w="sW" value="${esc(wiz.sW)}" min="10"></label><label>D <input type="number" data-w="sD" value="${esc(wiz.sD)}" min="10"></label><label>H <input type="number" data-w="sH" value="${esc(wiz.sH)}" min="5"></label><span class="ewNote">inside, mm</span></div>`:''}
<h4>Fine tuning</h4>
<div class="ewRow"><label>Wall thickness <input type="number" data-w="wallT" value="${esc(wiz.wallT)}" min="0.8" step="0.2" placeholder="${STYLES[st].wall}"> mm</label></div>
<div class="ewRow"><label>Gap between parts <input type="number" data-w="gapOv" value="${esc(wiz.gapOv)}" min="0" step="0.5" placeholder="${STYLES[st].gap}"> mm</label></div>
<div class="ewNote">Leave blank to use the style's own value.</div>
<div class="ewRow"><label><input type="checkbox" data-w="inserts"${wiz.inserts?' checked':''}> Heat-set insert stand-offs for boards with screw holes</label></div>
<div class="ewNote">Boards with holes get posts sized for brass inserts (M2 to M5); boards without holes still sit on rails with end stops. For a board in a box you draw yourself, use <b>Board mount</b> on the toolbar.</div>${smartHints()}`;
};
const wizChanged=function wizChanged(rerender){saveWiz();if(rerender)renderSide();runAuto();};
$('ewSide').addEventListener('change',e=>{
  const el=e.target;
  if(el.name==='ewPow'){wiz.power=el.value;return wizChanged(true);}
  if(el.name==='ewSty'){wiz.style=el.value;wiz.lid=STYLES[el.value].lid;return wizChanged(true);}
  if(el.dataset.k){const it=wiz.items[+el.dataset.i];if(!it)return;it[el.dataset.k]=el.dataset.k==='qty'?Math.max(1,Math.min(10,Math.round(num(el.value,1)))):el.value;return wizChanged(el.dataset.k==='mount');}
  if(el.dataset.w){const k=el.dataset.w;wiz[k]=el.type==='checkbox'?el.checked:el.value;return wizChanged(k==='size');}
});
$('ewSide').addEventListener('click',e=>{
  const el=e.target;
  if(el.dataset.del!==undefined){wiz.items.splice(+el.dataset.del,1);return wizChanged(true);}
  if(el.id==='ewAdd'){const sel=$('ewAddSel');const id=sel&&sel.value;if(id){const isDb=id.startsWith('__db:');const isAi=id.startsWith('__ai:');if(isDb){const raw=JSON.parse(decodeURIComponent(id.slice(5)));const part=_int.lookupToPart(_int._dbToLookupData(raw,raw.title||''),raw.title||'');part.source=raw._dbSrc||'';part.notes='Pin positions and board size from '+part.source+'. Component height is estimated at '+part.h+' mm.';custom.push(part);saveLib();WF.flash('Added "'+part.name+'" to your library',4000);wiz.items.push({pid:part.id,qty:1,mount:'auto',wall:'auto'});wizChanged(true);}else if(isAi){const q=id.slice(5);(async()=>{if(!aiKey()){await askKey();if(!aiKey())return;}WF.flash('Asking AI for "'+q+'"…',8000);try{const {data:d}=await callAI(_int.LOOKUP_PROMPT+'\n\nThe part: "'+q+'"');if(!d||typeof d!=='object')throw new Error('no data');if(d.unknown)return WF.flash('The AI doesn\'t know this part. Try a more specific name.',6000);if(!(parseFloat(d.width_mm)>0))throw new Error('no sizes');const part=_int.lookupToPart(d,q);custom.push(part);if(!saveLib()){custom.pop();return WF.flash('Couldn\'t save the part.',4000);}WF.flash('Added "'+part.name+'" to your library (marked ⚠ Approximate)',5000);wiz.items.push({pid:part.id,qty:1,mount:'auto',wall:'auto'});wizChanged(true);}catch(e){WF.flash('AI parts lookup failed: '+(e.message||e),6000);}})();}else{wiz.items.push({pid:id,qty:1,mount:'auto',wall:'auto'});wizChanged(true);}}}
  if(el.id==='ewLib2'){e.preventDefault();openLibrary();}
});
let _ewSearchTimer=null;
$('ewSide').addEventListener('input',async e=>{
  if(e.target.id!=='ewAddSearch')return;
  clearTimeout(_ewSearchTimer);
  _ewSearchTimer=setTimeout(async()=>{
    const q=e.target.value.trim();
    const sel=$('ewAddSel');
    if(!sel)return;
    if(!q){sel.innerHTML=partOptions(null);return;}
    const qw=q.toLowerCase().split(/\W+/).filter(w=>w.length>0);
    if(!qw.length)return;
    // Score a haystack string against the query words
    const sc=(hay)=>{const h=hay.toLowerCase();const full=qw.join(' ');if(h.includes(full))return 1000;return qw.reduce((s,w)=>s+(h.includes(w)?1:0),0);};
    // Search own library first
    const ownHits=[];
    for(const p of allParts()){
      const hay=[p.name,p.category||'',p.protocol||'',(p.pins||[]).map(x=>x.n).join(' ')].join(' ');
      const s=sc(hay);if(s>0)ownHits.push({s,name:p.name,id:p.id,own:true});
    }
    // Show own library hits + AI search option (JSON databases disconnected)
    ownHits.sort((a,b)=>b.s-a.s);
    let html='';
    if(ownHits.length){html+='<optgroup label="Your library">';for(const h of ownHits)html+=`<option value="${esc(h.id)}">${esc(h.name)}</option>`;html+='</optgroup>';}
    html+=`<optgroup label="AI Parts Search">${aiKey()?`<option value="__ai:${esc(q)}">🤖 Look up "${esc(q)}" with AI…</option>`:'<option disabled>AI key not set up — click "AI helper key…" in the menu first</option>'}</optgroup>`;
    sel.innerHTML=html;
  },250);
});
$('ewAuto').onclick=runAuto;
$('ewRot').onclick=()=>rotateSel();
$('ewGen').onclick=generate;
$('ewClose').onclick=$('ewX').onclick=closeWizard;
$('ewProj').onclick=()=>{const panel=$('ewProjPanel');const show=panel.style.display==='none';panel.style.display=show?'block':'none';if(show){ewProjRender();setTimeout(()=>{const inp=$('ewProjName');if(inp)inp.focus();},50);}};
$('ewLib').onclick=()=>openLibrary();
$('ewPartsDb').onclick=()=>_int.openPartsLibrary();
$('ewGhost').onchange=()=>WF.ghostsShown($('ewGhost').checked);
const rotateSel=function rotateSel(){
  if(!lay||lay.error||!selIt)return WF.flash('Click a part in the layout first');
  if(selIt.kind==='wall')return WF.flash('Wall parts face out through their wall. Drag it along the wall, or onto another wall.');
  const b=selIt.b,cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
  selIt.rot=(selIt.rot+1)%4;
  const fw=selIt.rot%2?selIt.o.fd:selIt.o.fw,fd=selIt.rot%2?selIt.o.fw:selIt.o.fd;
  selIt.x0=Math.max(0,Math.min(lay.W-fw,snap(cx-fw/2)));selIt.y0=Math.max(0,Math.min(lay.D-fd,snap(cy-fd/2)));
  lay.manual=true;afterEdit();
};
const afterEdit=function afterEdit(){revalidate(lay);drawLayout();$('ewInfo').innerHTML=report(lay);};

const drawLayout=function drawLayout(){
  const cv=$('ewCanvas'),wrap=cv.parentElement,dpr=window.devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;
  if(!cw||!ch)return;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,ch);
  c.font='12px "Segoe UI",system-ui,sans-serif';
  if(!lay||lay.error){c.fillStyle='#777';c.textAlign='center';c.fillText(lay&&lay.error?lay.error:'Add parts, then press Auto arrange',cw/2,ch/2);view=null;return;}
  const L=lay,t=L.st.wall,W=L.W,D=L.D;
  // Clamped: when the preview panel is shorter than the padding this leaves room for (e.g. a cramped
  // window, or extra rows of style-specific fields pushing it tight), this went negative - and every radius
  // drawn below is some multiple of it, so a single negative scale was crashing roundRect/arc calls all over
  // this function instead of just drawing a squashed preview.
  const s=Math.max(0.01,Math.min((cw-80)/(W+2*t),(ch-70)/(D+2*t)));
  view={s,ox:(cw-W*s)/2,oy:(ch+D*s)/2};
  const X=x=>view.ox+x*s,Y=y=>view.oy-y*s;
  // A rounding radius computed from a small part's own dimensions can come out as a tiny negative number
  // (clamped against half its width/height); roundRect throws on that instead of just treating it as 0, which
  // was crashing this whole redraw uncaught - clamp it here so no caller elsewhere has to.
  const rr=(x0,y0,x1,y1,r)=>{c.beginPath();const rad=Math.max(0,r*s);if(c.roundRect)c.roundRect(X(x0),Y(y1),(x1-x0)*s,(y1-y0)*s,rad);else c.rect(X(x0),Y(y1),(x1-x0)*s,(y1-y0)*s);};
  rr(-t,-t,W+t,D+t,t+1);c.fillStyle='#98a3b0';c.fill();
  rr(0,0,W,D,1);c.fillStyle='#fff';c.fill();
  c.strokeStyle='#eef1f5';c.lineWidth=1;c.beginPath();
  for(let x=10;x<W;x+=10){c.moveTo(X(x),Y(0));c.lineTo(X(x),Y(D));}
  for(let y=10;y<D;y+=10){c.moveTo(X(0),Y(y));c.lineTo(X(W),Y(y));}
  c.stroke();
  c.fillStyle='#4a5260';c.textAlign='center';
  c.fillText('FRONT  ·  '+fx(W)+' mm',X(W/2),Y(-t)+16);c.fillText('BACK',X(W/2),Y(D+t)-6);
  c.save();c.translate(X(-t)-8,Y(D/2));c.rotate(-Math.PI/2);c.fillText('LEFT  ·  '+fx(D)+' mm',0,0);c.restore();
  c.save();c.translate(X(W+t)+8,Y(D/2));c.rotate(Math.PI/2);c.fillText('RIGHT',0,0);c.restore();
  const items=L.items;
  // lid screw posts
  for(const it of items)if(it.kind==='post'){c.fillStyle='#b8c0ca';c.fillRect(X(it.b.x0),Y(it.b.y1),(it.b.x1-it.b.x0)*s,(it.b.y1-it.b.y0)*s);c.beginPath();c.arc(X(it.b.x0+POST/2),Y(it.b.y0+POST/2),1.25*s,0,Math.PI*2);c.fillStyle='#fff';c.fill();}
  // antenna keep-outs
  for(const it of items)for(const k of it.keep||[]){
    c.save();c.beginPath();c.rect(X(Math.max(0,k.x0)),Y(Math.min(D,k.y1)),(Math.min(W,k.x1)-Math.max(0,k.x0))*s,(Math.min(D,k.y1)-Math.max(0,k.y0))*s);
    c.fillStyle='#ffd84a40';c.fill();c.setLineDash([4,3]);c.strokeStyle='#d9a400';c.stroke();c.restore();
  }
  const order=[...items.filter(i=>i.kind==='floor'),...items.filter(i=>i.kind==='wall')];
  for(const it of order){
    const o=it.o,p=o.p,b=it.b,colr=typeOf(p).color,sel=it===selIt;
    c.save();
    c.beginPath();c.rect(X(b.x0),Y(b.y1),(b.x1-b.x0)*s,(b.y1-b.y0)*s);
    c.fillStyle=colr+(it.kind==='wall'?'55':'30');c.fill();
    if(it.kind==='wall'&&it.z0>1.5)c.setLineDash([5,3]);
    c.lineWidth=it.bad?2.5:sel?2.5:1.3;c.strokeStyle=it.bad?'#d0201a':sel?'#1e5af0':colr;c.stroke();c.setLineDash([]);
    if(it.kind==='floor'){
      // board outline inside the clips / end stops
      const q=[[0,0],[o.w,0],[o.w,o.d],[0,o.d]].map(([x,y])=>floorXY(it,x,y));
      c.beginPath();
      if(p.shape==='round'){const m=floorXY(it,o.w/2,o.d/2);c.arc(X(m[0]),Y(m[1]),o.w/2*s,0,Math.PI*2);}
      else{c.moveTo(X(q[0][0]),Y(q[0][1]));for(const r of q.slice(1))c.lineTo(X(r[0]),Y(r[1]));c.closePath();}
      // the part's own photo (a straight-on picture cropped to the part) is drawn on it, turned the way the part is placed
      const pim=imgOf(p.photo||p.img,drawLayout);
      if(pim){
        const A=floorXY(it,0,o.d),B=floorXY(it,o.w,o.d),Cc=floorXY(it,0,0);// the picture's top-left, top-right and bottom-left corners
        c.save();c.clip();
        c.transform((X(B[0])-X(A[0]))/pim.naturalWidth,(Y(B[1])-Y(A[1]))/pim.naturalWidth,(X(Cc[0])-X(A[0]))/pim.naturalHeight,(Y(Cc[1])-Y(A[1]))/pim.naturalHeight,X(A[0]),Y(A[1]));
        c.drawImage(pim,0,0);c.restore();
      }else{c.fillStyle=colr+'40';c.fill();}
      c.strokeStyle=colr;c.lineWidth=1;c.stroke();
      for(const f of p.features||[]){
        if(f.t==='hole'||f.t==='button'||f.t==='led'||f.t==='mic'||f.t==='opening'){const m=floorXY(it,f.x,f.y);c.beginPath();c.arc(X(m[0]),Y(m[1]),Math.max(1,f.dia/2)*s,0,Math.PI*2);c.strokeStyle=f.t==='hole'?'#333':'#1e5af0';c.stroke();}
        if(f.t==='header'){const a=floorXY(it,f.x-f.fw/2,f.y-f.fd/2),e=floorXY(it,f.x+f.fw/2,f.y+f.fd/2);c.setLineDash([2,2]);c.strokeStyle='#555';c.strokeRect(X(Math.min(a[0],e[0])),Y(Math.max(a[1],e[1])),Math.abs(e[0]-a[0])*s,Math.abs(e[1]-a[1])*s);c.setLineDash([]);}
        if((f.t==='port'||f.t==='cutout')&&!isEdge(f)){// lid or floor opening: drawn where it is (dashed for the floor)
          const round=f.t==='cutout'?f.shape!=='rect':ROUND_KINDS.has(f.kind),cw=f.t==='cutout'?f.cw:round?Math.max(f.pw,f.ph):f.pw,ch=round?cw:f.t==='cutout'?f.ch:f.ph;
          const a=floorXY(it,f.x-cw/2,f.y-ch/2),e=floorXY(it,f.x+cw/2,f.y+ch/2),m=floorXY(it,f.x,f.y);
          c.strokeStyle='#c2185b';c.lineWidth=1.5;if(f.thru==='floor')c.setLineDash([3,2]);c.beginPath();
          if(round)c.arc(X(m[0]),Y(m[1]),cw/2*s,0,Math.PI*2);else c.rect(X(Math.min(a[0],e[0])),Y(Math.max(a[1],e[1])),Math.abs(e[0]-a[0])*s,Math.abs(e[1]-a[1])*s);
          c.stroke();c.setLineDash([]);c.lineWidth=1;
        }
        if((f.t==='port'||f.t==='switch'||f.t==='cutout')&&isEdge(f)){
          const sd=rotSide(f.side,it.rot),lp=f.side==='xmin'?[0,f.u]:f.side==='xmax'?[o.w,f.u]:f.side==='ymin'?[f.u,0]:[f.u,o.d],m=floorXY(it,lp[0],lp[1]);
          c.strokeStyle='#e0141e';c.lineWidth=Math.max(3,t*s*0.8);c.beginPath();
          const half=(f.t==='cutout'?f.cw:ROUND_KINDS.has(f.kind)?Math.max(f.pw,f.ph):f.pw)/2;
          if(sd==='xmin'||sd==='xmax'){const x=sd==='xmin'?-t/2:W+t/2;c.moveTo(X(x),Y(m[1]-half));c.lineTo(X(x),Y(m[1]+half));}
          else{const y=sd==='ymin'?-t/2:D+t/2;c.moveTo(X(m[0]-half),Y(y));c.lineTo(X(m[0]+half),Y(y));}
          c.stroke();c.lineWidth=1;
        }
      }
      for(const a of it.ant){c.fillStyle='#ffcc0080';c.fillRect(X(a.x0),Y(a.y1),(a.x1-a.x0)*s,(a.y1-a.y0)*s);}
    }else{
      // wall part: show where its grille / sound hole goes through the wall
      for(const f of p.features||[]){
        if(f.t!=='cone'&&f.t!=='mic'&&f.t!=='opening')continue;
        const half=f.t==='cone'?f.cw/2:Math.max(1.5,f.dia/2+0.5),u=wallU(it,f.x);
        c.strokeStyle=f.t==='cone'?'#1e5af0':f.t==='opening'?'#0a8a5a':'#7a4fb5';c.lineWidth=Math.max(3,t*s*0.8);c.beginPath();
        if(it.wall[0]==='y'){const y=it.wall==='ymin'?-t/2:D+t/2;c.moveTo(X(u-half),Y(y));c.lineTo(X(u+half),Y(y));}
        else{const x=it.wall==='xmin'?-t/2:W+t/2;c.moveTo(X(x),Y(u-half));c.lineTo(X(x),Y(u+half));}
        c.stroke();c.lineWidth=1;
      }
    }
    // label
    const bw=(b.x1-b.x0)*s,bh=(b.y1-b.y0)*s,vert=bh>bw*1.6&&bw<70;
    let label=p.name;c.font='11px "Segoe UI",system-ui,sans-serif';
    const room=(vert?bh:bw)-6;
    while(label.length>3&&c.measureText(label).width>room)label=label.slice(0,-2);
    if(label!==p.name)label=label.replace(/\s*\S?$/,'')+'…';
    if(room>18){
      c.fillStyle='#1d222b';c.textAlign='center';c.translate(X((b.x0+b.x1)/2),Y((b.y0+b.y1)/2));if(vert)c.rotate(-Math.PI/2);
      c.fillText(label,0,4);
      if(it.kind==='wall'&&it.z0>1.5){c.fillStyle='#555';c.fillText('↑ '+fx(it.z0)+' mm up',0,17);}
    }
    c.restore();
  }
  $('ewSelNote').textContent=selIt?selIt.o.p.name+(selIt.kind==='wall'?' · on the '+SIDE_NAME[selIt.wall].toLowerCase()+' wall, '+fx(selIt.z0)+' mm up':' · R or Rotate part turns it'):'Top view, front wall at the bottom. Drag a part to move it; drag a wall part onto another wall to swap walls.';
};
const toMM=e=>{const r=$('ewCanvas').getBoundingClientRect();return [(e.clientX-r.left-view.ox)/view.s,(view.oy-(e.clientY-r.top))/view.s];};
const hitItem=function hitItem(x,y){
  if(!lay||lay.error)return null;
  const list=[...lay.items.filter(i=>i.kind==='floor'),...lay.items.filter(i=>i.kind==='wall')].reverse();
  return list.find(i=>x>=i.b.x0-0.5&&x<=i.b.x1+0.5&&y>=i.b.y0-0.5&&y<=i.b.y1+0.5)||null;
};
const ewCv=$('ewCanvas');
ewCv.addEventListener('pointerdown',e=>{
  if(!view||e.button!==0)return;
  ewCv.focus();
  const [x,y]=toMM(e),it=hitItem(x,y);selIt=it;
  if(it){drag={it,x,y,x0:it.x0,y0:it.y0,u0:it.u0,moved:false};ewCv.setPointerCapture(e.pointerId);}
  drawLayout();
});
ewCv.addEventListener('pointermove',e=>{
  if(!view)return;
  const [x,y]=toMM(e);
  if(!drag){ewCv.style.cursor=hitItem(x,y)?'move':'default';return;}
  const it=drag.it,L=lay,dx=x-drag.x,dy=y-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>0.3)drag.moved=true;
  if(it.kind==='floor'){
    const fw=it.b.x1-it.b.x0,fd=it.b.y1-it.b.y0;
    it.x0=Math.max(0,Math.min(L.W-fw,snap(drag.x0+dx)));it.y0=Math.max(0,Math.min(L.D-fd,snap(drag.y0+dy)));
    // ports snap onto their wall when close
    for(const sd of it.o.portSides.map(q=>rotSide(q,it.rot))){
      if(sd==='xmin'&&it.x0<3)it.x0=PORT_GAP;if(sd==='xmax'&&L.W-(it.x0+fw)<3)it.x0=L.W-PORT_GAP-fw;
      if(sd==='ymin'&&it.y0<3)it.y0=PORT_GAP;if(sd==='ymax'&&L.D-(it.y0+fd)<3)it.y0=L.D-PORT_GAP-fd;
    }
  }else{
    // nearest wall to the pointer (a wall part can be dragged onto another wall)
    const dW={xmin:x,xmax:L.W-x,ymin:y,ymax:L.D-y};
    let wl=it.wall;for(const k in dW)if(dW[k]<dW[wl]-4&&dW[k]<12&&(k[0]==='y'?L.W:L.D)>=it.o.w+1)wl=k;
    it.wall=wl;
    const len=wl[0]==='y'?L.W:L.D,along=wl[0]==='y'?x:y;
    it.u0=Math.max(0.5,Math.min(len-0.5-it.o.w,snap(along-it.o.w/2)));
  }
  setBounds(it,L);if(it.kind==='wall')settleWall(it,L);
  drawLayout();
});
ewCv.addEventListener('pointerup',()=>{if(drag&&drag.moved){lay.manual=true;const dp=drag.it&&drag.it.o&&drag.it.o.p;if(dp&&dp.type==='speaker'&&drag.it.kind!=='wall')WF.flash('Speakers and buzzers go on a wall. Drag it onto a wall, or click Auto arrange.',7000);afterEdit();}drag=null;});
ewCv.addEventListener('keydown',e=>{if(e.key==='r'||e.key==='R'){e.preventDefault();rotateSel();}});
new ResizeObserver(()=>{if(ewBack.style.display==='grid')drawLayout();}).observe($('ewCanvas').parentElement);
