// ---- the part picture: features drawn to scale on the photo (or on a plain outline)
let pv=null,pdrag=null;
function drawEd(){
  const cv=$('plCanvas');if(!cv)return;
  const wrap=cv.parentElement,dpr=window.devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;if(!cw||!ch)return;
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
    P.forEach((q,i)=>{c.beginPath();c.arc(q[0],q[1],5,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.fillText(String(i+1),q[0]+8,q[1]-6);c.fillStyle='#ff2d55';});
    return;
  }
  const p=ed,s=Math.min((cw-70)/p.w,(ch-60)/p.d);
  pv={s,ox:(cw-p.w*s)/2,oy:(ch+p.d*s)/2};
  const X=x=>pv.ox+x*s,Y=y=>pv.oy-y*s;
  const im=imgOf(p.photo||p.img,drawEd);
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
    if(['mic','hole','button','led','opening'].includes(f.t))c.arc(X(f.x),Y(f.y),Math.max(0.8,f.dia/2)*s,0,Math.PI*2);
    else if(inLid&&(f.t==='cutout'?f.shape!=='rect':ROUND_KINDS.has(f.kind)))c.arc(X(f.x),Y(f.y),(r[2]-r[0])/2*s,0,Math.PI*2);
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
    c.beginPath();c.arc(X(q.x),Y(q.y),r,0,Math.PI*2);c.fillStyle='#c9a227';c.fill();c.strokeStyle='#6b5500';c.lineWidth=1;c.stroke();
    if(i===edPin){c.beginPath();c.arc(X(q.x),Y(q.y),r+4,0,Math.PI*2);c.strokeStyle='#e0141e';c.lineWidth=2.5;c.stroke();}
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
}
// The point a feature's numbers refer to: its centre, or for an edge feature its place on that edge.
function ptOf(f){
  if(!isEdge(f))return {x:f.x,y:f.y};
  if(f.side==='xmin'||f.side==='xmax')return {x:f.side==='xmin'?0:ed.w,y:f.u};
  return {x:f.u,y:f.side==='ymin'?0:ed.d};
}
// Moving a port or cut-out between a side wall and the lid or floor: it starts where it was (just inside the
// board for the lid or floor; on the nearest edge for a wall).
function setThru(f,v){
  const p=ptOf(f),was=isEdge(f);f.thru=v;
  if(was&&!isEdge(f)){f.x=r1(Math.min(ed.w-2,Math.max(2,p.x)));f.y=r1(Math.min(ed.d-2,Math.max(2,p.y)));}
  else if(!was&&isEdge(f)){
    const d={xmin:p.x,xmax:ed.w-p.x,ymin:p.y,ymax:ed.d-p.y};f.side=Object.keys(d).sort((a,b)=>d[a]-d[b])[0];
    f.u=r1(f.side[0]==='x'?p.y:p.x);if(f.zc===undefined)f.zc=2;
  }
}
// After a pin moves, show its new numbers in the Pins list (except in the box being typed in).
function updPinRow(i,typing){
  document.querySelectorAll('.plPins tr[data-prow]').forEach(tr=>tr.classList.toggle('on',+tr.dataset.prow===edPin));
  const q=ed.pins[i];if(!q)return;
  for(const [k,a] of [['x','px'],['y','py']]){const el=document.querySelector(`[data-${a}="${i}"]`);if(el&&el!==typing)el.value=q[k]===undefined?'':fx(toShow(k,q[k]));}
}
// "Check size": type the sizes measured with calipers. The outline changes to them; pins and features keep their
// spacing (Fritzing usually gets that right even when its outline is too small) and stay where they are measured
// from the chosen corner (or centre), so the board grows or shrinks around them. Then the part counts as measured.
function checkSize(){
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
}
// The nearest gold pin dot within reach of a point on the part, or -1.
function pinAt(x,y){
  let best=-1,bd=Math.max(1,7/pv.s);
  (ed.pins||[]).forEach((q,i)=>{if(q.x===undefined)return;const d=Math.hypot(q.x-x,q.y-y);if(d<bd){bd=d;best=i;}});
  return best;
}
// Live position under the pointer (or of what is being dragged), measured from the chosen corner.
function showXY(x,y,what){
  const el=$('plXY');if(!el)return;
  if(x===null){el.style.display='none';return;}
  el.style.display='block';
  el.textContent=(what?what+': ':'')+'X '+fx(toShow('x',x))+'  Y '+fx(toShow('y',y))+' mm from the '+ORIGINS[orig()].toLowerCase();
}
// Feature area on the part (mm): [x0,y0,x1,y1]
function featRect(f){
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
}
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
new ResizeObserver(()=>{if(plBack.style.display==='grid')drawEd();}).observe($('plEdit'));
function addTypical(){
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
}

// ---- photo measuring: straighten a top photo from its 4 corners; heights from a side photo
let photoKind='top';
function pickPhoto(kind){
  if(kind==='top'&&!(ed.w>0&&ed.d>0))return WF.flash('Type the board size first');
  photoKind=kind;photoFrom='';$('plPhotoIn').click();
}
// The photo isn't used as-is: a few clicks on it line it up with the part's real size first (the small
// yellow hint bar above the picture says so too, but it's easy to miss next to a big photo you're looking
// at) - so say it up front, in something the person has to dismiss, not just a line of text they can skip past.
$('plPhotoIn').addEventListener('change',e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const url=URL.createObjectURL(file),im=new Image();
  im.onload=async()=>{
    rawImg=im;clicks=[];edMode=photoKind==='top'?'corners':'side';renderEditor();
    await askHtml(photoKind==='top'
      ?'<div class="kHead"><b>Line up the photo</b></div><p style="margin:0">It isn\'t used yet - click the <b>4 corners of the board</b> in the picture, in this order: <b>top-left, top-right, bottom-right, bottom-left</b>. That lines the photo up with the part\'s real size.</p>'
      :'<div class="kHead"><b>Line up the photo</b></div><p style="margin:0">It isn\'t used yet - click 5 points on the picture in order: the board\'s <b>left end</b> and <b>right end</b> (both at the bottom of the board), its <b>top surface</b>, the <b>top of the tallest part</b>, then the <b>bottom tip of any pins</b> underneath.</p>',
      ['Got it'],0);
  };
  im.onerror=()=>WF.flash('Could not read that picture');
  im.src=url;
});
// Product image: resize to max 600 px on the longest side, store as JPEG in ed.img.
$('plImgIn').addEventListener('change',e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const url=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{
    URL.revokeObjectURL(url);
    const K=Math.min(1,600/Math.max(im.naturalWidth,im.naturalHeight));
    const oc=document.createElement('canvas');oc.width=Math.round(im.naturalWidth*K);oc.height=Math.round(im.naturalHeight*K);
    oc.getContext('2d').drawImage(im,0,0,oc.width,oc.height);
    ed.img=oc.toDataURL('image/jpeg',0.82);markDirty();renderEditor();renderList();
  };
  im.onerror=()=>{URL.revokeObjectURL(url);WF.flash('Could not read that picture');};
  im.src=url;
});
function solve(A,b){
  const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    [M[c],M[p]]=[M[p],M[c]];const d=M[c][c];if(Math.abs(d)<1e-12)throw new Error('points in a line');
    for(let r=0;r<n;r++){if(r===c)continue;const k=M[r][c]/d;for(let j=c;j<=n;j++)M[r][j]-=k*M[c][j];}
  }
  return M.map((r,i)=>r[n]/r[i]);
}
// Projective map taking src[i] to dst[i] (4 point pairs).
function homography(src,dst){
  const A=[],b=[];
  for(let i=0;i<4;i++){const [x,y]=src[i],[u,v]=dst[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
  return [...solve(A,b),1];
}
function finishCorners(){
  const p=ed,s=Math.min(10,900/Math.max(p.w,p.d)),ow=Math.max(8,Math.round(p.w*s)),oh=Math.max(8,Math.round(p.d*s));
  const out=document.createElement('canvas');out.width=ow;out.height=oh;const oc=out.getContext('2d');
  let turned=false;
  try{
    if(p.shape==='round'){
      // circle through the 3 clicks, then crop the square around it
      const [[ax,ay],[bx,by],[cx,cy]]=clicks,d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-9)throw new Error('points in a line');
      const ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d,uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d,r=Math.hypot(ax-ux,ay-uy);
      oc.fillStyle='#e6e6e6';oc.fillRect(0,0,ow,oh);oc.drawImage(rawImg,ux-r,uy-r,2*r,2*r,0,0,ow,oh);
    }else{
      // Photo taken the other way round (e.g. a portrait shot of a board whose Length runs left→right):
      // the clicked shape is tall where the part is wide, so start from the 2nd corner (a quarter turn).
      const dd=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),[c0,c1,c2,c3]=clicks;
      const across=(dd(c0,c1)+dd(c3,c2))/2,down=(dd(c1,c2)+dd(c0,c3))/2,want=Math.log(p.w/p.d);
      if(Math.abs(want)>0.15&&Math.abs(Math.log(down/across)-want)<Math.abs(Math.log(across/down)-want)){clicks=[c1,c2,c3,c0];turned=true;}
      const k=Math.min(1,2400/Math.max(rawImg.naturalWidth,rawImg.naturalHeight)),sw=Math.round(rawImg.naturalWidth*k),sh=Math.round(rawImg.naturalHeight*k);
      const sc=document.createElement('canvas');sc.width=sw;sc.height=sh;const sx=sc.getContext('2d');sx.drawImage(rawImg,0,0,sw,sh);
      const src=sx.getImageData(0,0,sw,sh).data,Hm=homography([[0,0],[ow,0],[ow,oh],[0,oh]],clicks.map(([x,y])=>[x*k,y*k]));
      const id=oc.createImageData(ow,oh),o=id.data;
      for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){
        const X=x+0.5,Y=y+0.5,w=Hm[6]*X+Hm[7]*Y+1,u=(Hm[0]*X+Hm[1]*Y+Hm[2])/w-0.5,v=(Hm[3]*X+Hm[4]*Y+Hm[5])/w-0.5,i=(y*ow+x)*4;
        o[i+3]=255;
        if(u<0||v<0||u>=sw-1||v>=sh-1){o[i]=o[i+1]=o[i+2]=230;continue;}
        const x0=u|0,y0=v|0,fx_=u-x0,fy_=v-y0,q=(y0*sw+x0)*4;
        for(let ch=0;ch<3;ch++){const a=src[q+ch]*(1-fx_)+src[q+4+ch]*fx_,b=src[q+sw*4+ch]*(1-fx_)+src[q+sw*4+4+ch]*fx_;o[i+ch]=a*(1-fy_)+b*fy_;}
      }
      oc.putImageData(id,0,0);
    }
  }catch(err){WF.flash('Those points don\'t make a board outline. Try again.');clicks=[];setHint();drawEd();return;}
  ed.photo=out.toDataURL('image/jpeg',0.82);
  if(photoFrom){ed.notes=('Photo from '+photoFrom+'\n'+(ed.notes||'')).slice(0,2000);photoFrom='';}
  edMode='select';clicks=[];rawImg=null;markDirty();renderEditor();
  WF.flash(turned?'The photo was taken the other way round, so it has been turned a quarter to match the part\'s sizes. If it is upside down, click "Turn photo 180°".':'Photo straightened to scale. Now add features: pick a button above the picture, then click or drag on it.',turned?8000:6000);
}
// Turn the straightened photo half a turn (it keeps the same size and scale).
function turnPhoto(){
  const im=imgOf(ed.photo);if(!im)return;
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const x=c.getContext('2d');x.translate(c.width,c.height);x.rotate(Math.PI);x.drawImage(im,0,0);
  ed.photo=c.toDataURL('image/jpeg',0.82);markDirty();drawEd();renderList();
}
// Turn a whole part a quarter turn clockwise, seen from above: the top edge becomes the right edge.
// Its sizes, features, pins and photo all turn together.
const TURN_SIDE={ymax:'xmax',xmax:'ymin',ymin:'xmin',xmin:'ymax'};
async function turnPart(p){
  const w=p.w,turn=o=>{const x=o.x;o.x=o.y;o.y=+(w-x).toFixed(2);};
  for(const f of p.features||[]){
    if(f.side){if(f.side==='ymin'||f.side==='ymax')f.u=+(w-f.u).toFixed(2);f.side=TURN_SIDE[f.side];}
    if(f.x!==undefined)turn(f);
    if(f.fw!==undefined)[f.fw,f.fd]=[f.fd,f.fw];
    if(f.cw!==undefined)[f.cw,f.ch]=[f.ch,f.cw];
  }
  for(const q of p.pins||[])if(q.x!==undefined)turn(q);
  [p.w,p.d]=[p.d,w];
  if(p.photo){
    const im=await loadImg(p.photo),c=document.createElement('canvas');c.width=im.naturalHeight;c.height=im.naturalWidth;
    const x=c.getContext('2d');x.translate(c.width,0);x.rotate(Math.PI/2);x.drawImage(im,0,0);
    p.photo=c.toDataURL('image/jpeg',0.85);
  }
}
function finishSide(pins){
  const [a,b,top,tall]=clicks,ref=sideRef==='d'?ed.d:ed.w,L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(L<5)return WF.flash('The two ends are too close together. Try again.');
  const mmPerPx=ref/L,dist=q=>Math.abs((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]))/L*mmPerPx;
  ed.pcb=r1(dist(top));ed.h=r1(Math.max(0,dist(tall)-ed.pcb));ed.below=pins?r1(dist(pins)):0;
  edMode='select';clicks=[];rawImg=null;markDirty();renderEditor();
  WF.flash(`Measured: board ${fx(ed.pcb)} mm, tallest part ${fx(ed.h)} mm above it, ${fx(ed.below)} mm underneath. Check the numbers look right.`,7000);
}

