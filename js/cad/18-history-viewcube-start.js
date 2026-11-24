// EvenUCan 3D drawing app - 18-history-viewcube-start.js
// One of the files in js/cad/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- history
// Every change, listed down the left. Click a step to go back to just after it; the steps after it turn grey and can
// be clicked to go forward again, until a new change throws them away (like a multiple Undo). Folds away to a tab.
histEl=document.createElement('div');histEl.id='hist';
histEl.innerHTML='<div class="hHead" title="Click to fold the history away (or open it again)"><span class="hArrow">◀</span><b>History</b><span class="hCount"></span></div>'+
  '<ol class="hList"></ol><div class="hFoot">Click a step to go back to it.</div>';
$cad('view').appendChild(histEl);
// (looked up each time: histChanged may run before this part of the page has started)
const histOpen=function histOpen(on){histEl.classList.toggle('closed',!on);store.set('history',on?'open':'closed');};
histEl.querySelector('.hHead').onclick=()=>histOpen(histEl.classList.contains('closed'));
histEl.querySelector(".hList").addEventListener("click",e=>{const li=e.target.closest('li');if(li)goToStep(+li.dataset.k);});
const histChanged=function histChanged(){
  const histList=histEl&&histEl.querySelector(".hList");if(!histList)return;
  const done=undoNames.length,all=[...undoNames,...redoNames.slice().reverse()];
  const row=(k,label,cls,tip)=>`<li data-k="${k}" class="${cls}" title="${tip}"><span class="n">${k||''}</span>${label}</li>`;
  let h=row(0,histTrimmed?'Earlier steps':'Start',done===0?'cur':'',done===0?'This is where you are now':'Go back to the start'+(histTrimmed?' of what is kept (the oldest steps are not kept)':''));
  all.forEach((name,i)=>{const k=i+1;h+=row(k,name.replace(/[<&]/g,c=>c==='<'?'&lt;':'&amp;'),k===done?'cur':k>done?'gone':'',k===done?'This is where you are now':k>done?'Undone: click to go forward to here again (a new change throws it away)':'Go back to just after this step (the steps after it are greyed out until you make a new change)');});
  histList.innerHTML=h;
  histEl.querySelector('.hCount').textContent=all.length?all.length+(all.length===1?' step':' steps'):'';
  const cur=histList.querySelector('.cur');if(cur)cur.scrollIntoView({block:'nearest'});
};
histOpen(store.get('history')!=='closed');histChanged();

// ---------------------------------------------------------------- view cube
// A cube in the corner that turns with the view. Click a face to look straight at that side and draw on it (TOP is the
// ground), an edge or corner for an angled view; drag it to turn the view. With an empty drawing it starts large in
// the middle, asking which side to draw on, then moves to the corner.
const CUBE=[{k:'top',n:Z,U:X,V:[0,-1,0]},{k:'bottom',n:[0,0,-1],U:X,V:Y},{k:'front',n:[0,-1,0],U:X,V:[0,0,-1]},
  {k:'right',n:X,U:Y,V:[0,0,-1]},{k:'back',n:Y,U:[-1,0,0],V:[0,0,-1]},{k:'left',n:[-1,0,0],U:[0,-1,0],V:[0,0,-1]}];
const PLANE_AXES={front:[X,Z],back:[X,Z],right:[Y,Z],left:[Y,Z],bottom:[X,Y]};
const vcube=document.createElement('div');vcube.id='vcube';
vcube.innerHTML='<div class="vcIntro"><b>Which side do you want to draw on?</b><span>Click a side of the cube. You can change it any time.</span></div>'+
  '<canvas></canvas><button class="vcHome" title="Home: the normal 3D view of everything">⌂</button>'+
  '<div class="vcPlane" title="New shapes go on this side when they aren\'t drawn on a face. Click to go back to the ground."></div>'+
  '<button class="vcSkip">Just start on the ground</button>';
