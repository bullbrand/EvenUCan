// ---------------------------------------------------------------- wizard window
let lay=null,selIt=null,layTimer=0,view=null,drag=null;
const ewBack=$('ewBack'),plBack=$('plBack');
const busy=msg=>{$('ewBusy').textContent=msg;$('ewGen').disabled=!!msg;};
function openWizard(){
  plBack.style.display='none';ewBack.style.display='grid';renderSide();
  if(!lay)runAuto();else{drawLayout();$('ewInfo').innerHTML=lay.error?'<span class="bad">'+esc(lay.error)+'</span>':report(lay);}
  $('ewCanvas').focus();drawGuide();
}
function closeWizard(){ewBack.style.display='none';drawGuide();}
function runAuto(){
  busy('Arranging…');$('ewInfo').innerHTML='<span class="ewNote">Working out the smallest box…</span>';
  clearTimeout(layTimer);
  layTimer=setTimeout(()=>{
    try{lay=autoLayout();}catch(e){console.error(e);lay={error:'Layout failed: '+e.message};}
    selIt=null;busy('');drawLayout();
    $('ewInfo').innerHTML=lay.error?'<span class="bad">'+esc(lay.error)+'</span>':report(lay);
  },30);
}
function partOptions(sel,filter){
  return allParts().filter(filter||(()=>true)).map(p=>`<option value="${esc(p.id)}"${p.id===sel?' selected':''}>${esc(p.name)}</option>`).join('');
}
function smartHints(){
  if(!wiz.items.length)return'';
  const pts=wiz.items.map(it=>partById(it.pid)).filter(Boolean);
  const tx=p=>((p.title||'')+' '+(p.family||'')+' '+(p.tags||[]).join(' ')).toLowerCase();
  const hasSpeaker=pts.some(p=>/speaker|buzzer|piezo/.test(tx(p)));
  const hasMic=pts.some(p=>/microphone|mic/.test(tx(p)));
  const hasDisplay=pts.some(p=>partKind(p)==='display');
  const hasStepper=pts.some(p=>/stepper/.test(tx(p)));
  const hasDriver=pts.some(p=>/a4988|drv8825|tb67|l298|l293|uln2003|motor.?driver|stepper.?driver/.test(tx(p)));
  const h=[];
  if(hasSpeaker)h.push('<div class="ewHint">🔊 <b>Speaker / buzzer</b> — plan a ventilation grill on the facing wall so sound can get out</div>');
  if(hasMic)h.push('<div class="ewHint">🎙 <b>Microphone</b> — plan a small hole, ideally centred on the facing wall</div>');
  if(hasDisplay)h.push('<div class="ewHint">📺 <b>Display</b> — plan a viewport cutout on the facing wall or lid</div>');
  if(hasStepper&&!hasDriver)h.push('<div class="ewHint">⚙️ <b>Stepper motor</b> — also needs a motor driver (A4988, DRV8825…) — consider adding it to your parts list</div>');
  return h.length?'<div class="ewHints"><b>💡 Things to plan:</b>'+h.join('')+'</div>':'';
}
function renderSide(){
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
${rows||'<div class="ewNote">No parts yet.</div>'}
<h4>2. Power</h4>
<div class="ewRow" style="flex-wrap:wrap"><label><input type="radio" name="ewPow" value="usb"${wiz.power!=='battery'&&wiz.power!=='mains'?' checked':''}> USB cable</label><label><input type="radio" name="ewPow" value="mains"${wiz.power==='mains'?' checked':''}> Mains adapter (USB plug)</label><label><input type="radio" name="ewPow" value="battery"${wiz.power==='battery'?' checked':''}> Battery inside</label></div>
${wiz.power==='battery'?`<div class="ewRow"><label style="flex:1">Battery <select data-w="battery" style="flex:1">${partOptions(wiz.battery,p=>p.type==='battery')}</select></label></div>
<div class="ewRow"><label style="flex:1">Charger <select data-w="charger" style="flex:1"><option value="">None</option>${partOptions(wiz.charger,p=>p.type==='charger')}</select></label></div>
<div class="ewRow"><label><input type="checkbox" data-w="sw"${wiz.sw?' checked':''}> On/off switch</label><select data-w="swPart" style="flex:1">${partOptions(wiz.swPart,p=>p.type==='switch')}</select></div>
<div class="ewNote">The charger is kept near the battery; the battery is kept away from the speaker magnet and the antenna.</div>
<div class="ewNote" style="margin-top:5px;padding:7px 10px;background:#fff8e1;border-left:3px solid #d06a00;border-radius:3px;line-height:1.5">🔋 <b>Battery reminder:</b> it will need periodic recharging. EvenUCan will include code to send your phone an alert when the battery reaches 20% — make sure your ntfy topic is set up in the ESPHome tab so the alert gets through.</div>`:''}
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
}
function wizChanged(rerender){saveWiz();if(rerender)renderSide();runAuto();}
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
  if(el.id==='ewAdd'){const sel=$('ewAddSel');const id=sel&&sel.value;if(id){const isDb=id.startsWith('__db:');const isAi=id.startsWith('__ai:');if(isDb){const raw=JSON.parse(decodeURIComponent(id.slice(5)));const part=lookupToPart(_dbToLookupData(raw,raw.title||''),raw.title||'');part.source=raw._dbSrc||'';part.notes='Pin positions and board size from '+part.source+'. Component height is estimated at '+part.h+' mm.';custom.push(part);saveLib();WF.flash('Added "'+part.name+'" to your library',4000);wiz.items.push({pid:part.id,qty:1,mount:'auto',wall:'auto'});wizChanged(true);}else if(isAi){const q=id.slice(5);(async()=>{if(!aiKey()){await askKey();if(!aiKey())return;}WF.flash('Asking AI for "'+q+'"…',8000);try{const {data:d}=await callAI(LOOKUP_PROMPT+'\n\nThe part: "'+q+'"');if(!d||typeof d!=='object')throw new Error('no data');if(d.unknown)return WF.flash('The AI doesn\'t know this part. Try a more specific name.',6000);if(!(parseFloat(d.width_mm)>0))throw new Error('no sizes');const part=lookupToPart(d,q);custom.push(part);if(!saveLib()){custom.pop();return WF.flash('Couldn\'t save the part.',4000);}WF.flash('Added "'+part.name+'" to your library (marked ⚠ Approximate)',5000);wiz.items.push({pid:part.id,qty:1,mount:'auto',wall:'auto'});wizChanged(true);}catch(e){WF.flash('AI parts lookup failed: '+(e.message||e),6000);}})();}else{wiz.items.push({pid:id,qty:1,mount:'auto',wall:'auto'});wizChanged(true);}}}
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
$('ewRot').onclick=rotateSel;
$('ewGen').onclick=generate;
$('ewClose').onclick=$('ewX').onclick=closeWizard;
$('ewProj').onclick=()=>{const panel=$('ewProjPanel');const show=panel.style.display==='none';panel.style.display=show?'block':'none';if(show){ewProjRender();setTimeout(()=>{const inp=$('ewProjName');if(inp)inp.focus();},50);}};
$('ewLib').onclick=()=>openLibrary();
$('ewPartsDb').onclick=()=>openPartsLibrary();
$('ewGhost').onchange=()=>WF.ghostsShown($('ewGhost').checked);
function rotateSel(){
  if(!lay||lay.error||!selIt)return WF.flash('Click a part in the layout first');
  if(selIt.kind==='wall')return WF.flash('Wall parts face out through their wall. Drag it along the wall, or onto another wall.');
  const b=selIt.b,cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;
  selIt.rot=(selIt.rot+1)%4;
  const fw=selIt.rot%2?selIt.o.fd:selIt.o.fw,fd=selIt.rot%2?selIt.o.fw:selIt.o.fd;
  selIt.x0=Math.max(0,Math.min(lay.W-fw,snap(cx-fw/2)));selIt.y0=Math.max(0,Math.min(lay.D-fd,snap(cy-fd/2)));
  lay.manual=true;afterEdit();
}
function afterEdit(){revalidate(lay);drawLayout();$('ewInfo').innerHTML=report(lay);}