// ---- sizes from a dimension drawing: the free Google Gemini AI reads a picture or PDF into a draft part.
// Optional and the only part of the app that uses the internet (only when you ask it to read a drawing).
// The key is kept on this computer only and is never exported with parts.
const AI_MODELS=['gemini-2.5-flash','gemini-3.6-flash','gemini-3.8-flash','gemini-3-flash-preview','gemini-2.5-flash-lite'];
// Which AI does the reading: Google Gemini, NVIDIA, Groq or OpenRouter (free keys) or Claude (paid key). Each keeps its own key.
const PROVIDERS={gemini:{name:'Google Gemini (free)',short:'Gemini',key:'geminiKey'},nvidia:{name:'NVIDIA (free)',short:'NVIDIA',key:'nvidiaKey'},groq:{name:'Groq (free)',short:'Groq',key:'groqKey'},openrouter:{name:'OpenRouter (free)',short:'OpenRouter',key:'openrouterKey'},claude:{name:'Claude (paid per use)',short:'Claude',key:'claudeKey'},openai:{name:'ChatGPT / OpenAI (paid per use)',short:'ChatGPT',key:'openaiKey'},grok:{name:'Grok / xAI (paid per use)',short:'Grok',key:'grokKey'},deepseek:{name:'DeepSeek (paid per use)',short:'DeepSeek',key:'deepseekKey'},ollama:{name:'Ollama (local, offline)',short:'Ollama',key:'ollamaModel',noKey:true}};
const aiProv=()=>PROVIDERS[WF.store.get('aiProvider')]?WF.store.get('aiProvider'):'gemini';
const aiKey=p=>WF.store.get(PROVIDERS[p||aiProv()].key);
const keyLabel=()=>(aiKey()?'Change ':'Set up ')+PROVIDERS[aiProv()].short+(PROVIDERS[aiProv()].noKey?'…':' key…');
let refDraw=null,aiNote='',aiBusy=false;
function clearRef(){if(refDraw&&refDraw.url)URL.revokeObjectURL(refDraw.url);refDraw=null;aiNote='';aiPics=null;}
// ---- product photos found by the look-up: downloaded, shown as thumbnails, then lined up by clicking corners
let aiPics=null,photoFrom='';// aiPics: {loading, items:[{url,src}], links:[url], pages:[url]}
function picsHtml(){
  if(!aiPics)return '';
  const x='<button class="x" data-pics-x="1" title="Hide">✕</button>',own=' Use <b>Top photo…</b> with your own picture.';
  if(aiPics.loading)return `<div class="plPics" id="plPics">Looking for product photos on ${aiPics.pages.length?'the '+aiPics.pages.length+' page'+(aiPics.pages.length>1?'s':'')+' the look-up used':'the web'}…</div>`;
  if(aiPics.items.length)return `<div class="plPics" id="plPics">${x}<b>Photos found online:</b> click the one that shows the board straight from above, then click its 4 corners to line it up with the part.<div>${aiPics.items.map((p,i)=>`<img src="${p.src}" data-pic="${i}" title="${esc(p.url)}" alt="">`).join('')}</div></div>`;
  const pageLinks=aiPics.pages.map((u,i)=>`<a href="${esc(u)}" data-ext="1">page ${i+1}</a>`).join(', ');
  if(!(window.wfNative&&window.wfNative.fetchPage))return `<div class="plPics" id="plPics">${x}Photos are downloaded automatically only in the desktop app.${pageLinks?' Open a page the look-up used to save a photo ('+pageLinks+'), then use <b>Top photo…</b>.':own}</div>`;
  if(!aiPics.pages.length&&!aiPics.links.length)return `<div class="plPics" id="plPics">${x}No web pages were used for this look-up, so there are no photos to offer.${own}</div>`;
  return `<div class="plPics" id="plPics">${x}Looked at ${aiPics.pages.length} page${aiPics.pages.length===1?'':'s'} but found no usable product photo.${own}${pageLinks?' (Or open '+pageLinks+' to look yourself.)':''}</div>`;
}
// Product photos named on a web page: the picture it labels for link previews (og:image, Twitter card),
// the "image" of a product description (JSON-LD), then a few large-looking pictures in the page.
// Each comes back as {url, hint, page}; hint is its file name, alt text and caption (to spot drawings).
const DRAWING_WORDS=/dim(ension)?s?\b|dimension|drawing|mechanical|outline|measure|\bsizes?\b|\bmm\b|footprint|layout/i;
const NOT_DRAWING=/timing|beam|pin-?outs?|wiring|schematic|circuit|connection|graph|chart|waveform/i;// line diagrams that aren't the board's outline
// Distinctive words of the part's name ("hy-srf05" → "srf05", "hysrf05"): a picture whose caption names
// none of them is probably another product (shops list "related items" on the same page).
function partTokens(){
  const t=(ed&&ed.name||'').toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g)||[];
  const strong=t.filter(w=>/\d/.test(w)).flatMap(w=>[w,w.replace(/-/g,''),...w.split('-').filter(p=>p.length>=3&&/\d/.test(p))]);
  return strong.length?strong:t.filter(w=>!/^(module|board|sensor|the|and|for|with|kit|dev|mini|new)$/.test(w));
}
const relevant=(text,tokens)=>{const s=String(text||'').toLowerCase(),flat=s.replace(/[^a-z0-9]/g,'');return tokens.some(t=>s.includes(t)||flat.includes(t.replace(/[^a-z0-9]/g,'')));};
function photosFromPage(html,base){
  const doc=new DOMParser().parseFromString(html,'text/html'),out=[];// parsed only: nothing on the page runs
  const abs=u=>{try{const x=new URL(String(u).trim(),base);return /^https?:$/.test(x.protocol)?x.href:null;}catch(e){return null;}};
  const tokens=partTokens();
  const add=(u,hint,own)=>{
    const a=u&&abs(u);if(!a)return;
    // skip pictures captioned as some other product
    if(!own&&hint&&hint.trim()&&tokens.length&&!relevant(hint+' '+a,tokens))return;
    out.push({url:a,hint:String(hint||'')+' '+a,page:base});
  };
  for(const sel of ['meta[property="og:image:secure_url"]','meta[property="og:image"]','meta[name="og:image"]','meta[name="twitter:image"]','meta[property="twitter:image"]','link[rel="image_src"]'])
    for(const m of doc.querySelectorAll(sel))add(m.getAttribute('content')||m.getAttribute('href'),'preview',true);
  for(const s of doc.querySelectorAll('script[type="application/ld+json"]')){
    try{
      const walk=o=>{if(!o||typeof o!=='object')return;if(Array.isArray(o))return o.forEach(walk);
        if(o.image)[].concat(o.image).forEach(i=>add(typeof i==='string'?i:i&&(i.url||i.contentUrl),'product',true));
        if(o['@graph'])walk(o['@graph']);};
      walk(JSON.parse(s.textContent));
    }catch(e){/* intentional: a page's broken product data is skipped */}
  }
  let n=0;
  for(const img of doc.querySelectorAll('img')){
    if(n>=10)break;
    const src=img.getAttribute('data-large_image')||img.getAttribute('data-zoom-image')||img.getAttribute('data-src')||img.getAttribute('src')||'';
    if(!/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(src)||/logo|icon|sprite|avatar|banner|flag|payment|badge|placeholder|loading|spinner/i.test(src))continue;
    const w=+img.getAttribute('width')||0;if(w&&w<250)continue;
    const fig=img.closest('figure'),cap=fig&&fig.querySelector('figcaption');
    add(src,[img.getAttribute('alt'),img.getAttribute('title'),cap&&cap.textContent].filter(Boolean).join(' '));n++;
  }
  // links straight to a picture file named like a drawing ("...dimensions.png")
  for(const a of doc.querySelectorAll('a[href]')){
    const h=a.getAttribute('href')||'';
    if(/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(h)&&DRAWING_WORDS.test(h+' '+a.textContent))add(h,a.textContent);
  }
  return out;
}
// How much a picture looks like a dimension drawing: mostly white, thin dark lines, little colour,
// and/or named like one. 2 or more counts as a drawing (product photos are colourful boards).
// Load a picture (the load event fires even while the window is minimised; decode() can wait until it's shown).
const loadImg=src=>new Promise((res,rej)=>{const im=new Image(),t=setTimeout(()=>rej(new Error('picture timed out')),15000);
  im.onload=()=>{clearTimeout(t);res(im);};im.onerror=()=>{clearTimeout(t);rej(new Error('not a picture'));};im.src=src;});
