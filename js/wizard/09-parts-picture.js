// EvenUCan Enclosure Wizard - 09-parts-picture.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- the part picture: features drawn to scale on the photo (or on a plain outline)
let pv=null,pdrag=null;
const drawEd=function drawEd(){
  const cv=$('plCanvas');if(!cv)return;
  const wrap=cv.parentElement,dpr=window.devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;
  if(!cw||!ch||cw<=0||ch<=0)return;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,ch);
  c.font='12px "Segoe UI",system-ui,sans-serif';
  if((edMode==='corners'||edMode==='side')&&rawImg){
    const s=Math.min((cw-20)/rawImg.naturalWidth,(ch-20)/rawImg.naturalHeight);
    pv={raw:true,s,ox:(cw-rawImg.naturalWidth*s)/2,oy:(ch-rawImg.naturalHeight*s)/2};
    c.drawImage(rawImg,pv.ox,pv.oy,rawImg.naturalWidth*s,rawImg.naturalHeight*s);
    const P=clicks.map(([x,y])=>[pv.ox+x*s,pv.oy+y*s]);
    c.lineWidth=2;c.strokeStyle='#ff2d55';c.fillStyle='#ff2d55';
    if(edMode==='corners'&&ed.shape!=='round'&&P.length>1){c.beginPath();c.moveTo(...P[0]);for(const q of P.slice(1))c.lineTo(...q);if(P.length===4)c.closePath();c.stroke();}
    if(edMode==='side'&&P.length>=2){c.beginPath();c.moveTo(...P[0]);c.lineTo(...P[1]);c.stroke();}
    P.forEach((q,i)=>{c.beginPath();c.arc(q[0],q[1],Math.max(0,5),0,Math.PI*2);c.fill();c.fillStyle='#fff';c.fillText(String(i+1),q[0]+8,q[1]-6);c.fillStyle='#ff2d55';});
    return;
  }
  const p=ed,s=Math.min((cw-70)/p.w,(ch-60)/p.d);
  pv={s,ox:(cw-p.w*s)/2,oy:(ch+p.d*s)/2};
  const X=x=>pv.ox+x*s,Y=y=>pv.oy-y*s;
  const im=imgOf(p.photo,drawEd);
  c.save();c.beginPath();
  if(p.shape==='round')c.ellipse(X(p.w/2),Y(p.d/2),p.w*s/2,p.d*s/2,0,0,Math.PI*2);else c.rect(X(0),Y(p.d),p.w*s,p.d*s);
  if(im){c.clip();c.drawImage(im,X(0),Y(p.d),p.w*s,p.d*s);c.restore();c.save();c.beginPath();if(p.shape==='round')c.ellipse(X(p.w/2),Y(p.d/2),p.w*s/2,p.d*s/2,0,0,Math.PI*2);else c.rect(X(0),Y(p.d),p.w*s,p.d*s);}
  else{c.fillStyle=typeOf(p).color+'30';c.fill();}
  c.strokeStyle=typeOf(p).color;c.lineWidth=2;c.stroke();c.restore();
  c.fillStyle='#555';c.textAlign='center';
  c.fillText(fx(p.w)+' mm',X(p.w/2),Y(0)+18);
  c.save();c.translate(X(0)-10,Y(p.d/2));c.rotate(-Math.PI/2);c.fillText(fx(p.d)+' mm',0,0);c.restore();
  c.fillText('top edge',X(p.w/2),Y(p.d)-8);
  ed.features.forEach((f,i)=>{
    const sel=i===edSel,col={port:'#e0141e',switch:'#e0141e',antenna:'#d99a00',wire:'#7a4f2a',mic:'#7a4fb5',cone:'#1e5af0',opening:'#0a8a5a',hole:'#222',button:'#0a7a6a',led:'#e04a00',header:'#555',heat:'#d0201a',window:'#1e5af0',cutout:'#c2185b'}[f.t];
    c.save();c.strokeStyle=col;c.fillStyle=col+'33';c.lineWidth=sel?3:1.8;
    const r=featRect(f),inLid=!isEdge(f)&&(f.t==='port'||f.t==='cutout');
    if(inLid&&f.thru==='floor')c.setLineDash([5,3]);// floor openings dashed
    c.beginPath();
    if(['mic','hole','button','led','opening'].includes(f.t))c.arc(X(f.x),Y(f.y),Math.max(0,Math.max(0.8,f.dia/2)*s),0,Math.PI*2);
    else if(inLid&&(f.t==='cutout'?f.shape!=='rect':ROUND_KINDS.has(f.kind)))c.arc(X(f.x),Y(f.y),Math.max(0,(r[2]-r[0])/2*s),0,Math.PI*2);
    else if(f.t==='cone')c.ellipse(X(f.x),Y(f.y),f.cw/2*s,f.ch/2*s,0,0,Math.PI*2);
    else c.rect(X(r[0]),Y(r[3]),(r[2]-r[0])*s,(r[3]-r[1])*s);
    if(f.t==='header')c.setLineDash([3,2]);
    c.fill();c.stroke();c.setLineDash([]);
    c.fillStyle=col;c.textAlign='left';c.font=(sel?'bold ':'')+'11px "Segoe UI",system-ui,sans-serif';
    c.fillText((f.t==='port'?(f.kind||'Port'):FEAT[f.t].name)+(inLid?(f.thru==='floor'?' (floor)':' (lid)'):''),X(r[2])+4,Y(r[3])+10);
    c.restore();
  });
  // pins (gold dots with their names), when their positions are known; the names grow with the picture and have a
  // white edge so they can be read on a dark board or under a feature
  c.font=Math.round(Math.min(16,Math.max(10,s*0.8)))+'px "Segoe UI",system-ui,sans-serif';c.textAlign='center';c.lineJoin='round';
  (ed.pins||[]).forEach((q,i)=>{
    if(q.x===undefined)return;
    const r=Math.max(1.8,s*0.5);
    c.beginPath();c.arc(X(q.x),Y(q.y),Math.max(0,r),0,Math.PI*2);c.fillStyle='#c9a227';c.fill();c.strokeStyle='#6b5500';c.lineWidth=1;c.stroke();
    if(i===edPin){c.beginPath();c.arc(X(q.x),Y(q.y),Math.max(0,r+4),0,Math.PI*2);c.strokeStyle='#e0141e';c.lineWidth=2.5;c.stroke();}
    if(s>=5){const t=q.n.slice(0,8),ty=Y(q.y)-Math.max(4,s*0.7);c.strokeStyle='#fff';c.lineWidth=3;c.strokeText(t,X(q.x),ty);c.fillStyle='#3a2f00';c.fillText(t,X(q.x),ty);}
  });
  // where the numbers are measured from (red 0,0), and the selected feature's or pin's distances from there
  const o=orig(),O=[o==='c'?p.w/2:0,o==='tl'?p.d:o==='c'?p.d/2:0];
  c.save();c.strokeStyle=c.fillStyle='#e0141e';c.lineWidth=2;c.beginPath();
  c.moveTo(X(O[0])-8,Y(O[1]));c.lineTo(X(O[0])+8,Y(O[1]));c.moveTo(X(O[0]),Y(O[1])-8);c.lineTo(X(O[0]),Y(O[1])+8);c.stroke();
  c.font='bold 11px "Segoe UI",system-ui,sans-serif';c.textAlign='right';c.fillText('0,0',X(O[0])-4,Y(O[1])+(o==='tl'?-4:13));c.restore();
  const pt=edPin>=0&&ed.pins[edPin]&&ed.pins[edPin].x!==undefined?ed.pins[edPin]:edSel>=0&&ed.features[edSel]?ptOf(ed.features[edSel]):null;
  if(pt){
    c.save();c.strokeStyle=c.fillStyle='#e0141e';c.lineWidth=1.2;c.setLineDash([5,4]);c.beginPath();
    c.moveTo(X(O[0]),Y(pt.y));c.lineTo(X(pt.x),Y(pt.y));c.moveTo(X(pt.x),Y(O[1]));c.lineTo(X(pt.x),Y(pt.y));c.stroke();c.setLineDash([]);
    c.font='bold 12px "Segoe UI",system-ui,sans-serif';c.lineJoin='round';
    const lab=(t,x,y)=>{c.strokeStyle='#fff';c.lineWidth=3;c.strokeText(t,x,y);c.fillText(t,x,y);};
    if(Math.abs(pt.x-O[0])>0.05){c.textAlign='center';lab('X '+fx(toShow('x',pt.x))+' mm',(X(O[0])+X(pt.x))/2,Y(pt.y)-5);}
    if(Math.abs(pt.y-O[1])>0.05){c.textAlign='left';lab('Y '+fx(toShow('y',pt.y))+' mm',X(pt.x)+5,(Y(O[1])+Y(pt.y))/2+4);}
    c.restore();
  }
};
// The point a feature's numbers refer to: its centre, or for an edge feature its place on that edge.
const ptOf=function ptOf(f){
  if(!isEdge(f))return {x:f.x,y:f.y};
  if(f.side==='xmin'||f.side==='xmax')return {x:f.side==='xmin'?0:ed.w,y:f.u};
  return {x:f.u,y:f.side==='ymin'?0:ed.d};
};
// Moving a port or cut-out between a side wall and the lid or floor: it starts where it was (just inside the
// board for the lid or floor; on the nearest edge for a wall).
const setThru=function setThru(f,v){
  const p=ptOf(f),was=isEdge(f);f.thru=v;
  if(was&&!isEdge(f)){f.x=r1(Math.min(ed.w-2,Math.max(2,p.x)));f.y=r1(Math.min(ed.d-2,Math.max(2,p.y)));}
  else if(!was&&isEdge(f)){
    const d={xmin:p.x,xmax:ed.w-p.x,ymin:p.y,ymax:ed.d-p.y};f.side=Object.keys(d).sort((a,b)=>d[a]-d[b])[0];
    f.u=r1(f.side[0]==='x'?p.y:p.x);if(f.zc===undefined)f.zc=2;
  }
};
// After a pin moves, show its new numbers in the Pins list (except in the box being typed in).
const updPinRow=function updPinRow(i,typing){
  document.querySelectorAll('.plPins tr[data-prow]').forEach(tr=>tr.classList.toggle('on',+tr.dataset.prow===edPin));
  const q=ed.pins[i];if(!q)return;
  for(const [k,a] of [['x','px'],['y','py']]){const el=document.querySelector(`[data-${a}="${i}"]`);if(el&&el!==typing)el.value=q[k]===undefined?'':fx(toShow(k,q[k]));}
};
// "Check size": type the sizes measured with calipers. The outline changes to them; pins and features keep their
// spacing (Fritzing usually gets that right even when its outline is too small) and stay where they are measured
// from the chosen corner (or centre), so the board grows or shrinks around them. Then the part counts as measured.
const checkSize=function checkSize(){
  const o=orig(),round=ed.shape==='round',back=document.createElement('div');back.id='askBack';
  back.innerHTML=`<div id="askBox" class="keyBox"><b>Check size</b><span class="ewNote">: ${esc(ed.name)}</span>
<div class="ewNote" style="margin:6px 0 8px">Measure the board with calipers or a ruler and type what you get. Pins and features keep their spacing and stay where they are, measured from the <b>${esc(ORIGINS[o].toLowerCase())}</b> (change that with "Measure from"). Check afterwards that they line up, and drag any that don't.</div>
<label class="f"><span>${round?'Diameter':'Length (left → right)'}</span><input type="number" step="0.1" data-c="w" value="${fx(ed.w)}"> mm</label>
${round?'':`<label class="f"><span>Width (bottom → top)</span><input type="number" step="0.1" data-c="d" value="${fx(ed.d)}"> mm</label>`}
<label class="f"><span>Total height</span><input type="number" step="0.1" data-c="t" value="${fx(ed.pcb+ed.h)}"> mm</label>
<div class="ewNote">Total height: from the bottom of the board to the top of its tallest part (pins underneath not counted).</div>
<div class="kTest"></div>
<div class="btns"><button data-ok>Use these sizes</button><button data-cancel>Cancel</button></div></div>`;
  const box=back.querySelector('#askBox'),val=k=>{const el=box.querySelector(`[data-c="${k}"]`);return el?parseFloat(el.value):NaN;};
  const done=()=>back.remove();
  const apply=()=>{
    const W1=val('w'),D1=round?W1:val('d'),T=val('t');
    if(!(W1>=0.5&&D1>=0.5)){box.querySelector('.kTest').innerHTML='<span class="bad">Type the length and width in mm.</span>';return;}
    const sx=o==='c'?(W1-ed.w)/2:0,sy=o==='c'?(D1-ed.d)/2:o==='tl'?D1-ed.d:0,r2=v=>+v.toFixed(2);
    for(const f of ed.features){
      if(!isEdge(f)){f.x=r2(f.x+sx);f.y=r2(f.y+sy);}
      else if(f.u!==undefined)f.u=r2(f.u+(f.side==='xmin'||f.side==='xmax'?sy:sx));
    }
    for(const q of ed.pins||[])if(q.x!==undefined){q.x=r2(q.x+sx);q.y=r2(q.y+sy);}
    const was=fx(ed.w)+' × '+fx(ed.d);
    ed.w=r2(W1);ed.d=r2(D1);if(T>0)ed.h=r2(Math.max(0,T-ed.pcb));
    ed.acc='measured';done();markDirty();renderEditor();
    WF.flash('Now '+fx(ed.w)+' × '+fx(ed.d)+' mm (was '+was+'), marked as measured. Check the pins and features line up, then Save part.',8000);
  };
  box.addEventListener('click',e=>{if(e.target.hasAttribute('data-ok'))apply();else if(e.target.hasAttribute('data-cancel'))done();});
  box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')apply();else if(e.key==='Escape')done();});
  document.body.appendChild(back);box.querySelector('input').focus();box.querySelector('input').select();
};
// The nearest gold pin dot within reach of a point on the part, or -1.
const pinAt=function pinAt(x,y){
  let best=-1,bd=Math.max(1,7/pv.s);
  (ed.pins||[]).forEach((q,i)=>{if(q.x===undefined)return;const d=Math.hypot(q.x-x,q.y-y);if(d<bd){bd=d;best=i;}});
  return best;
};
// Live position under the pointer (or of what is being dragged), measured from the chosen corner.
const showXY=function showXY(x,y,what){
  const el=$('plXY');if(!el)return;
  if(x===null){el.style.display='none';return;}
  el.style.display='block';
  el.textContent=(what?what+': ':'')+'X '+fx(toShow('x',x))+'  Y '+fx(toShow('y',y))+' mm from the '+ORIGINS[orig()].toLowerCase();
};
// Feature area on the part (mm): [x0,y0,x1,y1]
const featRect=function featRect(f){
  const p=ed;
  if(isEdge(f)){
    const half=f.t==='antenna'?f.width/2:f.t==='wire'?f.dia/2:f.t==='cutout'?f.cw/2:(ROUND_KINDS.has(f.kind)?Math.max(f.pw,f.ph):f.pw)/2;
    const dep=f.t==='antenna'?f.len:3;
    if(f.side==='xmin')return [0,f.u-half,dep,f.u+half];
    if(f.side==='xmax')return [p.w-dep,f.u-half,p.w,f.u+half];
    if(f.side==='ymin')return [f.u-half,0,f.u+half,dep];
    return [f.u-half,p.d-dep,f.u+half,p.d];
  }
  let hw,hd;
  if(f.t==='port'){const rd=ROUND_KINDS.has(f.kind);hw=(rd?Math.max(f.pw,f.ph):f.pw)/2;hd=rd?hw:f.ph/2;}// through the lid or floor
  else if(f.t==='cutout'){hw=f.cw/2;hd=f.shape==='rect'?f.ch/2:hw;}
  else{hw=f.t==='cone'?f.cw/2:f.fw!==undefined?f.fw/2:f.dia/2;hd=f.t==='cone'?f.ch/2:f.fd!==undefined?f.fd/2:f.dia/2;}
  return [f.x-hw,f.y-hd,f.x+hw,f.y+hd];
};
$('plEdit').addEventListener('dblclick',e=>{if(e.target.id==='plCanvas'&&edMode==='select')setBig(!plBig);});
// The form scrolls with the wheel wherever the pointer is. Otherwise the Notes box or a number box that comes under
// the pointer takes the wheel (a number box even changes its value) and the Pins list at the bottom can't be reached.
$('plEdit').addEventListener('wheel',e=>{
  const form=e.target.closest&&e.target.closest('.plForm'),t=e.target;
  if(!form||e.ctrlKey)return;
  if(t.tagName==='TEXTAREA'&&(e.deltaY<0?t.scrollTop>0:t.scrollTop+t.clientHeight<t.scrollHeight-1))return;// the notes still have text to scroll
  e.preventDefault();form.scrollTop+=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*form.clientHeight:e.deltaY;
},{passive:false});
const pm=e=>{const r=$('plCanvas').getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
const toPart=([sx,sy])=>[(sx-pv.ox)/pv.s,(pv.oy-sy)/pv.s];
const r1=v=>Math.round(v*10)/10;
$('plEdit').addEventListener('pointerdown',e=>{
  if(e.target.id!=='plCanvas'||!pv||e.button!==0)return;
  const cv=e.target,m=pm(e);cv.focus();
  if(pv.raw){
    clicks.push([(m[0]-pv.ox)/pv.s,(m[1]-pv.oy)/pv.s]);
    if(edMode==='corners'&&clicks.length===(ed.shape==='round'?3:4))return finishCorners();
    if(edMode==='side'&&clicks.length===5)return finishSide(clicks[4]);
    setHint();drawEd();return;
  }
  const [x,y]=toPart(m);
  if(edMode.startsWith('add:')){
    const t=edMode.slice(4),f=Object.assign({t},clone(FEAT[t].def));
    if(EDGE_FEATS.includes(t)){
      const d={xmin:Math.abs(x),xmax:Math.abs(ed.w-x),ymin:Math.abs(y),ymax:Math.abs(ed.d-y)};
      f.side=Object.keys(d).sort((a,b)=>d[a]-d[b])[0];f.u=r1(f.side[0]==='x'?y:x);
      if(t==='port'&&ed.type==='charger')f.kind='USB-C';
    }else{f.x=r1(x);f.y=r1(y);}
    ed.features.push(f);edSel=ed.features.length-1;markDirty();
    if(RECT_FEATS.includes(t)){pdrag={new:true,f,x,y};cv.setPointerCapture(e.pointerId);}
    renderFeats();drawEd();return;
  }
  // select / move: a pin dot first (they sit on top), then a feature
  const ph=pinAt(x,y);
  if(ph>=0){const q=ed.pins[ph];edPin=ph;edSel=-1;renderFeats();updPinRow(ph);drawEd();pdrag={pin:q,x,y,fx:q.x,fy:q.y};cv.setPointerCapture(e.pointerId);return;}
  edPin=-1;updPinRow(-1);
  let hit=-1;
  for(let i=ed.features.length-1;i>=0;i--){const r=featRect(ed.features[i]);if(x>=r[0]-1&&x<=r[2]+1&&y>=r[1]-1&&y<=r[3]+1){hit=i;break;}}
  edSel=hit;renderFeats();drawEd();
  if(hit>=0){const f=ed.features[hit];pdrag={f,x,y,fx:f.x,fy:f.y,fu:f.u};cv.setPointerCapture(e.pointerId);}
});
// Dragged features and pins snap to 0.5 mm steps from the chosen corner; hold Alt for 0.1 mm.
$('plEdit').addEventListener('pointermove',e=>{
  if(!pv||pv.raw||e.target.id!=='plCanvas'&&!pdrag)return;
  const [x,y]=toPart(pm(e)),fine=e.altKey;
  if(!pdrag){showXY(x>=-2&&x<=ed.w+2&&y>=-2&&y<=ed.d+2?x:null,y);return;}
  if(pdrag.pin){const q=pdrag.pin;q.x=snapTo('x',pdrag.fx+x-pdrag.x,null,fine);q.y=snapTo('y',pdrag.fy+y-pdrag.y,null,fine);showXY(q.x,q.y,q.n);markDirty();drawEd();return;}
  const f=pdrag.f;
  if(pdrag.new){// dragging out a rectangle feature
    const w=Math.abs(x-pdrag.x),h=Math.abs(y-pdrag.y);if(w<0.5&&h<0.5)return;
    f.x=r1((x+pdrag.x)/2);f.y=r1((y+pdrag.y)/2);
    if(f.t==='cone'){f.cw=r1(w);f.ch=r1(h);}else{f.fw=r1(w);f.fd=r1(h);}
  }else if(isEdge(f)){f.u=snapTo('u',pdrag.fu+(f.side[0]==='x'?y-pdrag.y:x-pdrag.x),f.side,fine);}
  else{f.x=snapTo('x',pdrag.fx+x-pdrag.x,null,fine);f.y=snapTo('y',pdrag.fy+y-pdrag.y,null,fine);}
  const pt=ptOf(f);showXY(pt.x,pt.y,FEAT[f.t].name);
  markDirty();drawEd();
});
$('plEdit').addEventListener('pointerleave',()=>{if(!pdrag)showXY(null);},true);
$('plEdit').addEventListener('pointerup',()=>{if(pdrag){const was=pdrag;pdrag=null;if(was.pin)updPinRow(edPin);else renderFeats();if(edMode.startsWith('add:')){edMode='select';document.querySelectorAll('#plPal button').forEach(b=>b.classList.toggle('on',b.dataset.mode==='select'));setHint();}}});
$('plEdit').addEventListener('keydown',e=>{
  if(e.target.id!=='plCanvas')return;
  if((e.key==='Delete'||e.key==='Backspace')&&edSel>=0){ed.features.splice(edSel,1);edSel=-1;markDirty();renderFeats();drawEd();return;}
  // arrow keys nudge the selected feature or pin 0.1 mm (Shift: 1 mm), the way the arrow points on the picture
  if(!/^Arrow/.test(e.key)||(edSel<0&&edPin<0))return;
  e.preventDefault();
  const st=e.shiftKey?1:0.1,dx=e.key==='ArrowRight'?st:e.key==='ArrowLeft'?-st:0,dy=e.key==='ArrowUp'?st:e.key==='ArrowDown'?-st:0;
  if(edPin>=0){const q=ed.pins[edPin];if(!q||q.x===undefined)return;q.x=+(q.x+dx).toFixed(2);q.y=+(q.y+dy).toFixed(2);updPinRow(edPin);showXY(q.x,q.y,q.n);}
  else{const f=ed.features[edSel];
    if(!isEdge(f)){f.x=+(f.x+dx).toFixed(2);f.y=+(f.y+dy).toFixed(2);}
    else if(f.u!==undefined)f.u=+(f.u+(f.side==='xmin'||f.side==='xmax'?dy:dx)).toFixed(2);
    renderFeats();const pt=ptOf(f);showXY(pt.x,pt.y,FEAT[f.t].name);}
  markDirty();drawEd();
});
// clicking into a pin's row in the Pins list selects that pin on the picture
$('plEdit').addEventListener('focusin',e=>{
  const tr=e.target.closest&&e.target.closest('tr[data-prow]');if(!tr)return;
  const i=+tr.dataset.prow;if(i===edPin)return;edPin=i;edSel=-1;renderFeats();updPinRow(i);drawEd();
});
new ResizeObserver(entries=>{for(const e of entries){const r=e.contentRect;if(r&&(r.width<=0||r.height<=0))return;}if(plBack.style.display==='grid')drawEd();}).observe($('plEdit'));
const addTypical=function addTypical(){
  const p=ed,F=p.features,c=[p.w/2,p.d/2],add=f=>F.push(Object.assign(clone(FEAT[f.t].def),f));
  if(p.type==='mic')add({t:'mic',x:c[0],y:c[1]});
  else if(p.type==='speaker'){add({t:'cone',x:c[0],y:c[1],cw:r1(p.w*0.6),ch:r1(p.d*0.75)});for(const [x,y] of [[3,3],[p.w-3,3],[3,p.d-3],[p.w-3,p.d-3]])add({t:'hole',x,y,dia:3.2});}
  else if(p.type==='charger'){add({t:'port',kind:'USB-C',side:'xmin',u:c[1]});add({t:'led',x:r1(p.w*0.55),y:3});}
  else if(p.type==='board'){add({t:'port',kind:'USB-C',side:'xmin',u:c[1]});add({t:'header',x:c[0],y:1.3,fw:r1(p.w*0.8),fd:2.54,dir:'down'});add({t:'header',x:c[0],y:r1(p.d-1.3),fw:r1(p.w*0.8),fd:2.54,dir:'down'});}
  else if(p.type==='display')add({t:'window',x:c[0],y:c[1],fw:r1(p.w*0.85),fd:r1(p.d*0.7)});
  else if(p.type==='switch')add({t:'switch',side:'ymin',u:c[0]});
  else if(p.type==='amp')add({t:'header',x:c[0],y:1.3,fw:r1(p.w*0.8),fd:2.54,dir:'up'});
  else if(p.type==='sensor')add({t:'hole',x:2.5,y:2.5});
  else return WF.flash('Nothing typical to add for this type: add features with the buttons above the picture');
  WF.flash('Added typical features: drag them to the right places on the photo',4000);
  markDirty();renderEditor();
};