$cad('view').appendChild(vcube);
const vcCv=vcube.querySelector('canvas'),vcx=vcCv.getContext('2d');
let vcHover=null,vcDrag=null,vcAnim=0;
const setWorkPlane=function setWorkPlane(k){
  if(!k||k==='top'||k==='ground')workPlane={name:'ground',n:Z,u:X,v:Y};
  else{const f=CUBE.find(c=>c.k===k),[u,v]=PLANE_AXES[k];workPlane={name:k,n:f.n,u,v};}
  const nm=workPlane.name==='ground'?'':workPlane.name[0].toUpperCase()+workPlane.name.slice(1);
  const pl=vcube.querySelector('.vcPlane');pl.textContent=nm?'Drawing on: '+nm+' ✕':'';pl.style.display=nm?'block':'none';
  buildGrid();requestDraw();if(tool.move&&lastE)tool.move(lastE,lastM);
};
const cubeIntro=function cubeIntro(on){vcube.classList.toggle('center',on);requestDraw();};
// Something has been made (e.g. the wizard built a box): the 'Which side?' question no longer applies.
window.cubeIntroOff=()=>{if(vcube.classList.contains('center'))cubeIntro(false);};
// Turn the camera smoothly to look along -d (d points from the model towards the eye).
const turnTo=function turnTo(yaw,pitch){
  const y0=cam.yaw,p0=cam.pitch;let dy=yaw-y0;while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
  const t0=performance.now(),id=++vcAnim;
  const step=now=>{if(id!==vcAnim)return;const k=Math.min(1,(now-t0)/320),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    cam.yaw=y0+dy*e;cam.pitch=p0+(pitch-p0)*e;camDirty();if(k<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
};
const cubeLayout=function cubeLayout(){
  const s=vcCv.clientWidth||110,dpr=window.devicePixelRatio||1;
  if(vcCv.width!==Math.round(s*dpr)){vcCv.width=vcCv.height=Math.round(s*dpr);}
  const C=getCB(),S=s*0.26,c=s/2,P=v=>[c+dot(v,C.r)*S,c-dot(v,C.u)*S],V=v=>[dot(v,C.r)*S,-dot(v,C.u)*S];
  return {s,dpr,C,P,V};
};
// Which part of the cube is under (x,y): the face, and the third of it across and down (-1, 0 or 1).
const cubeHit=function cubeHit(x,y){
  const {C,P,V}=cubeLayout();
  for(const f of CUBE){
    if(dot(f.n,C.f)>-0.05)continue;
    const O=P(f.n),A=V(f.U),B=V(f.V),det=A[0]*B[1]-A[1]*B[0];if(Math.abs(det)<1e-6)continue;
    const s=((x-O[0])*B[1]-(y-O[1])*B[0])/det,t=(A[0]*(y-O[1])-A[1]*(x-O[0]))/det;
    if(Math.abs(s)<=1&&Math.abs(t)<=1)return {f,zs:s<-1/3?-1:s>1/3?1:0,zt:t<-1/3?-1:t>1/3?1:0};
  }
  return null;
};
const drawCube=function drawCube(){
  // keep clear of a panel open on the right
  let right=10;for(const p of document.querySelectorAll('#view>.panel'))if(p.style.display==='block')right=Math.max(right,p.offsetWidth+18);
  vcube.style.setProperty('--vcr',right+'px');
  const {s,dpr,C,P,V}=cubeLayout();
  vcx.setTransform(dpr,0,0,dpr,0,0);vcx.clearRect(0,0,s,s);
  for(const f of CUBE){
    const facing=-dot(f.n,C.f);if(facing<=0.02)continue;
    const pt=(a,b)=>P(add(f.n,add(mul(f.U,a),mul(f.V,b))));
    const quad=(a0,a1,b0,b1)=>{vcx.beginPath();const q=[pt(a0,b0),pt(a1,b0),pt(a1,b1),pt(a0,b1)];vcx.moveTo(...q[0]);for(const p of q.slice(1))vcx.lineTo(...p);vcx.closePath();};
    const shade=0.86+0.14*facing,isPlane=(workPlane.name==='ground'?'top':workPlane.name)===f.k;
    quad(-1,1,-1,1);vcx.fillStyle=isPlane?`rgb(${Math.round(200*shade)},${Math.round(222*shade)},255)`:`rgb(${Math.round(236*shade)},${Math.round(238*shade)},${Math.round(242*shade)})`;vcx.fill();
    if(vcHover&&vcHover.f===f){const z=v=>v<0?[-1,-1/3]:v>0?[1/3,1]:[-1/3,1/3],[a0,a1]=z(vcHover.zs),[b0,b1]=z(vcHover.zt);quad(a0,a1,b0,b1);vcx.fillStyle='#2f7cf6aa';vcx.fill();}
    quad(-1,1,-1,1);vcx.strokeStyle='#7b8494';vcx.lineWidth=1.2;vcx.stroke();
    if(facing>0.25){
      const O=P(f.n),A=V(f.U),B=V(f.V),k=50;
      vcx.save();vcx.setTransform(dpr*A[0]/k,dpr*A[1]/k,dpr*B[0]/k,dpr*B[1]/k,dpr*O[0],dpr*O[1]);
      vcx.fillStyle='#3a4250';vcx.font='bold 19px "Segoe UI",system-ui,sans-serif';vcx.textAlign='center';vcx.textBaseline='middle';
      vcx.fillText(f.k.toUpperCase(),0,1);vcx.restore();
    }
  }
};
const cubeClick=function cubeClick(h){
  if(!h)return;
  const f=h.f,face=!h.zs&&!h.zt;
  if(face){
    if(f.k==='top')turnTo(-Math.PI/2,LIM);else if(f.k==='bottom')turnTo(-Math.PI/2,-LIM);else turnTo(Math.atan2(f.n[1],f.n[0]),0);
    setWorkPlane(f.k);
    if(vcube.classList.contains('center')){cubeIntro(false);flash(f.k==='top'?'Drawing on the ground. Press R for a rectangle, C for a circle':'Drawing on the '+f.k+' side. Press R for a rectangle, C for a circle',4500);}
    else flash(f.k==='top'?'Looking down · new shapes go on the ground':'Looking at the '+f.k+' · new shapes go on the '+f.k+' side',3000);
  }else{
    const d=norm(add(f.n,add(mul(f.U,h.zs),mul(f.V,h.zt))));
    turnTo(Math.hypot(d[0],d[1])>1e-6?Math.atan2(d[1],d[0]):cam.yaw,clamp(Math.asin(d[2]),-LIM,LIM));
    if(vcube.classList.contains('center'))cubeIntro(false);
  }
};
vcCv.addEventListener('pointerdown',e=>{e.preventDefault();vcCv.setPointerCapture(e.pointerId);vcDrag={x:e.offsetX,y:e.offsetY,moved:0};});
vcCv.addEventListener('pointermove',e=>{
  if(vcDrag){const dx=e.offsetX-vcDrag.x,dy=e.offsetY-vcDrag.y;vcDrag.moved+=Math.abs(dx)+Math.abs(dy);vcDrag.x=e.offsetX;vcDrag.y=e.offsetY;
    if(vcDrag.moved>4){vcAnim++;orbitAround(cam.target,dx*2,dy*2);camDirty();vcHover=null;}return;}
  const h=cubeHit(e.offsetX,e.offsetY);if(!h!==!vcHover||h&&(h.f!==vcHover.f||h.zs!==vcHover.zs||h.zt!==vcHover.zt)){vcHover=h;requestDraw();}
  vcCv.style.cursor=h?'pointer':'grab';
});
vcCv.addEventListener('pointerup',e=>{const d=vcDrag;vcDrag=null;if(d&&d.moved<=4)cubeClick(cubeHit(e.offsetX,e.offsetY));});
vcCv.addEventListener('pointerleave',()=>{if(vcHover){vcHover=null;requestDraw();}});
vcube.querySelector('.vcHome').onclick=()=>{setView('iso');zoomExtents();};
vcube.querySelector('.vcPlane').onclick=()=>{setWorkPlane('ground');flash('New shapes go on the ground again');};
vcube.querySelector('.vcSkip').onclick=()=>{setWorkPlane('ground');cubeIntro(false);};
// Starting to draw (or clicking the view) puts the cube away in its corner.
cv.addEventListener('pointerdown',()=>{if(vcube.classList.contains('center'))cubeIntro(false);},true);
document.addEventListener('keydown',e=>{if(vcube.classList.contains('center')&&!e.ctrlKey&&e.key.length===1)cubeIntro(false);},true);

// ---------------------------------------------------------------- start
try{
  const a=JSON.parse(store.get('autosave')||'null');
  if(a&&Array.isArray(a.faces)){model={faces:a.faces,edges:a.edges||[],guides:a.guides||[]};fixIds();docName=a.name||'Untitled';homeCam();setView('iso');   // start with the print bed in view (the saved camera could be off-screen)if(a.units&&UNITS[a.units])units=a.units;
    // (r1) the wizard / ESPHome answers normally are still in their own keys; only fill in any that went missing
    const e=a.electronics;
    if(e&&typeof e==='object'){
      if(e.wizard&&Array.isArray(e.wizard.items)&&store.get(ELEC_KEYS.wizard)==null)store.trySet(ELEC_KEYS.wizard,JSON.stringify(e.wizard));
      if(e.esphome&&typeof e.esphome==='object'&&store.get(ELEC_KEYS.esphome)==null)store.trySet(ELEC_KEYS.esphome,JSON.stringify(e.esphome));
      if(e.intent&&store.get(ELEC_KEYS.intent)==null)restoreIntent(e.intent);
      // (r3) AI-looked-up parts missing from the user's own parts are added back (ones already there are kept as they are)
      const looked=Array.isArray(e.intent_missing_parts_added)?e.intent_missing_parts_added:[],own=parseKey(ELEC_KEYS.parts);
      if(looked.length&&(own!==null||store.get(ELEC_KEYS.parts)==null)){const list=Array.isArray(own)?own:[],add=looked.filter(p=>p&&p.id&&!list.some(q=>q&&q.id===p.id));if(add.length)store.trySet(ELEC_KEYS.parts,JSON.stringify([...list,...add]));}
    }}
}catch(e){
  // a damaged autosave: say so, rather than silently starting with an empty drawing
  console.error('EvenUCan: the autosaved drawing could not be read',e);
  model={faces:[],edges:[],guides:[]};docName='Untitled';
  setTimeout(()=>flash('⚠ The drawing kept from last time could not be read, so EvenUCan started with an empty one. Open your last saved file to carry on.',9000),500);
}
checkStorageSpace();
// An empty drawing always starts in millimetres (older versions defaulted to metres).
if(!model.faces.length&&!model.edges.length){units='mm';store.set('units','mm');homeCam();}
// The window is maximised just after it opens, so the 3D view is re-fitted to its final size (no click needed).
window.addEventListener('resize',()=>{camDirty();requestDraw();});
setTimeout(()=>{camDirty();requestDraw();},600);
uSel.value=units;syncPersp();buildGrid();buildPalette();setTool('select');updateStats();setDirty(false);
if(!model.faces.length)setHintCad('Welcome! Press R and draw a rectangle on the ground, then press P and pull it up into a box. Press F1 for help.');
setWorkPlane('ground');if(!model.faces.length&&!model.edges.length)cubeIntro(true);
// (r4) startup-r1: on first run show the Welcome wizard; on 2nd+ run show the Continue/New dialog when there is saved state
{const welcome=()=>{try{if(window.WFEnclosure){if(window.WFEnclosure.openStartupChoice)window.WFEnclosure.openStartupChoice();else if(window.WFEnclosure.openWelcome)window.WFEnclosure.openWelcome(true);}}catch(e){console.error('EvenUCan: could not show the startup screen',e);}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',welcome);else setTimeout(welcome,0);}
markDirtyCad();