async function drawingScore(src,hint){
  const im=await loadImg(src);
  const k=Math.min(1,200/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*k)),h=Math.max(1,Math.round(im.naturalHeight*k));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
  const d=x.getImageData(0,0,w,h).data;let white=0,dark=0,colour=0;
  for(let i=0;i<d.length;i+=4){const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);if(mn>225)white++;else if(mx<110)dark++;if(mx-mn>45)colour++;}
  const n=w*h;white/=n;dark/=n;colour/=n;
  const mid=1-white-dark;// photos are full of in-between shades; line drawings are white with dark lines
  const named=DRAWING_WORDS.test(hint||''),other=NOT_DRAWING.test(hint||'');
  let s=0;
  // measured: a real drawing ~83% white, 4% dark (thin lines), 0.5% colour; a grey board photographed on
  // white ~76% white, 12% dark (solid board), 3% colour
  if(white>0.6&&colour<0.02&&dark>0.004&&dark<0.08&&mid<0.2)s+=2;
  if(named)s+=1.5;
  if(named&&white>0.45&&colour<0.05&&dark<0.15)s+=0.5;
  if(other)s-=2;
  return s;
}
function showPics(){const el=$('plPics'),h=picsHtml();if(el){if(h)el.outerHTML=h;else el.remove();}else if(h){const hint=$('plHint');if(hint)hint.insertAdjacentHTML('afterend',h);}}
const toDataURL=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});
// The desktop app downloads pictures itself; a plain browser can only read pictures from sites that allow it.
async function downloadPic(url){
  let src;
  if(window.wfNative&&window.wfNative.fetchImage){const r=await window.wfNative.fetchImage(url);src='data:'+r.mime+';base64,'+r.b64;}
  else{const r=await fetch(url,{mode:'cors'});if(!r.ok||!/^image\//.test(r.headers.get('content-type')||''))throw new Error('no');src=await toDataURL(await r.blob());}
  const im=await loadImg(src);
  if(Math.min(im.naturalWidth,im.naturalHeight)<160)throw new Error('too small');// icons and thumbnails are no use
  return src;
}
// After a look-up: open the pages it used, sort their pictures into product photos (offered as
// thumbnails) and dimension drawings, then read the best drawing - or failing that a PDF datasheet
// it used - and fold its exact positions into the draft. Returns a note for the yellow bar.
async function findMedia(aiImages,sources){
  const ok=u=>typeof u==='string'&&/^https?:\/\/\S+$/i.test(u);
  const direct=[...new Set((Array.isArray(aiImages)?aiImages:[]).filter(ok))].slice(0,4);
  const all=[...new Set((sources||[]).map(s=>s.uri).filter(ok))];
  const isPdf=u=>/\.pdf(\?|#|$)/i.test(u);
  const pages=all.filter(u=>!isPdf(u)).slice(0,6),pdfs=all.filter(isPdf).slice(0,2);
  const forPart=ed.id,still=()=>ed&&ed.id===forPart;
  aiPics={loading:!!(window.wfNative&&window.wfNative.fetchPage),items:[],links:direct,pages};showPics();
  if(!(window.wfNative&&window.wfNative.fetchPage))return '';
  const found=await Promise.all(pages.map(u=>window.wfNative.fetchPage(u).then(r=>photosFromPage(r.html,r.url),()=>[])));
  // pictures named like drawings first (wherever they are on the page), then a few from each page, best first
  let cands=[...direct.map(u=>({url:u,hint:'',page:''})),...found.flat().filter(c=>DRAWING_WORDS.test(c.hint)&&!NOT_DRAWING.test(c.hint))];
  for(let i=0;i<12;i++)for(const list of found)if(list[i])cands.push(list[i]);
  cands=cands.filter((c,i)=>cands.findIndex(q=>q.url===c.url)===i).slice(0,24);
  const got=(await Promise.all(cands.map(c=>downloadPic(c.url).then(async src=>({...c,src,score:await drawingScore(src,c.hint).catch(()=>0)}),()=>null)))).filter(Boolean);
  const uniq=got.filter((p,i)=>got.findIndex(q=>q.src.length===p.src.length&&q.src===p.src)===i);// same picture under two addresses
  const drawings=uniq.filter(p=>p.score>=2).sort((a,b)=>b.score-a.score),items=uniq.filter(p=>p.score<2).slice(0,6);
  if(!still())return '';
  aiPics={loading:false,items,links:cands.map(c=>c.url),pages};showPics();
  return readFoundDrawing(drawings,pdfs,still);
}
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch(e){return 'a web page';}};
async function readFoundDrawing(drawings,pdfs,still){
  const tries=[...drawings.slice(0,2).map(p=>({src:p.src,url:p.url,page:p.page||p.url,label:'a dimension drawing on '+hostOf(p.page||p.url)})),
    ...pdfs.slice(0,1).map(u=>({pdf:u,url:u,page:u,label:'the datasheet PDF from '+hostOf(u)}))];
  for(const t of tries){
    if(!still())return '';
    aiBusy='Reading '+t.label+' for exact positions…';renderEditor();
    try{
      let b64,mime;
      if(t.pdf){const r=await window.wfNative.fetchPdf(t.pdf);b64=r.b64;mime=r.mime;}
      else{mime=t.src.slice(5,t.src.indexOf(';'));b64=t.src.slice(t.src.indexOf(',')+1);}
      const dd=await aiRead(b64,mime,'This drawing or datasheet is for: "'+ed.name+'", type: '+TYPES[ed.type].name+'. Its overall size should be about '+fx(ed.w)+' × '+fx(ed.d)+' mm.');
      if(!still())return '';
      refDraw={name:t.label,url:t.src||null,big:false};
      const a=[ed.w,ed.d].sort((x,y)=>y-x),b=[num(dd.w,0),num(dd.d,0)].sort((x,y)=>y-x);
      if(!(b[1]>0)){continue;}
      const match=Math.abs(b[0]-a[0])/a[0]<0.2&&Math.abs(b[1]-a[1])/a[1]<0.25;
      if(!match){aiBusy=false;return ` <b>A dimension drawing was found</b> (top right, from <a href="${esc(t.page)}" data-ext="1">${esc(hostOf(t.page))}</a>) but its size (${fx(b[0])} × ${fx(b[1])} mm) doesn't match the look-up's (${fx(a[0])} × ${fx(a[1])} mm), so nothing was changed. Check which is right.`;}
      // The drawing is the better source for the top view; keep the look-up's heights where the drawing has none.
      const merged={name:ed.name,type:ed.type,mount:dd.mount==='wall'?'wall':ed.mount,shape:dd.shape==='round'?'round':ed.shape,w:dd.w,d:dd.d,
        pcb:num(dd.pcb,0)>0?dd.pcb:ed.pcb,h:num(dd.h,0)>0?dd.h:ed.h,below:num(dd.below,0)>0?dd.below:ed.below,
        features:Array.isArray(dd.features)&&dd.features.length?dd.features:ed.features,uncertain:dd.uncertain,notes:'Positions read from '+t.label+': '+t.url};
      aiBusy=false;applyDrawing(merged,t.label,[{uri:t.page,title:hostOf(t.page)}]);
      return ` <b>Exact positions were read from ${esc(t.label)}</b> (top right): check them against it.`;
    }catch(e){if(!e.soft&&!/HTTP|not a|too big|abort/i.test(e.message||''))throw e;}
  }
  aiBusy=false;
  return tries.length?' A dimension drawing was found but couldn\'t be read.':'';
}
function usePic(i){
  const p=aiPics&&aiPics.items[i];if(!p)return;
  if(!(ed.w>0&&ed.d>0))return WF.flash('Type the board size first');
  const im=new Image();
  im.onload=()=>{rawImg=im;clicks=[];edMode='corners';photoFrom=p.url;renderEditor();};
  im.src=p.src;
}
const openWeb=url=>window.open(url,'_blank','noopener');
// Your own search, worded to reach the maker's documentation (where the dimension drawings are);
// images=true opens Google Images, where drawings show up as pictures to drag into "Read a drawing".
async function findDrawings(images){
  let q=ed.name&&ed.name!=='New part'?ed.name:'';
  q=await WF.askText((images?'Search pictures':'Search the web')+' for which part? (the part number works best)',q);
  if(!q||!q.trim())return;
  openWeb('https://www.google.com/search?'+(images?'udm=2&':'')+'q='+encodeURIComponent(q.trim()+' technical documentation schematic sizes'));
  WF.flash(images?'Your web browser shows pictures. Find a dimension drawing, copy or save it, then press Ctrl+V here or click "Read a drawing…".':'Your web browser is searching. Save a dimension drawing (picture or PDF), then click "Read a drawing…".',8000);
}
// Someone may already have made a part file for this board: it carries the pins, size and picture.
async function findPartFile(){
  let q=ed.name&&ed.name!=='New part'?ed.name:'';
  q=await WF.askText('Search for a part file (.fzpz) for which part? (the part number works best)',q);
  if(!q||!q.trim())return;
  openWeb('https://www.google.com/search?q='+encodeURIComponent(q.trim()+' fzpz'));
  WF.flash('Your web browser is searching for part files. Download a .fzpz that matches your board, then drag it onto the part picture here (or click "Import pins…" and "Use a .fzpz file…").',10000);
}
// Setting up an AI key: what each AI is good for, steps to get a key (free for Gemini, NVIDIA, Groq and OpenRouter), a button that
// opens the right web page, and a Test that sends "hello" to prove the key works before it is saved.
const KEY_HELP={
  gemini:{site:'https://aistudio.google.com/apikey',open:'Open Google AI Studio',
    about:'Free. Good at looking parts up on the web. Can be busy at peak times.',
    steps:['Click <b>Open Google AI Studio</b> below. It opens in your web browser.','Sign in with any Google account (a Gmail address is fine).','Click <b>Create API key</b>. If it asks for a project, let it make one for you.','Click <b>Copy</b> next to your new key (it starts with <code>AIza</code>).','Come back here, paste it in the box below and click <b>Test</b>.']},
  nvidia:{site:'https://build.nvidia.com/settings/api-keys',open:'Open NVIDIA Build',
    about:'Free (about 40 requests a minute), no card needed. Good for Make it with AI and reading pictures of drawings. It can\'t search the web, so Look up online uses what it already knows. Desktop app only.',
    steps:['Click <b>Open NVIDIA Build</b> below. It opens in your web browser.','Sign in, or make a free NVIDIA account with your email (no card needed).','Click <b>Generate API Key</b> (or the <b>Get API Key</b> button on any model page).','Copy the key (it starts with <code>nvapi-</code>).','Come back here, paste it in the box below and click <b>Test</b>.']},
  groq:{site:'https://console.groq.com/keys',open:'Open Groq',
    about:'Free (about 30 requests a minute and 1,000 a day), no card needed. Very fast. Good for ideas, Ask AI and writing code. It can\'t search the web, so Look up online uses what it already knows. It can read pictures of drawings, but not PDFs. Works in the web version and the desktop app.',
    steps:['Click <b>Open Groq</b> below. It opens in your web browser.','Sign up free (an email or Google account is fine, no card needed).','Go to the <b>Playground</b>, then click <b>API Keys</b> at the top right.','Click <b>Create API Key</b>, give it any name, and copy the key (it starts with <code>gsk_</code>). You only see it once.','Come back here, paste it in the box below and click <b>Test</b>.']},
  openrouter:{site:'https://openrouter.ai/settings/keys',open:'Open OpenRouter',
    about:'Free models, no card needed, but only about 50 requests a day (and 20 a minute), so it runs out sooner than the others. Some free models may keep what you send to improve their AI, so don\'t type anything private. It can\'t search the web, so Look up online uses what it already knows. It can read pictures of drawings, but not PDFs. Works in the web version and the desktop app.',
    steps:['Click <b>Open OpenRouter</b> below. It opens in your web browser.','Sign up free and log in.','Find <b>API Keys</b> (under your account menu at the top right) and click <b>Create</b> (or <b>Create API Key</b>).','If it asks for a tier or credit limit, pick any: it\'s free, and you won\'t be billed because you haven\'t entered a payment method. Copy the key (it starts with <code>sk-or-</code>).','Come back here, paste it in the box below and click <b>Test</b>.']},
  claude:{site:'https://console.anthropic.com/settings/keys',open:'Open the Anthropic Console',
    about:'Paid per use from credit you add: roughly US$0.10–0.40 per web look-up, a few cents for the rest. The most reliable, and rarely busy.',
    steps:['Click <b>Open the Anthropic Console</b> below and sign in or sign up.','Add some credit under <b>Billing</b>.','Go to <b>Settings › API Keys</b> and click <b>Create Key</b>.','Copy the key (it starts with <code>sk-ant-</code>).','Come back here, paste it in the box below and click <b>Test</b>.']},
  ollama:{site:'https://ollama.com/download',open:'Download Ollama',
    about:'Completely free and offline: a small AI runs on this computer, no account and nothing sent over the internet once it\'s set up. Best for the parts-list wizard and ESPHome code; most small local models can\'t read a picture of a drawing, so those stay on Gemini or Claude.',
    steps:['Click <b>Download Ollama</b> below, install it, and open it (it runs quietly in the background).','Open a terminal (Command Prompt, PowerShell or Terminal) and run: <code>ollama pull gemma:2b</code> (or any small model you\'d rather use, e.g. <code>llama3.2</code> or <code>qwen2.5:7b</code> - bigger models need a more powerful computer).','Type the exact model name below, the same as you pulled it (run <code>ollama list</code> if you forget it).','Click <b>Test</b> to check EvenUCan can reach it.']},
  openai:{site:'https://platform.openai.com/api-keys',open:'Open OpenAI Platform',
    about:'Paid per use (ChatGPT / GPT-4o). Very reliable and accurate. You pay from credit you add to your OpenAI account. Good for all tasks: parts wizard, writing code and looking things up.',
    steps:['Click <b>Open OpenAI Platform</b> below and sign in or sign up.','Add credit under <b>Billing → Add payment method</b>.','Go to <b>API Keys</b> and click <b>Create new secret key</b>.','Copy the key (it starts with <code>sk-</code>). You only see it once.','Come back here, paste it in the box below and click <b>Test</b>.']},
  grok:{site:'https://console.x.ai/',open:'Open xAI Console',
    about:'Paid per use (Grok by xAI). Fast and capable. You pay from credit added to your xAI account.',
    steps:['Click <b>Open xAI Console</b> below and sign in (an X/Twitter account or email works).','Add credit under <b>Billing</b>.','Go to <b>API Keys</b> and click <b>Create API Key</b>.','Copy the key (it starts with <code>xai-</code>). You only see it once.','Come back here, paste it in the box below and click <b>Test</b>.']},
  deepseek:{site:'https://platform.deepseek.com/api_keys',open:'Open DeepSeek Platform',
    about:'Paid per use. Very cheap: deepseek-chat (V3) costs about US$0.27 per million tokens — a typical parts-wizard run costs a fraction of a cent. Fast and accurate. You pay from credit added to your DeepSeek account.',
    steps:['Click <b>Open DeepSeek Platform</b> below and sign in or create a free account.','Go to <b>Billing</b> and add a small amount of credit (even $5 lasts a very long time).','Go to <b>API Keys</b> and click <b>Create API Key</b>.','Copy the key (it starts with <code>sk-</code>). You only see it once.','Come back here, paste it in the box below and click <b>Test</b>.']}
};
// Send a tiny "hello" with this key and return the AI's reply (or throw, saying what is wrong in plain words).
async function aiTest(p,key){
  const ask='Reply with just the word: hello';
  if(OA[p]){
    const A=OA[p];let last='';
    for(const m of oaOrder(p,A.local?key:null)){
      const {status,j,msg}=await oaChat(p,key,m,ask,A.testTokens||20);
      if(status===401||status===403)throw new Error(A.local?'Ollama said no model name was given. Type the exact model name (e.g. gemma:2b) and test again.':A.name+' didn\'t accept this key. Check you copied all of it (it starts with '+A.starts+').');
      if(status===429)throw new Error('The key looks fine, but '+A.name+' is busy or the free limit ('+A.limit+') was reached. Wait a minute (or until tomorrow for a daily limit) and test again.');
      if(status===200){const c=j.choices&&j.choices[0];return String((c&&c.message&&c.message.content)||'').replace(/<think>[\s\S]*?<\/think>/g,'').trim()||'(an empty reply)';}
      last=msg||'HTTP '+status;// busy or renamed model: try the next
    }
    throw new Error(A.local?'Ollama didn\'t answer ('+last+'). Check the model name is exactly what "ollama list" shows, and that you pulled it.':A.name+' didn\'t answer ('+last+'). The key may still be fine: test again in a minute.');
  }
  if(p==='claude'){
    const SDK=window.AnthropicSDK;if(!SDK)throw new Error('The Claude add-on is missing from this copy of the app.');
    try{
      const m=await new SDK({apiKey:key,dangerouslyAllowBrowser:true,maxRetries:1}).messages.create({model:'claude-haiku-5-5',max_tokens:20,messages:[{role:'user',content:ask}]});
      return m.content.filter(b=>b.type==='text').map(b=>b.text).join('').trim()||'(an empty reply)';
    }catch(e){
      if(e instanceof SDK.AuthenticationError||e instanceof SDK.PermissionDeniedError)throw new Error('Anthropic didn\'t accept this key. Check you copied all of it (it starts with sk-ant-).');
      if(e instanceof SDK.BadRequestError&&/credit/i.test(e.message))throw new Error('The key works, but the account has no credit. Add some under Billing at console.anthropic.com.');
      if(e instanceof SDK.APIConnectionError)throw new Error('Couldn\'t reach Anthropic. Check the internet connection.');
      throw new Error((e&&e.message)||String(e));
    }
  }
  let last='';
  for(const m of [WF.store.get('geminiModel'),...AI_MODELS].filter((m,i,a)=>m&&a.indexOf(m)===i)){
    let r;
    try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:ask}]}]})});}
    catch(e){throw new Error('Couldn\'t reach Google. Check the internet connection.');}
    const j=await r.json().catch(()=>({})),msg=(j.error&&j.error.message)||'';
    if(r.status===401||r.status===403||/API key/i.test(msg))throw new Error('Google didn\'t accept this key. Check you copied all of it (it starts with AIza).');
    if(r.status===429)throw new Error('The key works, but the free limit is used up for now. Try again later.');
    if(r.ok){const c=j.candidates&&j.candidates[0];return ((c&&c.content&&c.content.parts)||[]).map(x=>x.text||'').join('').trim()||'(an empty reply)';}
    last=msg||'HTTP '+r.status;// busy or renamed model: try the next
  }
  throw new Error('Google is busy right now ('+last+'). The key may still be fine: test again in a minute.');
}
// After an AI or key changes, redraw whichever window shows the AI menu.
function aiChanged(){
  if(plBack.style.display==='grid'&&ed)renderEditor();
  if(wrBack.style.display==='grid')renderWiringSide();
}
// Is Ollama running right now, and what models does it have? Desktop: asks the main process (no CORS
// limit there). Web: asks the page's own origin can usually reach localhost even cross-origin for a
// plain GET, so this is tried directly; it simply shows "not running" if the browser blocks it.
async function ollamaStatus(){
  if(window.wfNative&&window.wfNative.checkOllama){try{return await window.wfNative.checkOllama();}catch(e){return {running:false,models:[]};}}
  try{
    const r=await fetch('http://localhost:11434/api/tags',{signal:AbortSignal.timeout(3000)});
    if(!r.ok)return {running:false,models:[]};
    const j=await r.json();
    return {running:true,models:(Array.isArray(j.models)?j.models:[]).map(m=>({name:String(m.name||m.model||''),vision:Array.isArray(m.capabilities)&&m.capabilities.includes('vision')})).filter(m=>m.name)};
  }catch(e){return {running:false,models:[]};}
}
function askKey(prov){
  return new Promise(res=>{
    const back=document.createElement('div');back.id='askBack';// (while it is open, keys belong to it)
    back.innerHTML='<div id="askBox" class="keyBox"></div>';
    const box=back.querySelector('#askBox');
    let p=PROVIDERS[prov]?prov:aiProv(),busy=false,ollStatus=null,ollChecking=false;
    const checkOllama=()=>{
      if(p!=='ollama'||ollChecking)return;
      ollChecking=true;ollamaStatus().then(s=>{ollChecking=false;ollStatus=s;if(p==='ollama')drawOllamaStatus();});
    };
    const drawOllamaStatus=()=>{
      const el=box.querySelector('#ollStatus');if(!el)return;
      const desk=!!(window.wfNative&&window.wfNative.checkTool);
      if(ollChecking){el.innerHTML='<div class="ewNote">Checking whether Ollama is running…</div>';return;}
      if(!ollStatus){el.innerHTML='';return;}
      if(ollStatus.running){
        el.innerHTML=`<div class="ok">✓ Ollama is running${ollStatus.models.length?', with '+ollStatus.models.length+' model'+(ollStatus.models.length===1?'':'s')+' ready:':'. '+(ollStatus.models.length===0?'No models yet - pull one first (see step 2 above).':'')}</div>`+
          (ollStatus.models.length?`<div class="btns" style="flex-wrap:wrap">${ollStatus.models.map(m=>`<button data-k="pick" data-m="${esc(m.name)}">${esc(m.name)}${m.vision?' 📷':''}</button>`).join('')}</div>`:'');
      }else if(desk){
        el.innerHTML='<div class="warn">Ollama doesn\'t seem to be running.</div><div class="btns"><button data-k="startOll">Start Ollama</button></div>';
      }else{
        el.innerHTML='<div class="ewNote">Running EvenUCan in a browser tab? The browser blocks direct access to Ollama (CORS) — if Ollama is already running, that\'s fine: just type the model name below and click <b>Test</b> to confirm it works. Run <code>ollama list</code> in a terminal to see your models.</div>';
      }
    };
    const draw=()=>{
      const h=KEY_HELP[p],has=!!aiKey(p),noKey=!!PROVIDERS[p].noKey,word=noKey?'model name':'key';
      box.innerHTML=`<div class="kHead"><b>AI ${word} for</b> <select data-k="prov">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${k===p?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></div>
<div class="ewNote">${h.about}</div>${OA[p]&&OA[p].deskOnly&&!(window.wfNative&&window.wfNative.aiPost)?'<div class="warn">This is the web version: NVIDIA only works in the EvenUCan desktop app. Here, pick Google Gemini (free) or Claude.</div>':''}${has?'<div class="ok">✓ A '+word+' is saved for this AI. '+(noKey?'Change it below if you\'re using a different model.':'Paste a new one to replace it.')+'</div>':''}
<ol>${h.steps.map(s=>`<li>${s}</li>`).join('')}</ol>
<div class="btns kOpen"><button data-k="open">${esc(h.open)}</button></div>
${noKey?'<div id="ollStatus"></div>':''}
<input data-k="key" autocomplete="off" spellcheck="false" placeholder="${noKey?'Type the Ollama model name here, e.g. gemma:2b':'Paste your '+esc(PROVIDERS[p].short)+' key here'}" value="${esc(has?aiKey(p):'')}">
${noKey?(()=>{try{const all=JSON.parse(WF.store.get('ollamaTimings')||'{}'),m=aiKey(p)||'',arr=m&&all[m];if(!arr||!arr.length)return'';const avg=Math.round(arr.reduce((a,b)=>a+b,0)/arr.length),last=arr[arr.length-1];return`<div class="ewNote" id="ollTimings" style="margin-top:4px">⏱ <b>${esc(m)}</b>: last ${last}s · avg ${avg}s over ${arr.length} run${arr.length===1?'':'s'}</div>`;}catch(e){return'';}})():''}
<div class="kTest"></div>
<div class="btns">${has?`<button data-k="remove">Remove ${word}</button>`:''}<button data-k="test">Test</button><button data-ok>Save</button><button data-cancel>Cancel</button></div>
<div class="ewNote" style="margin-top:6px">${noKey?'The model name stays on this computer only, and nothing is ever sent anywhere else.':'The key stays on this computer only.'}</div>`;
      box.querySelector('input').focus();
      if(noKey){checkOllama();drawOllamaStatus();}
    };
    const done=()=>{back.remove();aiChanged();res();};
    const save=()=>{
      const v=box.querySelector('input').value.trim(),word=PROVIDERS[p].noKey?'model name':'key';
      if(!v&&PROVIDERS[p].noKey){const out=box.querySelector('.kTest');if(out)out.innerHTML='<span class="bad">Type the model name first (e.g. gemma:2b). Run <code>ollama list</code> in a terminal to see what you have.</span>';return;}
      if(v){WF.store.set(PROVIDERS[p].key,v);WF.store.set('aiProvider',p);WF.flash(PROVIDERS[p].short+' '+word+' saved on this computer. EvenUCan now uses '+PROVIDERS[p].name+'.',5000);}
      done();
    };
    const test=async()=>{
      const v=box.querySelector('input').value.trim(),out=box.querySelector('.kTest'),word=PROVIDERS[p].noKey?'model name':'key';
      if(!v){out.innerHTML='<span class="bad">Type the '+word+' in the box first.</span>';return;}
      busy=true;box.querySelectorAll('button').forEach(b=>b.disabled=true);
      out.innerHTML='<span class="ewNote">Sending "hello" to '+esc(PROVIDERS[p].short)+'…</span>';
      try{const reply=await aiTest(p,v);out.innerHTML='<span class="ok">✓ It works. '+esc(PROVIDERS[p].short)+' replied: "'+esc(reply.slice(0,80))+'". Click Save to use it.</span>';}
      catch(e){out.innerHTML='<span class="bad">✗ '+esc(e.message||String(e))+'</span>';}
      busy=false;box.querySelectorAll('button').forEach(b=>b.disabled=false);
    };
    box.addEventListener('change',e=>{if(e.target.dataset.k==='prov'){p=e.target.value;ollStatus=null;draw();}});
    box.addEventListener('click',e=>{
      const k=e.target.dataset.k;if(busy)return;
      if(k==='open')openWeb(KEY_HELP[p].site);
      else if(k==='test')test();
      else if(k==='remove'){localStorage.removeItem('opensketch.'+PROVIDERS[p].key);WF.flash(PROVIDERS[p].short+' '+(PROVIDERS[p].noKey?'model name':'key')+' removed');draw();}
      else if(k==='pick'){const inp=box.querySelector('input');inp.value=e.target.dataset.m;inp.focus();}
      else if(k==='startOll'){
        if(!(window.wfNative&&window.wfNative.launchOllama))return;
        e.target.disabled=true;e.target.textContent='Starting…';
        window.wfNative.launchOllama().then(r=>{
          if(!r.ok){WF.flash(r.err==='not-installed'?'Ollama isn\'t installed here - click "Download Ollama" above.':'Couldn\'t start Ollama.',6000);drawOllamaStatus();return;}
          setTimeout(()=>{ollStatus=null;checkOllama();drawOllamaStatus();},2000);// give it a moment to come up
        });
      }
      else if(e.target.hasAttribute('data-ok'))save();
      else if(e.target.hasAttribute('data-cancel'))done();
    });
    box.addEventListener('keydown',e=>{e.stopPropagation();if(busy)return;if(e.key==='Enter'&&e.target.tagName==='INPUT')save();else if(e.key==='Escape')done();});
    document.body.appendChild(back);draw();
  });
}
const AI_PROMPT=`You read mechanical dimension drawings of small electronic parts (dev boards, breakout boards, sensors, microphones, amplifiers, speakers, batteries, displays, switches) and return their sizes, for designing a 3D-printed box around them.
Return ONLY a JSON object:
{"name": string, "type": "board"|"mic"|"speaker"|"amp"|"charger"|"battery"|"sensor"|"display"|"switch"|"other",
 "shape": "rect"|"round", "w": length in mm along X (the LONGER side of a rectangle; the diameter if round), "d": width in mm along Y,
 "pcb": board thickness in mm (0 for a solid block such as a battery or enclosed speaker), "h": height of the tallest part above the board top in mm (for a block: its full height),
 "below": height of pins or parts under the board in mm (0 if none),
 "mount": "wall" if the part must face out through a side of the box (microphones, speakers, ultrasonic or distance sensors, cameras), "outside" if the part lives entirely outside the enclosure (soil moisture probes, buried or submerged sensors, outdoor weather sensors, anything that goes into soil, water or the environment), otherwise "floor",
 "features": [ ... ], "pins": [ {"name": exact printed label e.g. "SDA" or "D7", "x", "y": centre of that pin/pad in mm (same frame as above), "role": "gnd"|"3v3"|"5v"|"vcc"|"vin"|"sda"|"scl"|"gpio"|"sig"|"trig"|"echo"|"ao"|"do"|"nc"} ], "uncertain": [short strings], "notes": short string}
Coordinates: looking down on the top (component side), origin at the bottom-left corner, x to the right along w, y up along d, all in mm, positions are centres.
Feature objects:
 {"t":"hole","x","y","dia"} mounting hole
 {"t":"port","kind":"USB-C"|"Micro-USB"|"Mini-USB"|"USB-A"|"DC barrel"|"3.5 mm jack"|"microSD"|"JST / wires"|"Custom","side":"xmin"|"xmax"|"ymin"|"ymax","u": centre position along that edge (the y value for xmin/xmax, the x value for ymin/ymax),"zc": height of the socket centre above the board top}
 {"t":"antenna","side","u","len": depth into the board,"width"}
 {"t":"header","x","y","fw": length along x,"fd": width along y,"dir":"down"|"up"} a row of pin holes or pins
 {"t":"mic","x","y","dia"} microphone sound hole
 {"t":"cone","x","y","cw","ch"} speaker cone (use the face that has the cone as the view)
 {"t":"opening","x","y","dia"} round part that must show through the box: each ultrasonic transducer (the two round "eyes" of an ultrasonic distance sensor - use this, not "cone"), IR sensor dome, buzzer, camera lens
 {"t":"button","x","y","dia"}, {"t":"led","x","y","dia"}
 {"t":"window","x","y","fw","fd"} display active area
 {"t":"switch","side","u","zc"} switch lever on an edge
Pin roles: gnd=ground, 3v3=3.3V power, 5v=5V power, vcc=power at another or unclear voltage, vin=power in before the board's own regulator, sda/scl=I2C data/clock, gpio=a general-purpose digital pin on a microcontroller/dev board that code can use freely (Arduino/ESP32/Pi-style D0, D7, GPIO14, IO2, A0 and so on - put the pin number in its name exactly as printed, e.g. "D7" or "GPIO14"), sig=a single fixed-purpose signal pin on a sensor or other module (not a GPIO a sketch chooses what to do with), trig/echo=ultrasonic trigger/echo, ao=analog output (a voltage proportional to the measured value, connects to an ADC GPIO, e.g. MQ gas sensor AO pin), do=digital output (a comparator-driven high/low output, connects to any GPIO, e.g. MQ gas sensor DO pin), nc=not connected/do not use. Use gpio only for a dev board's own general I/O pins, not for a sensor's dedicated pins.
Rules: use numbers stated on the drawing or clearly worked out from it. Do not invent features that are not shown. If something needed is not shown, give your best estimate and add it to "uncertain". If there are several views, combine them. Turn the frame if needed so that w >= d. If a pinout (a header, connector or row of pads with printed names) is shown, list every individual pin with its own name, position and role - not just the header's outline as a "header" feature. Never return anything except the JSON.`;
const fileB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=()=>rej(r.error);r.readAsDataURL(f);});
// Big photos are shrunk before sending (drawings stay readable at 3000 px).
async function shrinkImage(f){
  if(f.size<3e6&&/^image\/(png|jpeg|gif|webp)$/.test(f.type))return {b64:await fileB64(f),mime:f.type};// (Claude takes up to 5 MB per picture)
  const url=URL.createObjectURL(f),im=await loadImg(url);
  const k=Math.min(1,3000/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
  c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);
  return {b64:c.toDataURL('image/jpeg',0.9).split(',')[1],mime:'image/jpeg'};
}
// The JSON object in an AI's reply (it may come wrapped in a sentence or ``` fences).
function aiJSON(txt,web){
  const s=txt.indexOf('{'),e=txt.lastIndexOf('}');
  if(s<0||e<s)throw softErr(web?'The AI didn\'t give sizes.':'The AI couldn\'t read sizes from that file. Try a clearer drawing.');
  try{return JSON.parse(txt.slice(s,e+1));}catch(err){throw softErr('The AI\'s answer was garbled.');}
}
// Links it names itself plus the pages its search tool returned, without repeats.
function aiSources(data,found){
  const all=[...(Array.isArray(data.sources)?data.sources:[]).filter(u=>typeof u==='string'&&/^https:\/\//.test(u)).map(u=>({uri:u,title:u.replace(/^https:\/\/(www\.)?/,'').slice(0,60)})),...found];
  return all.filter((x,i)=>all.findIndex(y=>y.uri===x.uri)===i).slice(0,6);
}
// One request to Claude through the official Anthropic SDK (embedded above). content: the message blocks;
// web: let Claude search the web and open pages and PDFs itself.
async function claude(content,web){
  const SDK=window.AnthropicSDK;if(!SDK)throw new Error('The Claude add-on is missing from this copy of the app.');
  const client=new SDK({apiKey:aiKey('claude'),dangerouslyAllowBrowser:true,maxRetries:3});// the key is the user's own, kept on this computer
  const params={
    model:'claude-opus-5-5',max_tokens:64000,output_config:{effort:'medium'},
    // If Claude's safety check declines (rare for datasheets), Anthropic re-runs the request on a suitable model.
    betas:['server-side-fallback-2026-07-01'],fallbacks:'default',
    messages:[{role:'user',content}]};
  if(web)params.tools=[{type:'web_search_20260209',name:'web_search',max_uses:5},{type:'web_fetch_20260209',name:'web_fetch',max_uses:6}];
  let msg;
  try{
    for(let i=0;i<5;i++){// a long search can pause part-way: send it back to carry on
      msg=await client.beta.messages.stream(params).finalMessage();
      if(msg.stop_reason!=='pause_turn')break;
      params.messages=[...params.messages,{role:'assistant',content:msg.content}];
    }
  }catch(e){
    aiLastReply='Claude error'+(e&&e.status?' · HTTP '+e.status:'')+'\n\n'+((e&&e.message)||String(e));
    if(e instanceof SDK.AuthenticationError||e instanceof SDK.PermissionDeniedError)throw new Error('Anthropic didn\'t accept the Claude key. Click "Change Claude key…" and paste it again.');
    if(e instanceof SDK.RateLimitError)throw new Error('Claude is getting too many requests from this key just now. Wait a minute and try again.');
    if(e instanceof SDK.APIConnectionError)throw new Error('Couldn\'t reach Anthropic. Check the internet connection and try again.');
    if(e instanceof SDK.BadRequestError&&/credit/i.test(e.message))throw new Error('The Claude account has no credit left. Add some under Billing at console.anthropic.com.');
    if(e instanceof SDK.InternalServerError)throw new Error('Claude is very busy right now. Try again in a few minutes.');
    if(e instanceof SDK.APIError)throw new Error('Anthropic said: '+e.message);
    throw e;
  }
  const txt=msg.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  aiLastReply=`Claude (${msg.model})${web?' with web search':''} · stopped: ${msg.stop_reason}\n\n`+(txt||'(no text)');
  if(msg.stop_reason==='refusal')throw softErr('Claude declined this request.');
  const data=aiJSON(txt,web),found=[];
  for(const b of msg.content){
    if(b.type==='web_search_tool_result'&&Array.isArray(b.content))for(const r of b.content)if(r.url)found.push({uri:r.url,title:r.title||r.url});
    if(b.type==='text'&&Array.isArray(b.citations))for(const c of b.citations)if(c.url)found.push({uri:c.url,title:c.title||c.url});
  }
  // keep the pages it actually quoted ahead of every search hit
  return {data,sources:aiSources(data,found.reverse())};
}
// One request to Gemini. parts: the message; web: let it search Google and open pages/PDFs itself.
// Returns {data, sources}. Tries each model in turn, so a renamed or retired model doesn't break it.
// The last thing Google sent back (shown by "Show AI reply" when something goes wrong).
let aiLastReply='';
const softErr=(msg)=>Object.assign(new Error(msg),{soft:true});// worth retrying another way
async function gemini(parts,tools){
  const key=aiKey('gemini'),web=!!tools;
  // Free-tier web search is on the 2.5 Flash models only; plain reading works on any of them.
  const order=web?['gemini-2.5-flash','gemini-2.5-flash-lite']:[WF.store.get('geminiModel'),...AI_MODELS].filter((m,i,a)=>m&&a.indexOf(m)===i);
  const body={contents:[{parts}],generationConfig:{temperature:0.1}};
  if(web)body.tools=tools;// (JSON mode can't be combined with tools: the prompt asks for JSON instead)
  else body.generationConfig.response_mime_type='application/json';
  let skipped='',busy=0;
  for(const m of order){
    let r,j,msg;
    // A busy model (500/503) usually frees up within seconds: wait and ask once more, then try the next model.
    for(let attempt=0;attempt<2;attempt++){
      const _gSig=AbortSignal.timeout?AbortSignal.timeout(60000):(()=>{const ac=new AbortController();setTimeout(()=>ac.abort(),60000);return ac.signal;})();
      try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:_gSig});}
      catch(e){if(e&&e.name==='AbortError')throw new Error('Google\'s AI took too long to reply (over 60 s). Try again or switch provider.');throw new Error('Couldn\'t reach Google. Check the internet connection and try again.');}
      j=await r.json().catch(()=>({}));msg=(j.error&&j.error.message)||r.statusText||'';
      aiLastReply=`Model ${m} · HTTP ${r.status}\n`+JSON.stringify(j,null,1).slice(0,6000);
      if(r.status!==500&&r.status!==503)break;
      if(!attempt)await new Promise(res=>setTimeout(res,4000));
    }
    if(r.status===500||r.status===503){busy++;skipped=msg;continue;}
    if(r.status===404||(r.status===400&&/not (found|supported)|not enabled|unsupported|not available/i.test(msg))){skipped=msg;continue;}// model renamed, retired or without this tool: try the next
    if(r.status===429)throw new Error('The free AI limit has been reached for now. Wait a minute (or until tomorrow) and try again.');
    if(r.status===401||r.status===403||/API key/i.test(msg))throw new Error('Google didn\'t accept the AI key. Click "Change Gemini key…" and paste it again.');
    if(!r.ok)throw new Error('Google said: '+msg);
    if(!web)WF.store.set('geminiModel',m);
    const cand=j.candidates&&j.candidates[0],txt=((cand&&cand.content&&cand.content.parts)||[]).map(p=>p.text||'').join('');
    aiLastReply=`Model ${m}${web?' with web search':''} · finished: ${(cand&&cand.finishReason)||'?'}\n\n`+(txt||JSON.stringify(j,null,1).slice(0,6000));
    const data=aiJSON(txt,web);
    // where it looked: pages Google Search gave it, plus any links it names itself
    const g=(cand.groundingMetadata&&cand.groundingMetadata.groundingChunks)||[];
    return {data,sources:aiSources(data,g.filter(c=>c.web&&c.web.uri).map(c=>({uri:c.web.uri,title:c.web.title||'source'})))};
  }
  if(busy)throw (web?softErr:(m=>new Error(m)))('Google\'s free AI is too busy right now. Try again in a few minutes, or switch to NVIDIA or Claude.');
  throw web?softErr('Web search for the AI isn\'t available on this key ('+skipped+').'):new Error('None of Google\'s free Gemini models answered. They may have been renamed; an app update will fix this.');
}
// One request to NVIDIA's free AI (build.nvidia.com), passed on by the desktop app because NVIDIA doesn't accept
// calls straight from a web page. It can't search the web. pic: {b64,mime} to send a picture with the text.
// Tries each model in turn, so a renamed or retired model doesn't break it.
const NV_TEXT=['deepseek-ai/deepseek-v4.1-flash','moonshotai/kimi-k2.6','mistralai/mistral-large-4-1t-a52b','nvidia/llama-3.1-nemotron-70b-instruct'];
const NV_VISION=['meta/llama-3.2-90b-vision-instruct','meta/llama-3.2-11b-vision-instruct'];
// (1.9.38) Groq and OpenRouter speak the same OpenAI-style "chat completions" as NVIDIA, so all three share
// this code. Groq and OpenRouter accept calls straight from a web page; NVIDIA needs the desktop app.
// None of them can search the web or read PDFs. Model lists checked against each provider's model page (Nov 2026).
const OA={
  nvidia:{name:'NVIDIA',starts:'nvapi-',url:'https://integrate.api.nvidia.com/v1/chat/completions',text:NV_TEXT,vision:NV_VISION,deskOnly:true,limit:'about 40 requests a minute'},
  groq:{name:'Groq',starts:'gsk_',url:'https://api.groq.com/openai/v1/chat/completions',free:true,
    text:['openai/gpt-oss-120b','llama-3.3-70b-versatile','qwen/qwen3.8-27b','openai/gpt-oss-20b','llama-3.1-8b-instant'],
    vision:['qwen/qwen3.8-27b','meta-models/muse-spark-open'],limit:'about 30 requests a minute, 1,000 a day',testTokens:200},
  openrouter:{name:'OpenRouter',starts:'sk-or-',url:'https://openrouter.ai/api/v1/chat/completions',free:true,
    text:['openrouter/free','nvidia/nemotron-3-ultra-550b-a55b:free','google/gemma-4-31b-it:free'],
    vision:['openrouter/free','google/gemma-4-31b-it:free','nvidia/nemotron-3.5-super-vl:free'],limit:'about 50 requests a day',testTokens:200,
    headers:{'X-Title':'EvenUCan'}},
  // (1.9.41) a model on this computer, not the internet. No key: the "key" box holds the model's exact
  // name instead (e.g. "gemma:2b"), the same name "ollama list" shows. No picture-reading: most small
  // local models can't do it reliably, so vision is left empty on purpose.
  ollama:{name:'Ollama',url:'http://localhost:11434/v1/chat/completions',text:[],vision:[],local:true,limit:'whatever your computer can manage',testTokens:60},
  // Paid providers using the OpenAI-compatible chat completions API
  openai:{name:'ChatGPT / OpenAI',starts:'sk-',url:'https://api.openai.com/v1/chat/completions',
    text:['gpt-4.1','gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'],
    vision:['gpt-4.1','gpt-4o','gpt-4o-mini'],limit:'your plan\'s rate limit'},
  grok:{name:'Grok / xAI',starts:'xai-',url:'https://api.x.ai/v1/chat/completions',
    text:['grok-3-fast','grok-3','grok-2-latest','grok-beta'],
    vision:['grok-2-vision-latest','grok-beta'],limit:'your plan\'s rate limit'},
  deepseek:{name:'DeepSeek',starts:'sk-',url:'https://api.deepseek.com/v1/chat/completions',
    text:['deepseek-chat','deepseek-reasoner'],
    vision:[],limit:'your plan\'s rate limit'}
};
const isOA=p=>!!OA[p||aiProv()];
const oaOrder=(p,extra)=>[extra,WF.store.get(p+'Model'),...OA[p].text].filter((m,i,a)=>m&&a.indexOf(m)===i);
// One request. The desktop app passes it on (its allow-list has all three hosts); the web version fetches directly.
async function oaChat(p,key,model,content,maxTokens){
  const A=OA[p],post=window.wfNative&&window.wfNative.aiPost;
  // For Ollama (local): force stream:false (Ollama streams by default, which breaks JSON.parse);
  // also cap max_tokens at 2048 since small local models typically have a 2048-token context window.
  const mt=A.local?Math.min(maxTokens,1024):maxTokens;// small local models: cap at 1024 to halve generation time
  const body=JSON.stringify({model,messages:Array.isArray(content)&&content[0]&&content[0].role?content:[{role:'user',content}],temperature:0.1,max_tokens:mt,...(A.local?{stream:false}:{})});
  let status,raw;
  if(post){
    try{const r=await post(A.url,key,body);status=r.status;raw=r.text;}
    catch(e){throw new Error(A.local?'Couldn\'t reach Ollama on this computer. Make sure it\'s running (ollama serve, or just open the Ollama app) and that you pulled the model you typed.':'Couldn\'t reach '+A.name+'. Check the internet connection and try again.');}
  }else{
    if(A.deskOnly)throw new Error('NVIDIA\'s free AI only works in the EvenUCan desktop app (NVIDIA doesn\'t accept requests from web pages). In this web version, pick Google Gemini, Groq or OpenRouter (all free) or Claude instead.');
    const _oMs=A.local?300000:60000;// local models get 5 min; cloud APIs get 60 s
    const _oSig=AbortSignal.timeout?AbortSignal.timeout(_oMs):(()=>{const ac=new AbortController();setTimeout(()=>ac.abort(),_oMs);return ac.signal;})();
    const _t0=A.local?Date.now():0;
    try{const r=await fetch(A.url,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},A.local?{}:{Authorization:'Bearer '+key},A.headers||{}),body,signal:_oSig});status=r.status;raw=await r.text();}
    catch(e){console.error('EvenUCan: oaChat fetch failed',p,e);if(e&&(e.name==='AbortError'||e.name==='TimeoutError'))throw new Error((A.local?'Ollama':'The AI ('+A.name+')')+' took too long to reply (over '+(A.local?'5 min':'60 s')+'). '+(A.local?'The model may be too large for your computer. Try a smaller one, e.g. qwen2.5:3b or gemma2:2b (run: ollama pull qwen2.5:3b).':'Try again or switch to another provider.'));throw new Error(A.local?'Couldn\'t reach Ollama on this computer. If it\'s running, the browser may be blocking it. Try opening EvenUCan from http://localhost:8080 instead of file://. Error: '+(e&&e.message||e):'Couldn\'t reach '+A.name+'. Check the internet connection and try again.');}
    if(A.local&&status===200){// record response time for this model
      try{const secs=Math.round((Date.now()-_t0)/1000);const all=JSON.parse(WF.store.get('ollamaTimings')||'{}');const arr=(all[model]||[]).slice(-9);arr.push(secs);all[model]=arr;WF.store.set('ollamaTimings',JSON.stringify(all));}catch(e){/* non-critical */}
    }
  }
  let j={};try{j=JSON.parse(raw);}catch(e){/* intentional: handled below as an empty answer */}
  return {status,j,msg:String(j.detail||j.title||(j.error&&(j.error.message||j.error))||'')};
}
const nvChat=(key,model,content,maxTokens)=>oaChat('nvidia',key,model,content,maxTokens);
const oaSkip=(status,msg)=>status===404||status===410||(status===400&&/model|not found|not supported|unknown|decommission|no endpoints|image/i.test(msg));
async function oaAI(p,text,pic){
  const A=OA[p],key=aiKey(p);
  if(pic&&!A.vision.length)throw new Error(A.name+' can\'t read pictures. Switch to Gemini or Claude to read a drawing.');
  const order=pic?A.vision:oaOrder(p);
  let busy=0,skipped='';
  for(const m of order){
    const content=pic?[{type:'text',text},{type:'image_url',image_url:{url:'data:'+pic.mime+';base64,'+pic.b64}}]:text;
    const {status,j,msg}=await oaChat(p,key,m,content,8192);
    aiLastReply=`${A.name} model ${m} · HTTP ${status}\n`+JSON.stringify(j,null,1).slice(0,6000);
    if(status===401||status===403)throw new Error(A.name+' didn\'t accept the key. Click "Change '+A.name+' key…" and paste it again.');
    if(status===429||status>=500){busy++;skipped=msg;continue;}// busy or over the free limit: try the next model
    if(oaSkip(status,msg)){skipped=msg;continue;}
    if(status!==200)throw new Error(A.name+' said: '+(msg||'HTTP '+status));
    if(!pic)WF.store.set(p+'Model',m);
    const c=j.choices&&j.choices[0],txt=String((c&&c.message&&c.message.content)||'');
    aiLastReply=`${A.name} model ${m} · finished: ${(c&&c.finish_reason)||'?'}\n\n`+(txt||JSON.stringify(j,null,1).slice(0,6000));
    return {data:aiJSON(txt.replace(/<think>[\s\S]*?<\/think>/g,''),false),sources:[]};// (some models think out loud first)
  }
  if(busy)throw new Error(A.name+'\'s free AI is busy right now, or the free limit ('+A.limit+') was reached. Wait a minute (or until tomorrow for a daily limit), or switch to another AI.');
  if(pic)throw new Error(A.name+'\'s free picture-reading models didn\'t answer'+(skipped?' ('+skipped+')':'')+'. Switch to Gemini or Claude to read a drawing.');
  throw new Error('None of '+A.name+'\'s free models answered'+(skipped?' ('+skipped+')':'')+'. They may have been renamed; an app update will fix this.');
}
const nvidia=(text,pic)=>oaAI('nvidia',text,pic);
// NVIDIA takes pictures up to about 180 KB inside a request: shrink until it fits (drawings stay readable at ~1200 px).
async function nvSmall(b64,mime){
  if(b64.length<175000)return {b64,mime};
  const im=await loadImg('data:'+mime+';base64,'+b64);
  for(const px of [1600,1300,1100,900,700]){
    const k=Math.min(1,px/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
    c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
    const s=c.toDataURL('image/jpeg',0.8).split(',')[1];if(s.length<175000)return {b64:s,mime:'image/jpeg'};
  }
  throw new Error('That picture is too detailed for this AI. Crop it to just the drawing, or switch to Gemini or Claude.');
}
// Turn the AI's answer into the part being edited (a draft: nothing is saved until you click Save part).
function applyDrawing(d,src,sources){
  const n=(v,def)=>{const x=num(v,NaN);return isFinite(x)&&x>=0?Math.round(x*100)/100:def;};
  if(d.name&&(!ed.name||ed.name==='New part'))ed.name=String(d.name).slice(0,80);
  if(TYPES[d.type])ed.type=d.type;
  ed.shape=d.shape==='round'?'round':'rect';
  ed.w=n(d.w,ed.w)||ed.w;ed.d=ed.shape==='round'?ed.w:(n(d.d,ed.d)||ed.d);
  ed.pcb=n(d.pcb,ed.pcb);ed.h=n(d.h,ed.h);ed.below=n(d.below,ed.below);
  ed.mount=d.mount==='wall'||d.mount==='floor'||d.mount==='outside'?d.mount:TYPES[ed.type].mount;
  const F=[];
  for(const f of Array.isArray(d.features)?d.features:[]){
    if(!f||!FEAT[f.t])continue;
    const o=Object.assign({t:f.t},clone(FEAT[f.t].def));
    for(const k of FFIELDS[f.t]){
      if(k==='side'){if(['xmin','xmax','ymin','ymax'].includes(f.side))o.side=f.side;}
      else if(k==='dir'){if(f.dir==='up'||f.dir==='down')o.dir=f.dir;}
      else if(k==='kind'){if(PORT_KINDS[f.kind]!==undefined){o.kind=f.kind;if(PORT_KINDS[f.kind])[o.pw,o.ph]=PORT_KINDS[f.kind];}}
      else if(f[k]!==undefined)o[k]=n(f[k],o[k]);
    }
    F.push(o);
  }
  ed.features=F;
  // Individual pins (for Wiring), same read as the mechanical features above - a pinout drawing names
  // and places every pin, so there's no reason the AI assist shouldn't fill those in too, not just the
  // header's outline. Replaced wholesale like features: only kept if the AI actually found some.
  if(Array.isArray(d.pins)&&d.pins.length){
    const roles=new Set(['gnd','3v3','5v','vcc','vin','sda','scl','gpio','sig','trig','echo','ao','do','nc']);
    ed.pins=d.pins.filter(p=>p&&typeof p==='object').slice(0,64)
      .map(p=>{
        const nm=String(p.name||p.n||'?').slice(0,16),r=roles.has(p.role)?p.role:'sig',q={n:nm,r,x:n(p.x,0),y:n(p.y,0)};
        if(r==='gpio'){const m=nm.match(/(\d+)/);if(m)q.g=+m[1];}// Wiring/ESPHome need the actual GPIO number, same as a manually-set gpio role
        return q;
      });
  }
  tidyPart(ed);
  ed.acc=refDraw?'drawing':'approx';// read from a dimension drawing, or from the web or the AI's memory
  const unsure=(Array.isArray(d.uncertain)?d.uncertain:[]).map(String).filter(Boolean).slice(0,8);
  sources=sources||[];
  const stamp='Sizes read by AI from '+src+' on '+new Date().toLocaleDateString()+'. Check them before printing.'+(sources.length?'\nSources: '+sources.map(s=>s.uri).join(' '):'');
  ed.notes=((d.notes?String(d.notes).slice(0,300)+'\n':'')+stamp+(ed.notes?'\n'+ed.notes:'')).slice(0,2000);
  aiNote=(refDraw?'<b>Draft from the drawing:</b> check the sizes and positions against it (top right) before saving.':/own knowledge/.test(src)?'<b>Draft from the AI\'s memory</b> (nothing was found on the web): measure the part and check every size before saving.':'<b>Draft found online:</b> check the sizes against the sources (and your calipers) before saving.')
    +(unsure.length?' <b>Not sure about:</b> '+unsure.map(esc).join('; ')+'.':'')
    +(sources.length?' <b>Sources:</b> '+sources.map(s=>`<a href="${esc(s.uri)}" data-ext="1">${esc(s.title)}</a>`).join(', '):'');
  // edPin (the selected row in the pin list) isn't reset elsewhere the way edSel is - re-reading a drawing
  // on a part with a pin already selected left edPin pointing at an index in the OLD pins array, which the
  // new, differently-sized one may not even have: a real crash on a re-read, not just a stale selection.
  edDirty=true;edSel=-1;edPin=-1;edMode='select';renderEditor();
}
// Have the chosen AI read a drawing (picture or PDF, base64) into part data.
async function aiRead(b64,mime,hint){
  const ask=AI_PROMPT+'\n\n'+hint;
  if(isOA()){
    const nm=OA[aiProv()].name;
    if(mime==='application/pdf')throw new Error(nm+' can\'t read PDFs. Use a picture of the drawing (a screenshot works), or switch to Gemini or Claude.');
    return (await oaAI(aiProv(),ask,await nvSmall(b64,mime))).data;
  }
  const {data}=aiProv()==='claude'
    ?await claude([mime==='application/pdf'?{type:'document',source:{type:'base64',media_type:mime,data:b64}}:{type:'image',source:{type:'base64',media_type:mime,data:b64}},{type:'text',text:ask}],false)
    :await gemini([{inline_data:{mime_type:mime,data:b64}},{text:ask}],false);
  return data;
}
async function readDrawing(file){
  if(aiBusy)return;
  if(!file)return;
  const pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!pdf&&!/^image\//.test(file.type))return WF.flash('Use a picture (PNG, JPG…) or a PDF of the drawing');
  if(file.size>18e6)return WF.flash('That file is too big (over 18 MB). Use a smaller picture or just the page with the drawing.');
  if(!aiKey()){await askKey();if(!aiKey())return;}
  if(ed.features.length&&!(await askConfirm('Replace the sizes, features and pins of "'+ed.name+'" with what the AI reads from the drawing?\n\n(Nothing is saved until you click Save part.)')))return;
  clearRef();refDraw={name:file.name||'pasted picture',url:pdf?null:URL.createObjectURL(file),big:false};
  aiBusy='Reading the drawing… this usually takes 10–40 seconds.';renderEditor();
  try{
    const {b64,mime}=pdf?{b64:await fileB64(file),mime:'application/pdf'}:await shrinkImage(file);
    const hint='The user says this part is: "'+(ed.name&&ed.name!=='New part'?ed.name:'unknown')+'", type: '+TYPES[ed.type].name+'.';
    const d=await aiRead(b64,mime,hint);
    aiBusy=false;applyDrawing(d,'"'+refDraw.name+'"');
    WF.flash('Draft filled in from the drawing. Check it, then Save part.',6000);
    // A real photo (not a PDF) can become the part's own picture too, using the same corner-click lineup as
    // "Top photo..." - straight on from here, so it isn't a second upload of the same file.
    if(!pdf){
      rawImg=await loadImg(refDraw.url);clicks=[];edMode='corners';renderEditor();
      const go=await askHtml('<div class="kHead"><b>Use this picture as the part\'s photo too?</b></div><p style="margin:0">It isn\'t used yet - click the '+(ed.shape==='round'?'3 points around the edge of the round board':'4 corners of the board, in this order: top-left, top-right, bottom-right, bottom-left')+'. That lines the photo up with the sizes just read in.</p>',['Skip','Line it up'],1);
      if(go!==1){rawImg=null;edMode='select';renderEditor();}
    }
  }catch(e){aiBusy=false;aiFail(e);}
}
// Fully automatic: the AI searches the web for the part, opens its datasheet or product page, and fills a draft.
async function lookupOnline(){
  if(aiBusy)return;
  let q=ed.name&&ed.name!=='New part'?ed.name:'';
  q=await WF.askText('Look up which part online? Type the exact part number or name (e.g. "MAX98357A breakout" or "ESP32-S3-DevKitC-1").',q);
  if(!q||!q.trim())return;q=q.trim();
  if(!aiKey()){await askKey();if(!aiKey())return;}
  if(ed.features.length&&!(await askConfirm('Replace the sizes, features and pins of "'+ed.name+'" with what the AI finds online?\n\n(Nothing is saved until you click Save part.)')))return;
  clearRef();aiBusy='Searching the web for "'+q+'" and reading what it finds… this can take up to a minute.';renderEditor();
  try{
    const ask=`Search the web for the mechanical dimensions of this part: "${q}". Start with searches worded like "${q} technical documentation schematic sizes", "${q} dimensions drawing mm" and "${q} datasheet mechanical" - these lead to the maker's documentation, which usually has a dimension drawing. Prefer the manufacturer's own documentation, product page, datasheet (open PDFs) or official dimension drawing, then well-known sellers' technical pages. Use the version of the board that matches the part name; if several versions exist, say which you used in "notes" and list the difference in "uncertain".
Then answer using the format below. Also add "sources": [the https links of the pages you actually took sizes from], and "images": [up to 4 direct links to photo files (.jpg, .jpeg, .png or .webp addresses you saw on those pages, not web pages) showing this exact board from straight above, component side up, best first; leave it empty if you saw none - never make a link up]. If you can't find real sizes, return {"error":"not found"}.

`+AI_PROMPT;
    // Three tries, each simpler than the last: search + open pages, search only, then the AI's own knowledge
    // (well-known boards such as the Arduino Nano are described in countless places it learned from).
    // (NVIDIA, Groq and OpenRouter can't search the web, so they go straight to what they already know)
    const useClaude=aiProv()==='claude',useNv=isOA(),known={tools:null,how:'the AI\'s own knowledge of "'+q+'" (no web pages)',busy:'Asking the AI what it already knows about "'+q+'"…',known:true};
    const tries=useNv?[known]:useClaude
      ?[{web:true,how:'a web search by Claude for "'+q+'"',busy:'Claude is searching the web for "'+q+'" and reading the datasheets… this can take a minute or two.'},known]
      :[{tools:[{google_search:{}},{url_context:{}}],how:'a web search for "'+q+'"',busy:'Searching the web for "'+q+'" and reading what it finds… this can take up to a minute.'},
        {tools:[{google_search:{}}],how:'a web search for "'+q+'"',busy:'Searching the web again (a simpler way)…'},known];
    let got=null,why=[];
    for(const t of tries){
      aiBusy=t.busy;setHint();
      const text=t.known?`From your own knowledge (no web search), give the mechanical dimensions of this part: "${q}". Only answer if you know this part well; otherwise return {"error":"not found"}. Put every value you are not sure of in "uncertain".\n\n`+AI_PROMPT:ask;
      try{
        const r=useClaude?await claude([{type:'text',text}],!!t.web):useNv?await oaAI(aiProv(),text):await gemini([{text}],t.tools);
        if(r.data.error||!(num(r.data.w,0)>0)){why.push('no sizes found');continue;}
        got={...r,how:t.how,known:t.known};break;
      }catch(e){if(!e.soft)throw e;why.push(e.message);}
    }
    if(!got)throw softErr('The AI couldn\'t find sizes for "'+q+'". Try the exact part number, or save a dimension drawing and use "Read a drawing…".');
    const d=got.data;if(!d.name)d.name=q;
    if(got.known){d.uncertain=['every size: these come from the AI\'s memory, not a web page',...(Array.isArray(d.uncertain)?d.uncertain:[])];}
    aiBusy=false;applyDrawing(d,got.how,got.sources);
    const lookupNote=aiNote;
    let extra='';
    try{extra=await findMedia(got.known?[]:d.images,got.known?[]:got.sources);}catch(e){extra=' (Reading a drawing it found failed: '+esc(e.message||String(e))+')';}
    aiBusy=false;
    if(extra){aiNote=(/Exact positions/.test(extra)?aiNote.replace(/^<b>Draft[^<]*<\/b>[^.]*\./,'<b>Draft found online, with exact positions from a drawing:</b>'):lookupNote)+extra;}
    renderEditor();
    WF.flash(got.known?(useNv?'Draft filled in from what '+OA[aiProv()].name+'\'s AI knows (it can\'t search the web). Check every size before saving.':'Draft filled in from the AI\'s own knowledge (the web search found nothing). Check every size before saving.'):/Exact positions/.test(extra)?'Draft filled in from the web, with positions read from a dimension drawing. Check it, then Save part.':'Draft filled in from the web. Check it against the sources, then Save part.',8000);
  }catch(e){aiBusy=false;aiFail(e);}
}
// Something went wrong: say what, and offer to show exactly what Google sent back. A plain JS error (as
// opposed to one of this app's own, already-written-for-a-person Error/softErr messages) means a bug, not
// something the user did - never shown as its raw technical message, but kept (full message and stack) for
// "Show error details" to display from right inside the app: the desktop build has no DevTools/console to
// point someone at (it runs without the menu that provides the usual F12), so that has to be self-contained.
let aiBugDetail='';
function aiFail(e){
  console.error('EvenUCan: AI assist failed',e);
  const bug=e instanceof TypeError||e instanceof ReferenceError||e instanceof RangeError;
  aiBugDetail=bug?(e.stack||e.message||String(e)):'';
  const msg=bug?'Something went wrong reading that - try again, or try a clearer drawing. (This looks like a bug in EvenUCan, not something you did - click "Show error details" below to see it, and take a screenshot to report it.)':(e.message||String(e));
  WF.flash(msg,9000);
  aiNote='<b>Couldn\'t fill in the part:</b> '+esc(msg)+(bug?'<button id="plAiBug">Show error details</button>':'')+(aiLastReply?'<button id="plAiReply">Show AI reply</button>':'');
  renderEditor();// buttons back to normal, message in the yellow bar
}
$('plDrawIn').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';readDrawing(f);});
$('plEdit').addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault();});
$('plEdit').addEventListener('drop',e=>{const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f)return;e.preventDefault();
  if(/\.fzpz?$/i.test(f.name)){const dt=new DataTransfer();for(const x of e.dataTransfer.files)dt.items.add(x);const inp=$('plFzIn');inp.files=dt.files;inp.dispatchEvent(new Event('change'));return;}// a part file: import its pins, size and picture
  readDrawing(f);});