function drawLayout(){
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
      c.fillStyle=colr+'40';c.fill();c.strokeStyle=colr;c.lineWidth=1;c.stroke();
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
}
const toMM=e=>{const r=$('ewCanvas').getBoundingClientRect();return [(e.clientX-r.left-view.ox)/view.s,(view.oy-(e.clientY-r.top))/view.s];};
function hitItem(x,y){
  if(!lay||lay.error)return null;
  const list=[...lay.items.filter(i=>i.kind==='floor'),...lay.items.filter(i=>i.kind==='wall')].reverse();
  return list.find(i=>x>=i.b.x0-0.5&&x<=i.b.x1+0.5&&y>=i.b.y0-0.5&&y<=i.b.y1+0.5)||null;
}
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
ewCv.addEventListener('pointerup',()=>{if(drag&&drag.moved){lay.manual=true;afterEdit();}drag=null;});
ewCv.addEventListener('keydown',e=>{if(e.key==='r'||e.key==='R'){e.preventDefault();rotateSel();}});
new ResizeObserver(()=>{if(ewBack.style.display==='grid')drawLayout();}).observe($('ewCanvas').parentElement);

// ---------------------------------------------------------------- parts library window
let ed=null,edDirty=false,edSel=-1,edPin=-1,edMode='select',photo=null,rawImg=null,clicks=[],sideRef='w',plBig=false;
// Where positions are measured from, for the numbers shown and typed in the part editor only: parts are always
// stored from the bottom-left corner (x to the right, y up), so changing this never changes a part.
const ORIGINS={tl:'Top-left corner',bl:'Bottom-left corner',c:'Centre'};
const orig=()=>ORIGINS[WF.store.get('partOrigin')]?WF.store.get('partOrigin'):'tl';
const isPos=k=>k==='x'||k==='y'||k==='u';
// k: 'x', 'y' or 'u' (along an edge: up the left/right edges, across the top/bottom ones)
function toShow(k,v,side){
  const o=orig(),vert=side==='xmin'||side==='xmax';
  if(k==='x'||(k==='u'&&!vert))return o==='c'?v-ed.w/2:v;
  if(k==='y'||(k==='u'&&vert))return o==='tl'?ed.d-v:o==='c'?v-ed.d/2:v;
  return v;
}
function fromShow(k,v,side){
  const o=orig(),vert=side==='xmin'||side==='xmax';
  if(k==='x'||(k==='u'&&!vert))return o==='c'?v+ed.w/2:v;
  if(k==='y'||(k==='u'&&vert))return o==='tl'?ed.d-v:o==='c'?v+ed.d/2:v;
  return v;
}
function posLabel(k,side){
  const o=orig(),vert=side==='xmin'||side==='xmax',down=o==='tl'?'↓':o==='c'?'↕':'↑',across=o==='c'?'↔':'→';
  return k==='x'?'X '+across:k==='y'?'Y '+down:k==='u'?FLABEL.u+' '+(vert?down:across):FLABEL[k];
}
const posTip=k=>k==='x'?(orig()==='c'?'mm right of the centre (minus = left)':'mm from the left edge'):(orig()==='tl'?'mm down from the top edge':orig()==='c'?'mm above the centre (minus = below)':'mm up from the bottom edge');
// Moved things land on 0.5 mm steps, counted from the chosen corner (fine: 0.1 mm steps).
const snapTo=(k,v,side,fine)=>{const s=toShow(k,v,side);return +fromShow(k,fine?Math.round(s*10)/10:snap(s),side).toFixed(2);};
// Bigger picture: the part picture fills the Parts Library window, so a small board's pins and their names can be read.
function setBig(on){
  plBig=on;plBack.classList.toggle('plBig',on);
  const b=$('plBigBtn');if(b)b.textContent=on?'✕ Smaller picture':'⤢ Bigger picture';
  drawEd();
}
const imgCache=new Map();
function imgOf(src,cb){
  if(!src)return null;let im=imgCache.get(src);
  if(!im){im=new Image();im.onload=()=>cb&&cb();im.src=src;imgCache.set(src,im);}
  return im.complete&&im.naturalWidth?im:null;
}
function openLibrary(id){
  ewBack.style.display='none';plBack.style.display='grid';
  if(id!==undefined||!ed)selectPart(id||allParts()[0].id,true);else{renderList();renderEditor();}
}
function closeLibrary(){
  if(edDirty&&!confirm('Close without saving the changes to "'+ed.name+'"?'))return;
  edDirty=false;plBack.style.display='none';setBig(false);plSelected.clear();
}
function selectPart(id,force){
  if(!force&&edDirty&&!confirm('Discard the changes to "'+ed.name+'"?'))return;
  const p=partById(id);if(!p)return;
  ed=tidyPart(clone(p));if(!ed.pins||!ed.pins.length)ed.pins=clone(pinsOf(p));edDirty=false;edSel=-1;edPin=-1;edMode='select';clicks=[];rawImg=null;clearRef();
  renderList();renderEditor();
}
const thumbCache=new Map();// id → dataURL, cleared when a part is saved/deleted
function thumbInvalidate(id){thumbCache.delete(id);}
function thumb(cv,p){
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;c.clearRect(0,0,W,H);
  const s=Math.min((W-6)/p.w,(H-6)/p.d),ox=(W-p.w*s)/2,oy=(H+p.d*s)/2;
  const im=imgOf(p.photo||p.img,()=>{const live=document.querySelector('.plItem[data-id="'+p.id+'"] canvas')||cv;thumb(live,p);thumbCache.set(p.id,live.toDataURL());});
  if(im)c.drawImage(im,ox,oy-p.d*s,p.w*s,p.d*s);
  c.strokeStyle=typeOf(p).color;c.lineWidth=1.5;c.fillStyle=im?'transparent':typeOf(p).color+'40';c.beginPath();
  if(p.shape==='round')c.ellipse(ox+p.w*s/2,oy-p.d*s/2,p.w*s/2,p.d*s/2,0,0,Math.PI*2);else c.rect(ox,oy-p.d*s,p.w*s,p.d*s);
  c.fill();c.stroke();
  thumbCache.set(p.id,cv.toDataURL());
}
// IntersectionObserver: only draw thumbnails that scroll into view; uses cached dataURLs on revisit.
let _thumbObs=null;
function getThumbObs(){
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
}
let _plPartsMap=new Map();// built once per renderList, reused by the observer
let _rlPending=false;
let plSelected=new Set();
function updateSelBar(){const bar=$('plSelBar'),n=plSelected.size;if(!bar)return;bar.style.display=n?'flex':'none';const sc=$('plSelCount');if(sc)sc.textContent=n+' part'+(n===1?'':'s')+' selected';}
function renderList(){
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
    const parts=all.filter(p=>plKind==='all'||kindOf(p)===plKind)
      .sort((a,b)=>rank(a)-rank(b)||(plSort==='added'?idx.get(a.id)-idx.get(b.id):byName(a,b)));
    const kinds=PL_ORDER.filter(k=>counts[k]);
    const bar=`<div class="plBar"><select id="plKindSel" title="Show one kind of part, or all of them"><option value="all"${plKind==='all'?' selected':''}>All kinds (${all.length})</option>${kinds.map(k=>`<option value="${k}"${plKind===k?' selected':''}>${esc(TYPES[k].name)} (${counts[k]})</option>`).join('')}</select><select id="plSortSel" title="Order inside each kind"><option value="az"${plSort==='az'?' selected':''}>A → Z</option><option value="added"${plSort==='added'?' selected':''}>Order added</option></select></div>`;
    let lastKind=null;
    L.innerHTML=bar+parts.map(p=>{
      const head=plKind==='all'&&kindOf(p)!==lastKind?`<div class="plGroup">${esc(TYPES[kindOf(p)].name)} · ${counts[kindOf(p)]}</div>`:'';
      lastKind=kindOf(p);
      return head+plItemHtml(p);
    }).join('');
    L.querySelectorAll('.plItem canvas').forEach(cv=>obs.observe(cv));
    updateSelBar();
  });
}
let plKind='all',plSort='az';
try{plKind=localStorage.getItem('ev.plKind')||'all';plSort=localStorage.getItem('ev.plSort')||'az';}catch(e){/* private mode: keep the defaults */}
function plItemHtml(p){
  const cached=thumbCache.get(p.id);
  const thumb_el=cached?`<img width="64" height="44" src="${cached}" class="plThumb">`:`<canvas width="64" height="44"></canvas>`;
  const canDel=!p.builtin&&!builtinById(p.id);
  return `<div class="plItem${ed&&ed.id===p.id?' on':''}" data-id="${esc(p.id)}">${thumb_el}<div class="t"><b>${esc(p.name)}</b><small>${esc(typeOf(p).name)}${p.type==='light'&&LED_COLOURS[p.colour]?' · '+LED_COLOURS[p.colour]:''} · ${fx(p.w)} × ${fx(p.d)} mm${p.builtin?' · built-in':builtinById(p.id)?' · edited':''}${accOf(p)==='unknown'?'':' · <span title="Sizes: '+esc(ACC[accOf(p)].slice(2))+'">'+ACC[accOf(p)].split(' ')[0]+'</span>'}</small></div>${canDel?`<input type="checkbox" class="plCheck" data-id="${esc(p.id)}" title="Tick to select for deletion"${plSelected.has(p.id)?' checked':''}>`:''}</div>`;
}
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
function updateBgBar(){
  const bar=$('plBgBar');if(!bar)return;
  if(!bgPhotoState){bar.style.display='none';return;}
  const {found,done,total,running}=bgPhotoState;
  bar.style.display='flex';
  $('plBgMsg').textContent=(running?'Finding photos: ':'Done — ')+(done||0)+' of '+total+(found?' · '+found+' found':'');
  $('plBgStop').style.display=running?'':'none';
}
async function fetchPhotoUrl(name){
  const ask=`Search the web for a top-down photo of this electronic component: "${name}". Return JSON only — no other text: {"image":"<direct URL to a .jpg .jpeg .png or .webp image showing the component from straight above, component side visible>"} or {"image":null} if no suitable photo was found.`;
  const r=await gemini([{text:ask}],[{google_search:{}},{url_context:{}}]);
  return r&&r.data&&typeof r.data.image==='string'&&/^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(r.data.image)?r.data.image:null;
}
async function fetchAndResize(url){
  return new Promise(res=>{
    const img=new Image();img.crossOrigin='anonymous';
    const done=v=>res(v);
    const t=setTimeout(()=>done(null),12000);
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
}
async function bgFindPhotos(){
  if(bgPhotoState&&bgPhotoState.running)return;
  if(!aiKey('gemini')){WF.flash('Set up a Gemini key first (the AI → Set up Google Gemini key… button in any part).',6000);return;}
  const todo=custom.filter(p=>!p.photo||!p.photo.startsWith('data:'));
  if(!todo.length){WF.flash('All custom parts already have photos.');return;}
  bgPhotoState={running:true,found:0,done:0,total:todo.length,stop:false};
  updateBgBar();
  for(const part of todo){
    if(bgPhotoState.stop)break;
    try{
      const url=await fetchPhotoUrl(part.name);
      if(url){
        const dataUrl=await fetchAndResize(url);
        if(dataUrl&&custom.some(p=>p.id===part.id)){
          if(photoSave(part.id,dataUrl)){
            part.photo=dataUrl;
            thumbInvalidate(part.id);
            bgPhotoState.found++;
          }
        }
      }
    }catch(e){/* skip */}
    bgPhotoState.done++;
    updateBgBar();
  }
  bgPhotoState.running=false;
  if(bgPhotoState.found){renderList();}
  updateBgBar();
  if(bgPhotoState.found)WF.flash('Found '+bgPhotoState.found+' photo'+(bgPhotoState.found===1?'':'s')+' — saved.');
}
$('plFzPhoto').onclick=bgFindPhotos;
$('plBgStop').onclick=()=>{if(bgPhotoState)bgPhotoState.stop=true;};
function renderEditor(){
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
  aiProv()==='nvidia'?'<div class="ewNote">NVIDIA is free but can\'t search the web: <b>Look up online</b> uses what it already knows, so check every size. It reads pictures of drawings (not PDFs) and works in the desktop app only.</div>':
  aiProv()==='ollama'?'<div class="ewNote">Ollama is local: <b>Look up online</b> uses what it already knows, so check every size. It reads pictures of drawings (not PDFs).</div>':
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
<div class="ewRow"><button id="plTop">${p.photo?'Replace top photo…':'Top photo…'}</button>${p.photo?'<button id="plTurn" title="Turn the photo upside down, if it came out the wrong way round">Turn photo 180°</button><button id="plNoPhoto">Remove photo</button>':''}</div>
<div class="ewRow"><button id="plSide">Side photo for heights…</button><label>shows the <select id="plSideRef"><option value="w"${sideRef==='w'?' selected':''}>long side</option><option value="d"${sideRef==='d'?' selected':''}>short side</option></select></label></div>
<h4>Product image</h4>
<div class="ewNote" style="margin-bottom:6px">A catalog or datasheet photo — stored with the part, shown in the list when there is no calibrated top photo.</div>
<div class="ewRow">${p.img?`<button id="plImgReplace">Replace image…</button><button id="plNoImg">Remove image</button>`:`<button id="plImgAdd">Add product image…</button>`}</div>
${p.img?`<div style="margin:4px 0 2px"><img src="${esc(p.img)}" style="max-height:88px;max-width:200px;border:1px solid var(--line);border-radius:4px;object-fit:contain;background:#f5f5f5"></div>`:''}
<h4>Features <span class="ewNote">(${p.features.length})</span></h4>
<label class="f" title="Where the X and Y numbers of features and pins are measured from (the red 0,0 mark on the picture). It only changes the numbers shown, not the part."><span>Measure from</span><select id="plOrigin">${opt(ORIGINS,orig())}</select></label>
<div id="plFeats"></div>
<div class="ewRow" style="margin-top:10px"><button id="plTypical" title="Add the features this type of part usually has">Add typical features</button></div>
<h4>Pins <span class="ewNote">(${(p.pins||[]).length}) for the wiring diagram</span></h4>
${(p.pins||[]).length?`<table class="plPins"><tr class="hd"><td>Name</td><td title="${esc(posTip('x'))}">${posLabel('x')}</td><td title="${esc(posTip('y'))}">${posLabel('y')}</td><td>Role</td><td></td></tr>${p.pins.map((q,i)=>`<tr data-prow="${i}"${i===edPin?' class="on"':''}><td style="width:30%"><input data-pn="${i}" value="${esc(q.n)}"></td><td style="width:58px"><input type="number" step="0.1" data-px="${i}" value="${q.x===undefined?'':fx(toShow('x',q.x))}" placeholder="–"></td><td style="width:58px"><input type="number" step="0.1" data-py="${i}" value="${q.y===undefined?'':fx(toShow('y',q.y))}" placeholder="–"></td><td><select data-pr="${i}">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}"${q.r===k?' selected':''}>${esc(v)}</option>`).join('')}</select></td><td style="width:22px"><button class="x" data-pdel="${i}" title="Delete this pin">✕</button></td></tr>`).join('')}</table>`:'<div class="ewNote">No pins yet. Click Import pins…, or add them here.</div>'}
<div class="ewRow"><button id="plPinAdd">+ Pin</button><button id="plFz" title="Take this part's pins (names and positions) and picture from a parts library on this computer, or from a part file (.fzpz)">Import pins…</button></div>
<div class="ewRow plActions"><button id="plSave" class="primary">Save part</button><button id="plDup">Duplicate</button>
${isB?(overridden?'<button id="plReset">Reset to original</button>':''):'<button id="plDel">Delete</button>'}<button id="plUse" title="Add this part to the Enclosure Wizard">Use in enclosure</button></div>
</div>
<div class="plCanvasCol"><div class="plPal" id="plPal"><button data-mode="select" class="${edMode==='select'?'on':''}">Select / move</button>${Object.entries(FEAT).map(([k,v])=>`<button data-mode="add:${k}" class="${edMode==='add:'+k?'on':''}" title="${esc(v.tip)}">+ ${esc(v.name)}</button>`).join('')}</div>
<div class="plHint" id="plHint"></div>${picsHtml()}
<div class="ewCanvasWrap"><canvas id="plCanvas" tabindex="0"></canvas><div id="plXY"></div><button id="plBigBtn" title="Show the picture across the whole window, to read small pins (or double-click the picture). Esc goes back.">${plBig?'✕ Smaller picture':'⤢ Bigger picture'}</button>${refDraw&&edMode!=='corners'&&edMode!=='side'?`<div id="plRef" class="${refDraw.big?'big':''}" title="Click to make bigger or smaller"><button id="plRefX" title="Hide this reference picture">✕</button>${refDraw.url?`<img src="${refDraw.url}" alt="">`:'<div class="pdf">PDF</div>'}<span>${esc(refDraw.name)}</span></div>`:''}</div></div>`;
  renderFeats();setHint();drawEd();
}
function renderFeats(){
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
}
const HINTS={
  select:()=>ed.features.length||(ed.pins||[]).some(q=>q.x!==undefined)?'Click a feature or a gold pin to select it, drag to move it (it snaps to 0.5 mm; hold Alt for 0.1 mm). Arrow keys nudge it 0.1 mm (Shift: 1 mm). Pick a "+" button to add a feature.':'Pick a feature button above, then click or drag on the part to place it.',
  corners:()=>ed.shape==='round'?`Click 3 points around the edge of the round board (${clicks.length}/3).`:`Click the 4 corners of the board in order: top-left, top-right, bottom-right, bottom-left (${clicks.length}/4). Take the photo from straight above if you can.`,
  side:()=>['Click the LEFT end of the board, at the bottom of the board','Click the RIGHT end of the board, at the bottom of the board','Click the TOP surface of the board','Click the TOP of the tallest part','Click the bottom tip of the pins underneath'][clicks.length]||''
};
function setHint(){
  const h=$('plHint');if(!h)return;
  if(edMode.startsWith('add:')){const k=edMode.slice(4),f=FEAT[k];
    h.innerHTML=esc(EDGE_FEATS.includes(k)?`Click on the edge where the ${f.name.toLowerCase()} is.`:RECT_FEATS.includes(k)?`Drag a box over the ${f.name.toLowerCase()}.`:`Click the centre of the ${f.name.toLowerCase()}.`)+' <span class="ewNote">'+esc(f.tip)+'</span>';return;}
  if(edMode==='select'&&aiBusy){h.textContent=aiBusy;return;}
  if(edMode==='select'&&aiNote){h.innerHTML=aiNote+'<button id="plAiOk">OK</button>';return;}
  h.innerHTML=esc(HINTS[edMode]())+(edMode==='side'&&clicks.length===4?'<button id="plNoPins">No pins underneath</button>':'')+(edMode!=='select'?'<button id="plCancelPhoto">Cancel</button>'+(clicks.length?'<button id="plUndoClick">Undo click</button>':''):'');
}
function markDirty(){edDirty=true;}
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
  if(id==='plTop'){pickPhoto('top');return;}
  if(id==='plSide'){pickPhoto('side');return;}
  if(id==='plNoPhoto'){delete ed.photo;photoDel(ed.id);markDirty();renderEditor();return;}
  if(id==='plTurn'){turnPhoto();return;}
  if(id==='plImgAdd'||id==='plImgReplace'){$('plImgIn').click();return;}
  if(id==='plNoImg'){delete ed.img;markDirty();renderEditor();renderList();return;}
  if(id==='plTurn90'){turnPart(ed).then(()=>{markDirty();renderEditor();WF.flash('Part turned a quarter turn: its sizes, picture, features and pins all moved together. Click again to keep turning.',6000);});return;}
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
  if(el.dataset.pic!==undefined){usePic(+el.dataset.pic);return;}
  if(el.dataset.picsX){aiPics=null;showPics();return;}
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
  if(id==='plDel'){if(!confirm('Delete "'+ed.name+'" from your library?'))return;const _delId=ed.id;custom=custom.filter(c=>c.id!==_delId);photoDel(_delId);saveLib();thumbInvalidate(_delId);edDirty=false;selectPart(allParts()[0].id,true);return;}
  if(id==='plReset'){if(!confirm('Put "'+ed.name+'" back to the original built-in part?'))return;custom=custom.filter(c=>c.id!==ed.id);saveLib();edDirty=false;selectPart(ed.id,true);return;}
  if(id==='plUse'){if(edDirty&&!savePart())return;wiz.items.push({pid:ed.id,qty:1,mount:'auto',wall:'auto'});saveWiz();lay=null;WF.flash(ed.name+' added to the Enclosure Wizard');openWizard();}
});
function savePart(){
  const p=tidyPart(ed);
  if(!p.name.trim())return WF.flash('Give the part a name first'),false;
  if(p.shape==='round')p.d=p.w;
  const c=clone(p);delete c.builtin;
  const i=custom.findIndex(x=>x.id===c.id);if(i>=0)custom[i]=c;else custom.push(c);
  if(!saveLib()){if(i<0)custom.pop();return false;}
  thumbInvalidate(c.id);
  edDirty=false;lay=null;renderList();renderEditor();WF.flash('Saved "'+p.name+'"');return true;
}
$('plNew').onclick=()=>{
  if(edDirty&&!confirm('Discard the changes to "'+ed.name+'"?'))return;
  ed=tidyPart({id:newPartId(),name:'New part',type:'board',shape:'rect',w:30,d:20,pcb:1.6,h:3,below:0,mount:'floor',features:[]});clearRef();
  edDirty=true;edSel=-1;edMode='select';clicks=[];renderList();renderEditor();
  WF.flash('Type the size, or load a top photo and click its corners',4000);
};
$('plX').onclick=closeLibrary;
// A small dialog with named buttons; resolves to the index of the button clicked, or -1 (Esc / outside).
function choose(message,buttons){
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
}
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
$('plFzBulk').onclick=()=>{$('fzImLog').innerHTML='';$('fzImBack').style.display='grid';};// opens in-app drop dialog
$('plBrowse').onclick=browseParts;
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

