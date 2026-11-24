// EvenUCan Enclosure Wizard - 14-wiring-window.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- the wiring window
// (1.9.37) The picture is made to be read: only the pins in use get a label, outside the board with a
// leader line, placed so no two labels overlap; wires coloured by job (red power, black ground, a colour
// of their own for each signal) with a key; zoom (wheel or pinch), drag the background to move about,
// Fit; click a wire, a part or a wiring-list row to see just that one, or go one wire at a time.
let wr=null;// {plan, pos:{key:[x,y]}, view, userView, focus, step, hi, tab, done, labelRects, partRects, hit}
const WIRE_COLOURS={gnd:'#111111','3v3':'#e53935','5v':'#b00020',vbat:'#d00000',spk:'#7a4f2a'};
const SIG_COLOURS=['#1f6fd6','#f2a900','#8e44ad','#16a085','#00acc1','#7cb342','#3949ab','#ff7f0e','#6d4c41','#ec407a'];
const WIRE_KEY={'3v3':'Power 3.3 V','5v':'Power 5 V (dashed)',vbat:'Battery +',gnd:'Ground',spk:'Speaker'};
const WR_FONT='"Segoe UI",system-ui,sans-serif',WR_MIN_S=3;// at least 3 pixels a millimetre, so small boards stay readable
document.body.insertAdjacentHTML('beforeend',`<div id="wrBack" class="ewBack"><div class="ewWin">
  <div class="ewHead"><h2>Wiring</h2><span class="ewNote">What wire goes where. Click a wire, a part or a line of the wiring list to see just that one. Scroll to zoom, drag the background to move about, drag a board to tidy it.</span>
    <button id="wrRedo" title="Work the wiring out again">Work it out again</button><button id="wrX" class="x" title="Close (Esc)" style="font-size:18px">✕</button></div>
  <div class="ewBody" style="grid-template-columns:minmax(0,1fr) 400px">
    <div class="ewMain"><div class="ewCanvasWrap"><canvas id="wrCanvas" tabindex="0"></canvas>
      <div id="wrTools"><button id="wrFit" title="Show the whole picture">Fit</button><button id="wrZin" title="Zoom in (or scroll the mouse wheel)">+</button><button id="wrZout" title="Zoom out">−</button><button id="wrStep" title="Show the wires one by one, in the same order as the wiring list">One wire at a time</button><span id="wrStepBox"><button id="wrPrev" title="The wire before (← key)">◀ Back</button><span id="wrStepN"></span><button id="wrNext" title="The next wire (→ key)">Next ▶</button></span><button id="wrShowAll" class="primary" title="Show every wire and label again">Show all</button></div>
    </div></div>
    <div class="ewSide" id="wrSide" style="border-right:none;border-left:1px solid var(--line)"></div>
  </div>
  <div class="ewFoot"><span class="ewNote" style="flex:1">Check every connection against the boards' own labels before you power up.</span>
    <button id="wrBuildGuide" style="margin-right:auto" title="Generate and open an interactive, printable Step-by-Step Build Guide with multimeter checkpoints">📋 Step-by-Step Build Guide</button><button id="wrPng" title="Save the whole wiring picture, with every label, as a PNG file">Save picture</button><button id="wrTxt">Save wiring list</button><button id="wrClose">Close</button></div>
</div></div>`);
const wrBack=$('wrBack');
const openWiring=function openWiring(){
  ewBack.style.display='none';plBack.style.display='none';wrBack.style.display='grid';
  const plan=planWiring();
  wr={plan,pos:{},hi:-1,focus:null,step:-1,userView:null,done:{},tab:(wr&&wr.tab)||'list',chat:(wr&&wr.chat)||{msgs:[],busy:false}};
  if(!plan.error){placeModules();linkNets();}
  renderWiringSide();drawWiring();$('wrCanvas').focus();drawGuide();
};
const closeWiring=function closeWiring(){wrBack.style.display='none';drawGuide();};
// Controller in the middle with the parts spread round it: above it, then below it, then to the right;
// power parts (battery, charger, switch) on the left.
const placeModules=function placeModules(){
  const {insts,ctrl,nets}=wr.plan,pos=wr.pos,G=26,R=38,cw=ctrl.part.w,cd=ctrl.part.d;
  pos[ctrl.key]=[0,0];
  const power=new Set(insts.filter(i=>pinsOf(i.part).some(p=>/^(bat|chg_|sw_)/.test(p.r))).map(i=>i.key));
  const rows={top:[],bottom:[],right:[],left:[]},others=[];
  for(const i of insts){
    if(i===ctrl)continue;
    if(power.has(i.key)){rows.left.push(i);continue;}
    const cps=nets.filter(n=>n.pins.some(p=>p.inst===i)).flatMap(n=>n.pins.filter(p=>p.inst===ctrl&&p.pin.x!==undefined).map(p=>p.pin));
    i._ax=cps.length?cps.reduce((s,p)=>s+p.x,0)/cps.length:cw/2;
    i._side=cps.length?(cps.reduce((s,p)=>s+p.y,0)/cps.length>cd/2?'top':'bottom'):'top';
    others.push(i);
  }
  // a speaker sits by its amplifier
  for(const i of others){const amp=nets.find(n=>n.kind==='spk'&&n.pins.some(p=>p.inst===i));if(amp){const o=amp.pins.find(p=>p.inst!==i).inst;if(o&&o._ax!==undefined&&!nets.some(n=>n.kind!=='spk'&&n.pins.some(p=>p.inst===i)&&n.pins.some(p=>p.inst===ctrl))){i._ax=o._ax+1;i._side=o._side;}}}
  others.sort((a,b)=>a._ax-b._ax);
  const used=list=>list.reduce((s,i)=>s+i.part.w,0)+G*list.length,room=cw+40;
  for(const i of others){
    const want=i._side,other=want==='top'?'bottom':'top';
    if(used(rows[want])+i.part.w<=room)rows[want].push(i);
    else if(rows.right.length<2)rows.right.push(i);
    else if(used(rows[other])+i.part.w<=room)rows[other].push(i);
    else if(rows.right.length<=rows.left.length)rows.right.push(i);else rows.left.push(i);
  }
  const row=(list,below)=>{let x=cw/2-(used(list)-G)/2;for(const i of list){pos[i.key]=[x,below?cd+R:-R-i.part.d];x+=i.part.w+G;}};
  const col=(list,right)=>{let y=cd/2-(list.reduce((s,i)=>s+i.part.d,0)+G*(list.length-1))/2;for(const i of list){pos[i.key]=[right?cw+R:-R-i.part.w,y];y+=i.part.d+G;}};
  row(rows.top,false);row(rows.bottom,true);col(rows.right,true);col(rows.left,false);
};
// pin position in the picture (mm, y down)
const pinXY=function pinXY(i,p){
  const [mx,my]=wr.pos[i.key]||[0,0],w=i.part.w,d=i.part.d;
  if(p.x===undefined){const k=i.pins.indexOf(p),n=i.pins.length;return [mx+w*(k+1)/(n+1),my+d];}
  return [mx+p.x,my+(d-p.y)];
};
// red for power, black for ground, and each signal wire a colour of its own
const netColour=function netColour(n,k){
  if(WIRE_COLOURS[n.kind])return WIRE_COLOURS[n.kind];
  const nets=wr&&wr.plan&&wr.plan.nets||[];let j=0;for(let q=0;q<k&&q<nets.length;q++)if(!WIRE_COLOURS[nets[q].kind])j++;
  return SIG_COLOURS[j%SIG_COLOURS.length];
};
// Which pins each wire joins: every pin to its nearest pin already on that connection (a short chain,
// like a real ground bus), instead of one long wire per pin back to the first.
const linkNets=function linkNets(){
  for(const n of wr.plan.nets){
    const pts=n.pins.map(p=>pinXY(p.inst,p.pin)),inT=[0],rest=new Set(pts.map((_,i)=>i).slice(1));n.links=[];
    while(rest.size){
      let best=null;
      for(const a of inT)for(const b of rest){const d=Math.hypot(pts[a][0]-pts[b][0],pts[a][1]-pts[b][1]);if(!best||d<best[2])best=[a,b,d];}
      n.links.push([best[0],best[1]]);inT.push(best[1]);rest.delete(best[1]);
    }
  }
};
// every wire in wiring-list order (the "one wire at a time" order)
const wrLinks=function wrLinks(){return wr.plan.nets.flatMap((n,k)=>n.links.map(([ia,ib],j)=>({k,j,n,a:n.pins[ia],b:n.pins[ib]})));};
const wrPinId=p=>p.inst.key+'|'+p.pin.n+'|'+p.pin.h;
// a short name for a part: its model number (SSD1306, MPU6050...) plus what it is, e.g. "SSD1306 OLED"
const wrShort=function wrShort(i){
  const l=i.label.replace(/\s*\(.*$/,''),w=l.split(/\s+/),num=(i.label.match(/#\d+$/)||[''])[0];
  const model=w.find(x=>/[A-Za-z]/.test(x)&&/\d/.test(x)&&!/^\d/.test(x)&&!/^#/.test(x)),kind=(l.match(/\b(OLED|LCD|TFT|buzzer|relay|PIR|servo|speaker|microphone|button|LED)\b/i)||[])[0];
  return ((model?model+(kind&&kind!==model?' '+kind:''):w.slice(0,2).join(' '))+(num?' '+num:'')).slice(0,30);
};
const wrLinkText=function wrLinkText(a,b){
  const ctrl=wr.plan.ctrl;if(b.inst===ctrl&&a.inst!==ctrl)[a,b]=[b,a];
  return (a.inst===ctrl?a.pin.n:a.pin.n+' ('+wrShort(a.inst)+')')+' → '+b.pin.n+' ('+wrShort(b.inst)+')';
};
// what is in focus: the wires, pins and parts to show, and the big label
const wrFocusSets=function wrFocusSets(){
  const f=wr.focus;if(!f)return null;
  const L=wrLinks(),pick=f.type==='link'?L.filter(l=>l.k===f.k&&l.j===f.j):f.type==='net'?L.filter(l=>l.k===f.k):L.filter(l=>l.a.inst.key===f.key||l.b.inst.key===f.key);
  const S={links:new Set(pick.map(l=>l.k+'-'+l.j)),pins:new Set(),insts:new Set(f.type==='inst'?[f.key]:[]),big:'',sub:'',col:'#333'};
  for(const l of pick){S.pins.add(wrPinId(l.a));S.pins.add(wrPinId(l.b));S.insts.add(l.a.inst.key);S.insts.add(l.b.inst.key);}
  if(f.type==='link'&&pick[0]){const l=pick[0];S.big=wrLinkText(l.a,l.b);S.col=netColour(l.n,l.k);S.sub=l.n.name+(wr.step>=0?' · wire '+(wr.step+1)+' of '+L.length:'');}
  else if(f.type==='net'){const n=wr.plan.nets[f.k];S.big=n.name;S.col=netColour(n,f.k);S.sub=pick.length+(pick.length===1?' wire':' wires');}
  else{const i=wr.plan.insts.find(i=>i.key===f.key);S.big=i?i.label:'';S.sub=pick.length+(pick.length===1?' wire goes':' wires go')+' to this part';}
  return S;
};
// the view that shows everything (pixels per mm and offset), leaving room round the edge for labels
const wrFitView=function wrFitView(cw,ch){
  const {insts}=wr.plan,M={l:56,r:56,t:92,b:86};
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const i of insts){if(!wr.pos[i.key])continue;const [x,y]=wr.pos[i.key];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+i.part.w);y1=Math.max(y1,y+i.part.d);}
  let s=Math.min((cw-M.l-M.r)/(x1-x0),(ch-M.t-M.b)/(y1-y0));
  if(!(s>0))s=WR_MIN_S;
  if(s<WR_MIN_S){// too small to read: keep it readable, centred on the controller (zoom out or Fit... drag to move about)
    s=WR_MIN_S;const c=wr.plan.ctrl,p=wr.pos[c.key]||[0,0];
    return {s,ox:cw/2-(p[0]+c.part.w/2)*s,oy:ch/2-(p[1]+c.part.d/2)*s,fit:true};
  }
  return {s,ox:M.l+(cw-M.l-M.r-(x1-x0)*s)/2-x0*s,oy:M.t+(ch-M.t-M.b-(y1-y0)*s)/2-y0*s,fit:true};
};
const drawWiring=function drawWiring(){
  const cv=$('wrCanvas'),wrap=cv.parentElement,dpr=window.devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;if(!cw||!ch)return;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  wrToolsShow();
  if(!wr||wr.plan.error){c.clearRect(0,0,cw,ch);c.fillStyle='#fbfcfe';c.fillRect(0,0,cw,ch);c.font='13px '+WR_FONT;c.fillStyle='#777';c.textAlign='center';c.fillText(wr?wr.plan.error:'',cw/2,ch/2);return;}
  wr.view=wr.userView||wrFitView(cw,ch);
  const r=renderWiring(c,cw,ch,wr.view,wrFocusSets(),false);
  Object.assign(wr,r);
};
// Draws the whole picture on c; returns where the labels, parts and wires ended up (for clicks and tests).
const renderWiring=function renderWiring(c,cw,ch,view,F,exporting){
  const {insts,nets,ctrl}=wr.plan,s=view.s,X=x=>view.ox+x*s,Y=y=>view.oy+y*s;
  c.clearRect(0,0,cw,ch);c.fillStyle=exporting?'#ffffff':'#fbfcfe';c.fillRect(0,0,cw,ch);
  const partRects=[],hit=[],labelRects=[],obst=[];
  const hitR=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
  const fitText=(t,max)=>{if(c.measureText(t).width<=max)return t;while(t.length>3&&c.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…';};
  for(const i of insts){if(!wr.pos[i.key])continue;const [mx,my]=wr.pos[i.key];partRects.push({x:X(mx),y:Y(my),w:i.part.w*s,h:i.part.d*s,key:i.key});}
  for(const q of partRects)obst.push({x:q.x-3,y:q.y-3,w:q.w+6,h:q.h+6});
  if(!exporting){const tb=$('wrTools');obst.push({x:0,y:0,w:tb.offsetWidth+14,h:tb.offsetHeight+12});obst.push({x:0,y:ch-40,w:Math.min(cw,420),h:40});}
  // boards and their names
  c.font='bold 13px '+WR_FONT;
  const names=[];
  for(const i of insts){
    if(!wr.pos[i.key])continue;const [mx,my]=wr.pos[i.key],p=i.part,col=typeOf(p).color,on=!F||F.insts.has(i.key);
    c.save();c.globalAlpha=on?1:0.22;c.beginPath();c.rect(X(mx),Y(my),p.w*s,p.d*s);
    const im=imgOf(p.photo,drawWiring);
    if(im){c.save();c.clip();c.drawImage(im,X(mx),Y(my),p.w*s,p.d*s);c.restore();c.fillStyle='#ffffff55';c.fill();}
    else{c.fillStyle=col+'2a';c.fill();}
    c.lineWidth=F&&F.insts.has(i.key)?3:2;c.strokeStyle=col;c.stroke();
    const t=fitText(i===ctrl?i.label:i.label.replace(/\s*\(.*$/,''),i===ctrl?p.w*s-8:Math.max(60,Math.min(Math.max(p.w*s+18*s,120),cw-X(mx)-6))),tw=c.measureText(t).width;
    // the name goes on the side away from the pins in use (inside the controller, which is big enough)
    const up=nets.flatMap(n=>n.pins.filter(q=>q.inst===i)).map(q=>pinXY(i,q.pin)[1]-my),pinsTop=up.length&&up.reduce((a,b)=>a+b,0)/up.length<p.d/2;
    let nr=i===ctrl&&p.d*s>40?{x:X(mx)+(p.w*s-tw)/2,y:Y(my)+(p.d*s-17)/2,w:tw,h:17}:pinsTop?{x:X(mx),y:Y(my+p.d)+4,w:tw,h:17}:{x:X(mx),y:Y(my)-21,w:tw,h:17};
    if(i!==ctrl&&(names.some(o=>hitR(o,nr))||nr.y<2))nr=pinsTop?{x:X(mx),y:Y(my)-21,w:tw,h:17}:{x:X(mx),y:Y(my+p.d)+4,w:tw,h:17};
    names.push(nr);obst.push(nr);
    c.fillStyle='#111';c.textAlign='left';c.textBaseline='alphabetic';c.fillText(t,nr.x,nr.y+13);
    c.restore();
    // pins: a small dot each (the used ones get a ring further down)
    c.save();c.globalAlpha=on?1:0.22;
    for(const pin of i.pins){if(pin.r==='nc'&&i!==ctrl)continue;const [px,py]=pinXY(i,pin);c.beginPath();c.arc(X(px),Y(py),Math.max(1.6,Math.min(3,s*0.5)),0,Math.PI*2);c.fillStyle='#b9a24a';c.fill();}
    c.restore();
  }
  // zero-connection overlay: parts that are positioned but have no wires at all
  {const inNets=new Set(nets.flatMap(n=>n.pins.map(p=>p.inst.key)));
  for(const i of insts){
    if(i===ctrl||!wr.pos[i.key])continue;
    if(inNets.has(i.key))continue;
    // this part has pins but landed on zero nets (usually: no free GPIO left)
    const [mx,my]=wr.pos[i.key],p=i.part,on=!F||F.insts.has(i.key);
    c.save();c.globalAlpha=on?0.85:0.2;
    // hatched warning fill
    c.beginPath();c.rect(X(mx),Y(my),p.w*s,p.d*s);c.clip();
    c.strokeStyle='#f97316';c.lineWidth=2;
    for(let d=-(p.d*s+p.w*s);d<p.w*s+p.d*s;d+=10){
      c.beginPath();c.moveTo(X(mx)+d,Y(my));c.lineTo(X(mx)+d+p.d*s,Y(my)+p.d*s);c.stroke();
    }
    c.restore();
    c.save();c.globalAlpha=on?1:0.3;
    // orange border
    c.beginPath();c.rect(X(mx),Y(my),p.w*s,p.d*s);c.strokeStyle='#f97316';c.lineWidth=2.5;c.stroke();
    // small warning badge
    const bw=Math.min(p.w*s-6,100),bh=18,bx=X(mx)+(p.w*s-bw)/2,by=Y(my+p.d)-bh-2;
    if(bh<p.d*s-4){
      c.fillStyle='#f97316';c.beginPath();c.roundRect?c.roundRect(bx,by,bw,bh,4):c.rect(bx,by,bw,bh);c.fill();
      c.fillStyle='#fff';c.font='bold 11px '+WR_FONT;c.textAlign='center';c.textBaseline='middle';
      c.fillText('⚠ no connections',bx+bw/2,by+bh/2+0.5);
    }
    c.restore();
  }}
  // wires
  nets.forEach((n,k)=>{
    const colr=netColour(n,k);
    n.links.forEach(([ia,ib],j)=>{
      const on=F?F.links.has(k+'-'+j):(exporting||wr.hi<0||wr.hi===k);
      const a=n.pins[ia],b=n.pins[ib],[ax,ay]=pinXY(a.inst,a.pin),[bx,by]=pinXY(b.inst,b.pin);
      const out=(i,x,y)=>{const [mx,my]=wr.pos[i.key],d=[[0,-1,y-my],[0,1,my+i.part.d-y],[-1,0,x-mx],[1,0,mx+i.part.w-x]].sort((u,v)=>u[2]-v[2])[0];return [d[0],d[1]];};
      const [adx,ady]=out(a.inst,ax,ay),[bdx,bdy]=out(b.inst,bx,by),L=Math.max(12,Math.hypot(bx-ax,by-ay)*0.35);
      const P=[[X(ax),Y(ay)],[X(ax+adx*L),Y(ay+ady*L)],[X(bx+bdx*L),Y(by+bdy*L)],[X(bx),Y(by)]];
      const pts=[];for(let q=0;q<=24;q++){const t=q/24,u=1-t;pts.push([0,1].map(e=>u*u*u*P[0][e]+3*u*u*t*P[1][e]+3*u*t*t*P[2][e]+t*t*t*P[3][e]));}
      hit.push({k,j,pts});
      c.save();c.globalAlpha=on?1:(F?0.07:0.15);c.strokeStyle=colr;c.lineCap='round';
      c.lineWidth=F&&on?5:(wr.hi===k&&!F&&!exporting?4.5:2.6);if(n.kind==='5v')c.setLineDash([9,5]);
      if(F&&on){c.save();c.strokeStyle='#ffffff';c.lineWidth=9;c.setLineDash([]);c.beginPath();c.moveTo(...P[0]);c.bezierCurveTo(...P[1],...P[2],...P[3]);c.stroke();c.restore();}
      c.beginPath();c.moveTo(...P[0]);c.bezierCurveTo(...P[1],...P[2],...P[3]);c.stroke();c.restore();
    });
  });
  // labels: only the pins in use, outside the boards, each moved along/outwards until it overlaps nothing
  const big=!!F,seen=new Set(),todo=[];
  if(F&&F.big){c.font='bold 20px '+WR_FONT;const w1=c.measureText(F.big).width;c.font='13px '+WR_FONT;const bw=Math.min(cw-16,Math.max(w1,c.measureText(F.sub).width)+28);obst.push({x:(cw-bw)/2-4,y:(exporting?8:44)-4,w:bw+8,h:60});}
  nets.forEach((n,k)=>{for(const p of n.pins){const id=wrPinId(p);if(seen.has(id))continue;seen.add(id);if(F&&!F.pins.has(id))continue;todo.push({p,k,col:netColour(n,k)});}});
  c.font=(big?'bold 14px ':'bold 11px ')+WR_FONT;const lh=big?20:15;
  for(const L of todo){
    const {p}=L,[px0,py0]=pinXY(p.inst,p.pin),[mx,my]=wr.pos[p.inst.key],pw=p.inst.part.w,pd=p.inst.part.d;
    const px=X(px0),py=Y(py0),t=p.pin.n,tw=c.measureText(t).width+8;
    const e=[[0,-1,py0-my],[0,1,my+pd-py0],[-1,0,px0-mx],[1,0,mx+pw-px0]].sort((u,v)=>u[2]-v[2])[0],[dx,dy]=e;
    const edge=dy<0?Y(my):dy>0?Y(my+pd):dx<0?X(mx):X(mx+pw);// the board edge the label goes past
    let best=null;
    search:for(let tier=0;tier<9;tier++){
      const off=8+tier*(dy?lh+2:tw*0.6+6);
      for(const sh of [0,1,-1,2,-2,3,-3,4,-4]){
        let r;
        if(dy){const y=dy<0?edge-off-lh:edge+off;r={x:px-tw/2+sh*(tw*0.55+3),y,w:tw,h:lh};}
        else{const x=dx<0?edge-off-tw:edge+off;r={x,y:py-lh/2+sh*(lh+2),w:tw,h:lh};}
        if(!obst.some(o=>hitR(o,r))&&!labelRects.some(o=>hitR({x:o.x-2,y:o.y-2,w:o.w+4,h:o.h+4},r))){best=r;break search;}
        if(!best)best=r;
      }
    }
    const r=best;labelRects.push({x:r.x,y:r.y,w:r.w,h:r.h,t:p.inst.label+' '+t,px,py,col:L.col,text:t,k:L.k});
  }
  for(const r of labelRects){// leader line from the pin to the nearest point of its label
    const lOn=!F&&wr.hi>=0&&!exporting?r.k===wr.hi:true;
    const qx=Math.max(r.x,Math.min(r.px,r.x+r.w)),qy=Math.max(r.y,Math.min(r.py,r.y+r.h));
    c.save();c.strokeStyle=r.col;c.globalAlpha=lOn?0.85:0.1;c.lineWidth=1.2;c.beginPath();c.moveTo(r.px,r.py);c.lineTo(qx,qy);c.stroke();
    c.beginPath();c.arc(r.px,r.py,big?4:3,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.lineWidth=big?2.5:1.8;c.stroke();c.restore();
  }
  for(const r of labelRects){
    const lOn=!F&&wr.hi>=0&&!exporting?r.k===wr.hi:true;
    c.save();c.globalAlpha=lOn?1:0.1;c.fillStyle='#ffffff';c.strokeStyle=r.col;c.lineWidth=big?2:1.4;
    c.beginPath();c.roundRect?c.roundRect(r.x,r.y,r.w,r.h,4):c.rect(r.x,r.y,r.w,r.h);c.fill();c.stroke();
    c.fillStyle='#111';c.textAlign='center';c.textBaseline='middle';c.fillText(r.text,r.x+r.w/2,r.y+r.h/2+0.5);c.restore();
  }
  // the key
  const kinds=[...new Set(nets.map(n=>WIRE_COLOURS[n.kind]?n.kind:'sig'))].sort((a,b)=>'3v35vvbatgndspksig'.indexOf(a)-'3v35vvbatgndspksig'.indexOf(b));
  c.font='12px '+WR_FONT;
  const items=kinds.map(k=>({k,t:k==='sig'?'Signals: one colour each':WIRE_KEY[k]}));
  let kx=10;const ky=ch-24,kw=items.reduce((s,it)=>s+30+c.measureText(it.t).width+12,0);
  c.save();c.fillStyle='#ffffffe8';c.strokeStyle='#ccd';c.lineWidth=1;c.beginPath();c.rect(6,ky-11,Math.min(kw+6,cw-12),22);c.fill();c.stroke();
  for(const it of items){
    c.lineWidth=4;c.lineCap='round';c.setLineDash(it.k==='5v'?[6,4]:[]);
    if(it.k==='sig'){SIG_COLOURS.slice(0,3).forEach((cl,q)=>{c.strokeStyle=cl;c.beginPath();c.moveTo(kx+4+q*8,ky);c.lineTo(kx+9+q*8,ky);c.stroke();});}
    else{c.strokeStyle=WIRE_COLOURS[it.k];c.beginPath();c.moveTo(kx+4,ky);c.lineTo(kx+24,ky);c.stroke();}
    c.setLineDash([]);c.fillStyle='#222';c.textAlign='left';c.textBaseline='middle';c.fillText(it.t,kx+30,ky+0.5);kx+=30+c.measureText(it.t).width+12;
  }
  c.restore();
  // the big label for what is in focus
  let bigLabel='';
  if(F&&F.big){
    bigLabel=F.big;
    c.save();c.font='bold 20px '+WR_FONT;const t=fitText(F.big,cw-30),w1=c.measureText(t).width;c.font='13px '+WR_FONT;const w2=c.measureText(F.sub).width;
    const bw=Math.min(cw-16,Math.max(w1,w2)+28),bx=(cw-bw)/2,by=exporting?8:44;
    c.fillStyle='#ffffff';c.strokeStyle=F.col;c.lineWidth=3;c.beginPath();c.roundRect?c.roundRect(bx,by,bw,52,8):c.rect(bx,by,bw,52);c.fill();c.stroke();
    c.fillStyle='#111';c.textAlign='center';c.textBaseline='alphabetic';c.font='bold 20px '+WR_FONT;c.fillText(t,cw/2,by+25);
    c.font='13px '+WR_FONT;c.fillStyle='#555';c.fillText(F.sub,cw/2,by+44);c.restore();
  }
  return {labelRects,partRects,hit,bigLabel,keyShown:items.length>0};
};
// the buttons over the picture
const wrToolsShow=function wrToolsShow(){
  const ok=wr&&!wr.plan.error;$('wrTools').style.display=ok?'flex':'none';if(!ok)return;
  $('wrStepBox').style.display=wr.step>=0?'inline-flex':'none';$('wrStep').style.display=wr.step>=0?'none':'';
  $('wrShowAll').style.display=wr.focus?'':'none';
  if(wr.step>=0)$('wrStepN').textContent=' Wire '+(wr.step+1)+' of '+wrLinks().length+' ';
};
// focus on one wire / connection / part (null = show all), and mark it in the wiring list
const wrSetFocus=function wrSetFocus(f,step){
  wr.focus=f;wr.step=f&&f.type==='link'&&step!==undefined?step:(f&&f.type==='link'&&wr.step>=0?wrLinks().findIndex(l=>l.k===f.k&&l.j===f.j):-1);
  if(!f)wr.step=-1;
  document.querySelectorAll('#wrSide [data-link]').forEach(el=>el.classList.toggle('on',!!f&&f.type==='link'&&el.dataset.link===f.k+'-'+f.j));
  document.querySelectorAll('#wrSide .wrNet').forEach(el=>el.classList.toggle('on',!!f&&f.type==='net'&&+el.dataset.net===f.k));
  if(f&&f.type==='link'){const el=document.querySelector(`#wrSide [data-link="${f.k}-${f.j}"]`);if(el&&wr.step>=0)el.scrollIntoView({block:'nearest'});}
  drawWiring();
};
const wrGoStep=function wrGoStep(i){const L=wrLinks();if(!L.length)return;i=Math.max(0,Math.min(L.length-1,i));wrSetFocus({type:'link',k:L[i].k,j:L[i].j},i);};
const wrZoom=function wrZoom(f,sx,sy){
  const cv=$('wrCanvas'),v=wr.userView||{...wr.view},fit=wrFitView(cv.clientWidth,cv.clientHeight);
  const s=Math.max(fit.s*0.4,Math.min(fit.s*8,v.s*f)),k=s/v.s;
  if(sx===undefined){sx=cv.clientWidth/2;sy=cv.clientHeight/2;}
  wr.userView={s,ox:sx-(sx-v.ox)*k,oy:sy-(sy-v.oy)*k};drawWiring();
};
// "Save picture": the whole picture at a good size, every label shown, whatever is zoomed or in focus
const wrSavePicture=function wrSavePicture(){
  if(!wr||wr.plan.error)return;
  const {insts}=wr.plan;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const i of insts){if(!wr.pos[i.key])continue;const [x,y]=wr.pos[i.key];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+i.part.w);y1=Math.max(y1,y+i.part.d);}
  // drawn at 5 px a millimetre and then doubled, so the labels and names are big and sharp too
  const K=2,S=Math.min(6,Math.max(4.5,1800/Math.max(x1-x0,y1-y0))),W=Math.round((x1-x0)*S+180),H=Math.round((y1-y0)*S+200);
  const cv=document.createElement('canvas');cv.width=W*K;cv.height=H*K;
  const v={s:S,ox:90-x0*S,oy:110-y0*S},c=cv.getContext('2d');c.setTransform(K,0,0,K,0,0);
  renderWiring(c,W,H,v,null,true);
  cv.toBlob(b=>WF.downloadBlob('Wiring diagram.png',b));
};
const renderWiringSide=function renderWiringSide(){
  const s=$('wrSide'),P=wr.plan;
  if(P.error){s.innerHTML='<h4>Nothing to wire yet</h4><p>'+esc(P.error)+'</p><div class="ewRow"><button id="wrToWiz">Open the Enclosure Wizard</button></div>';return;}
  const tab=wr.tab,pf=pfOfPlan(P),tabs=['list','code','esphome','ai'].map(t=>`<button data-wrtab="${t}" class="${tab===t?'on':''}">${{list:'Wiring list',code:'Code pins',esphome:(PLATFORMS[pf]||PLATFORMS.esphome).code,ai:'Ask AI'}[t]}</button>`).join('');
  const warn=P.warn.map(w=>{const np=(P.noPinParts||[]).find(p=>w.startsWith(p.label+' has no pin data'));return`<li class="warn"><span class="ic">!</span><span style="color:var(--text)">${esc(w)}</span>${np?` <button class="wrFixPins" data-partid="${esc(np.id)}" style="margin-left:6px;padding:2px 8px;font-size:11px;border-radius:4px;border:1px solid #e67700;background:color-mix(in srgb,#e67700 12%,var(--bg2));color:#e67700;cursor:pointer">Fix: add pins →</button>`:''}</li>`;}).join('');
  const info=P.info.map(w=>`<li class="ok"><span class="ic">✓</span><span style="color:var(--text)">${esc(w)}</span></li>`).join('');
  let body='';
  if(tab==='list'){
    const F=wr.focus;
    body='<div class="ewNote" style="margin:6px 0">Tick each wire as you solder it. Click a line to see just that wire in the picture, or a heading for the whole connection; <b>One wire at a time</b> (over the picture) goes through them in this order.</div>'+P.nets.map((n,k)=>
      `<div class="wrNet${F&&F.type==='net'&&F.k===k?' on':''}" data-net="${k}"><span class="sw${n.kind==='5v'?' dash':''}" style="background:${netColour(n,k)}"></span><b data-netfocus="${k}" title="Show this whole connection">${esc(n.name)}</b>`+
        n.links.map(([ia,ib],j)=>{const a=n.pins[ia],b=n.pins[ib],id=k+'-'+j;return `<div class="wrLink${F&&F.type==='link'&&F.k===k&&F.j===j?' on':''}" data-link="${id}" title="Show just this wire"><input type="checkbox" data-done="${id}"${wr.done[id]?' checked':''}> ${esc(a.inst.label)} <b>${esc(a.pin.n)}</b> → ${esc(b.inst.label)} <b>${esc(b.pin.n)}</b></div>`;}).join('')+'</div>'
    ).join('');
  }else if(tab==='esphome')body=pf==='esphome'?esphPanel():platformCodePanel(pf);
  else if(tab==='ai')body=chatPanel();
  else{
    body=`<h4>ESPHome</h4><textarea readonly class="wrCode" id="wrYml">${esc(P.code.esphome)}</textarea><div class="ewRow"><button data-copy="wrYml">Copy</button></div>
<h4>Arduino</h4><textarea readonly class="wrCode" id="wrIno">${esc(P.code.arduino)}</textarea><div class="ewRow"><button data-copy="wrIno">Copy</button></div>`;
  }
  // tabs first; warnings always shown so the Fix button is accessible on any tab
    let doctorHtml = '';
  if (P.doctorFindings && P.doctorFindings.length) {
    const errCount = P.doctorFindings.filter(f => f.severity === 'error').length;
    const warnCount = P.doctorFindings.filter(f => f.severity === 'warning').length;
    const badgeColor = errCount ? '#d32f2f' : (warnCount ? '#f57c00' : '#388e3c');
    const badgeBg = errCount ? '#ffebee' : (warnCount ? '#fff3e0' : '#e8f5e9');
    const summaryText = errCount ? `${errCount} electrical problem${errCount > 1 ? 's' : ''}` : (warnCount ? `${warnCount} electrical warning${warnCount > 1 ? 's' : ''} worth checking` : 'All electrical safety checks passed');
    doctorHtml = `<details class="efdetails" style="margin:8px 0;border:1px solid ${badgeColor};border-radius:6px;background:${badgeBg};padding:6px 10px">
      <summary style="font-weight:600;cursor:pointer;color:${badgeColor}">🩺 Electrician Safety Audit: ${summaryText}</summary>
      <div style="margin-top:8px;font-size:12px;line-height:1.45">
        ${P.doctorFindings.map(f => `
          <div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #ccc">
            <b style="color:${f.severity==='error'?'#d32f2f':(f.severity==='warning'?'#e65100':'#1565c0')}">[${f.severity.toUpperCase()}] ${esc(f.title)}</b>
            <div style="color:var(--text);margin:2px 0">${esc(f.why)}</div>
            <div style="color:#2e7d32;font-weight:600">Fix: ${esc(f.fix)}</div>
          </div>
        `).join('')}
      </div>
    </details>`;
  }
  const foldInfo=info&&(tab==='esphome'||tab==='code'),nInfo=P.info.length;
  const warnHtml=(doctorHtml||warn||info)?(doctorHtml+`<ul style="list-style:none;padding:0;margin:8px 0">${warn}${foldInfo?'':info}</ul>`+(foldInfo?`<details class="efdetails" style="margin:6px 0;border:1px solid var(--line);border-radius:6px;padding:4px 10px"><summary style="cursor:pointer;font-size:12.5px">ℹ️ How it is powered and which pins are kept free (${nInfo})</summary><ul style="list-style:none;padding:0;margin:6px 0">${info}</ul></details>`:'')):'';
  s.innerHTML=`<div class="ewRow" style="margin-top:6px">${tabs}</div>`+warnHtml+body;
};
// The ESPHome device tab: a few questions, then the whole file to copy, save or check.
const esphPanel=function esphPanel(){
  const P=wr.plan,f=esphForm(),brd=espBoard(P.ctrl.part);
  if(!brd)return `<h4>ESPHome device</h4><p>${esc(P.ctrl.label)} can't run ESPHome: ESPHome needs an ESP32 or ESP8266 board as the controller.</p>`;
  if(!f.name)f.name='My Device';
  const has=r=>P.assigned.some(a=>a.role===r),voice=f.purpose==='voice';
  const buttons=P.assigned.some(a=>a.role==='sig'&&/button|touch|ttp22|push|tact/i.test(a.inst.part.name));
  const opt=(o,v)=>Object.entries(o).map(([k,n])=>`<option value="${k}"${k===v?' selected':''}>${esc(n)}</option>`).join('');
  const r=esphomeYaml(P,f);
  // Restore a previously AI-written result if the same unknown parts are still present (same fingerprint).
  // This prevents the red "needs the AI" banner from reappearing after a re-render or page reload.
  if(!wr.ai&&r.unknown.length){
    try{const stored=JSON.parse(WF.store.get(ESPH_AI_KEY)||'null');
      if(stored&&stored.sig===esphAiSig(r.unknown))wr.ai={yaml:stored.yaml,notes:stored.notes,ok:stored.ok};}
    catch(e){}
  }
  let h=`<h4>ESPHome device</h4>${capHtml(planIssues(P))}<div class="ewNote" style="margin-bottom:6px">EvenUCan has written the complete ESPHome configuration for ${esc(P.ctrl.label)} using your exact wiring.</div>`;
  if(r.error)return h+`<p class="bad" style="margin-top:8px">${esc(r.error)}</p>`;
  let settingsHtml=`<div style="margin-top:8px">
<label class="ef">Device name <input data-ef="name" value="${esc(f.name)}" maxlength="40"></label>
<label class="ef">What is it for? <select data-ef="purpose">${opt(ESPH_PURPOSES,f.purpose)}</select></label>`;
  if(!voice)settingsHtml+=`<div class="ef">Works with <label><input type="radio" name="efha" data-ef="ha" value="1"${f.ha?' checked':''}> Home Assistant</label> <label><input type="radio" name="efha" data-ef="ha" value="0"${f.ha?'':' checked'}> on its own</label></div>
<label class="ef">Read sensors every <input data-ef="every" type="number" min="1" max="3600" value="${esc(f.every)}" style="width:60px"> s</label>`;
  if(!voice&&has('trig'))settingsHtml+=`<label class="ef">Alarm under <input data-ef="alarm" type="number" min="0" max="400" value="${esc(f.alarm)}" style="width:60px"> cm</label>`;
  if(voice)settingsHtml+=`<label class="ef">Wake word <select data-ef="wake">${opt(WAKE_WORDS,f.wake)}</select></label>`;
  if(P.batSense)settingsHtml+=`<label class="ef">Battery low below <input data-ef="lowbat" type="number" min="2.8" max="4.2" step="0.1" value="${esc(f.lowbat)}" style="width:60px"> V</label>`;
  if(buttons)settingsHtml+=`<label class="ef">Button <select data-ef="button">${opt(Object.assign({report:'just reports when pressed',light:'turns light on/off'},voice?{talk:'starts talking'}:{}),f.button)}</select></label>`;
  settingsHtml+=`<label class="ef" title="Gives every board its own name (like ${esc(esphSlug(f.name||'my-device'))}-a1b2c3) so several copies work together without clashing"><input type="checkbox" data-ef="copies"${f.copies?' checked':''}> I'm making more than one of these (one per room)</label>`;
  if(brd.led!==undefined)settingsHtml+=`<label class="ef"><input type="checkbox" data-ef="status"${f.status?' checked':''}> Board status LED</label>`;
  if(r.meas.length&&r.lightId){// a reading drives the light
    const cols=r.rgb?Object.keys(RULE_COLOURS):['on','off'],co=v=>cols.map(c=>`<option${c===v?' selected':''}>${c}</option>`).join('');
    const m=r.meas.find(x=>x.id===f.ruleSrc)||r.meas[0];
    settingsHtml+=`<div class="efbox" style="margin-top:6px"><b>Light rule</b><br>
<label><input type="checkbox" data-ef="ruleOn"${f.ruleOn?' checked':''}> The ${r.rgb?'status light':'LED'} is</label> <select data-ef="ruleA">${co(r.rgb?f.ruleA:(f.ruleA==='off'?'off':'on'))}</select>
while <select data-ef="ruleSrc">${r.meas.map(x=>`<option value="${x.id}"${x===m?' selected':''}>${esc(x.label)}</option>`).join('')}</select>
is <select data-ef="ruleOp"><option value="above"${f.ruleOp!=='below'?' selected':''}>above</option><option value="below"${f.ruleOp==='below'?' selected':''}>below</option></select>
<input data-ef="ruleVal" type="number" step="0.1" value="${esc(f.ruleVal)}" style="width:58px"> ${esc(m.unit)}, otherwise <select data-ef="ruleB">${co(r.rgb?f.ruleB:(f.ruleB==='on'?'on':'off'))}</select></div>`;
  }
  settingsHtml+=`</div>`;
  let hSet='',hAi='';
  hSet=`<details class="efdetails" style="margin:8px 0;border:1px solid var(--line);border-radius:6px;padding:6px 10px;background:var(--bg2)"><summary style="font-weight:600;cursor:pointer">⚙️ Device settings & rules (click to customize)</summary>${settingsHtml}</details>`;
  const canAI=!!aiKey();
  const unk=r.unknown.map(u=>esc(u.label)).join(', ');
  // When wr.ai is set the AI has already written the code for all unknown parts — replace the red
  // warning with a green tick so the user can see it's been handled.
  const unkBanner=r.unknown.length
    ?(wr.ai
      ?`<div style="background:#e8f5e9;border:2px solid #2e7d32;border-radius:6px;padding:10px 14px;margin-bottom:10px;line-height:1.5">✅ <b>Done!</b> Your AI has sorted out the code for <b>${unk}</b>.<br><span style="font-size:12px;color:#555">Scroll down to see your finished code.</span></div>`
      :`<div style="background:#fff3e0;border:2px solid #e65100;border-radius:6px;padding:10px 14px;margin-bottom:8px;line-height:1.6"><b>⚠️ One thing to do first</b><br>Your design includes <b>${unk}</b> — a part EvenUCan hasn't seen before. Your AI needs to write the code for it.<br><b>👇 Press the red button below to fix this — it only takes a moment.</b></div><div class="ewRow" style="margin-bottom:2px"><button id="wrAiFix" style="font-size:14px;font-weight:bold;padding:8px 20px;background:#c0392b;color:#fff;border:none;border-radius:6px;cursor:pointer;letter-spacing:0.3px"${esphAiBusy||!canAI?' disabled':''}>${esphAiBusy?'⏳ Writing the code — please wait…':'🔧 Fix this part with AI'}</button></div><div style="font-size:12px;color:#888;margin-bottom:10px;margin-top:4px">After pressing, wait a moment — then scroll down to see your code.</div>`)
    :'';
  const _hasUnknown=r.unknown&&r.unknown.length&&!wr.ai;
  const _makeAiBtn=_hasUnknown?'':(`<div class="ewRow" style="margin-top:8px;margin-bottom:4px"><button id="wrAi"${esphAiBusy||!canAI?' disabled':''}>${esphAiBusy?'Writing… please wait':'Make it with AI'}</button>${canAI?'':'<span class="ewNote">Needs a key for this AI: click <b>'+esc(keyLabel())+'</b> above.</span>'}</div>`);
  hAi=`<div class="efbox">`+unkBanner+`<b>What should it do?</b> <span class="ewNote">(optional: in your own words; your AI adds it)</span>
<textarea data-ef="desc" rows="3" style="width:100%;margin-top:4px" placeholder="In your own words, e.g. Light the LED red when the temperature is over 28 °C and green when it's fine, and turn on the relay when it's over 30 °C.">${esc(f.desc||'')}</textarea>
<div id="wrAiOut">${wr.aiMsg||''}</div>
`+_makeAiBtn+`<div class="ewRow"><label>AI <select id="wrProv">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${aiProv()===k?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></label><button id="wrKey">${keyLabel()}</button></div></div>`;
  h+=`<div class="actGrid"><div class="actGrp"><b>Put it on the board</b><button id="wrFlashEsp" class="actBtn hwBtn" title="Compile and flash directly to ESP32 over USB using the local server">⚡ Flash to ESP32 (USB)</button><button id="wrPfIde" class="primary actBtn" title="Put this device into your ESPHome folder, open ESPHome and show each step to get it on the board">Open in ESPHome</button></div><div class="actGrp"><b>Check</b><button class="actBtn" id="wrYamlDoctor" title="Run YAML Doctor to check and auto-repair YAML syntax, pins, lambdas, and fail-safes">🩺 Diagnose & Fix YAML</button></div><div class="actGrp"><b>Keep</b><button class="actBtn" data-copy="wrEsp">Copy YAML</button><button class="actBtn" id="wrEspSave">Save .yaml…</button>${window.wfNative&&window.wfNative.esphomeCheck?'<button class="actBtn" id="wrEspCheck" title="Check the file with the ESPHome on this computer (the same as Validate in ESPHome Device Builder)">Check with ESPHome</button>':''}<button class="actBtn" id="wrSaveProject" title="Save the complete project as a 3MF — idea, parts, box, wiring and code all in one file you can reload or share">💾 Save project…</button></div></div>
<div id="wrEspOut"></div><div id="wrYamlDoctorOut"></div><textarea class="wrCode" id="wrEsp" style="height:200px;margin-top:6px">${esc(esphCurrent(r))}</textarea><div class="ewRow"><button id="wrEspReset" title="Throw away your edits and go back to the file EvenUCan made">Reset to the EvenUCan file</button></div>`+hSet+`<details class="efdetails" style="margin:8px 0;border:1px solid var(--line);border-radius:6px;padding:6px 10px;background:var(--bg2)"${_hasUnknown||esphAiBusy||wr.aiMsg?' open':''}><summary style="font-weight:600;cursor:pointer">✨ Change the code with AI (optional)</summary>${hAi}</details>`+ntfyBox(intentTopic())+(r.warn.length?`<ul style="list-style:none;padding:0;margin:6px 0">${r.warn.map(w=>`<li class="warn"><span class="ic">!</span><span style="color:var(--text)">${esc(w)}</span></li>`).join('')}</ul>`:'')+
`<div class="ewNote" style="margin-top:6px">Click <b>Open in ESPHome</b>: EvenUCan puts this device in your ESPHome folder, opens ESPHome and stays on screen with each step until it is on your board.</div>`;
  return h;
};