// Drop .fzpz files onto the parts list (left panel) → bulk import all at once
$('plList').addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault();});
$('plList').addEventListener('drop',e=>{
  const files=[...( e.dataTransfer&&e.dataTransfer.files||[])].filter(f=>/\.fzpz$/i.test(f.name));
  if(!files.length){e.preventDefault();return;}e.preventDefault();
  if(files.length===1){const dt=new DataTransfer();dt.items.add(files[0]);const inp=$('plFzIn');inp.files=dt.files;inp.dispatchEvent(new Event('change'));return;}
  bulkImportFzpz(files);
});
// Prevent browser from opening dropped files as tabs — catch everything the element handlers miss
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{
  if(!e.dataTransfer||!e.dataTransfer.files.length)return;
  e.preventDefault();// stop browser opening files as new tabs
  const fzpz=[...e.dataTransfer.files].filter(f=>/\.fzpz$/i.test(f.name));
  if(fzpz.length)bulkImportFzpz(fzpz);
});
document.addEventListener('paste',e=>{
  if(plBack.style.display!=='grid'||!ed)return;
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;
  const f=[...(e.clipboardData?e.clipboardData.files:[])].find(x=>/^image\/|pdf/.test(x.type));
  if(f){e.preventDefault();readDrawing(f);}
});

