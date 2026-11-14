// ---- (coach-r1) Guided walk-throughs. The screen dims and ONE button is ringed; the user clicks it and the guide moves on.
// A step is {sel, text} (wait for a click on the ringed button) or {sel, text, until(base), soft:true} (a drawing step: the
// picture is ringed softly, and the guide moves on by itself when until() says the drawing has changed).
// It uses no AI and only points at buttons that already exist, so every step is the real app, not a pretend one.
document.body.insertAdjacentHTML('beforeend','<div id="coRing" aria-hidden="true"></div><div id="coTip" role="status" aria-live="polite"></div>');
const coRing=$('coRing'),coTip=$('coTip');
const coach={on:false,guide:'',i:0,steps:[],last:null,timer:null,since:0,pending:false,base:0};
const nFaces=()=>WF.model.faces.length;
// ---- Guide 1: build my first project (the electronics route, from an idea to the code on the board)
// Which ready-made example to build, by the board the user said they use (setup asks this). ESPHome is the default.
const COACH_EX={esphome:1,esp32ide:0,arduino:4,raspberrypi:1};
function coachSteps(pf){
  const k=COACH_EX[pf]!==undefined?COACH_EX[pf]:1,ex=NOAI_EX[k]||NOAI_EX[1];
  const ide=ideName(ex.pf);
  return [
    {sel:'#wcNoAi',text:'Let\'s build a real gadget together, with no AI and no key. Click the <b>highlighted button</b>: <b>Carry on without AI</b>.'},
    {sel:'[data-noex="'+k+'"]',text:'Pick a ready-made idea. Click the highlighted one: <b>'+esc(ex.label)+'</b>. (Later you can tick any parts you like.)'},
    {sel:'#iwApply',text:'These are the parts for it. Happy? Click <b>Looks good. Next: Box</b>.'},
    {sel:'#ewGen',text:'Now the box. Click <b>Generate base + lid</b> and EvenUCan designs a box that fits every part.'},
    {sel:'#gNext',text:'Your box is made, and you can turn it round with the mouse. You can download it for your 3D printer later. Click the highlighted button to go on to the <b>wiring</b>.'},
    {sel:'#gNext',text:'This is the wiring list: which pin joins to which. Tick each wire off as you connect it. When you are ready, click the highlighted button for the <b>code</b>.'},
    {sel:'#gNext:not([disabled])',text:'Your code is written for you. Click the highlighted button to send it to <b>'+esc(ide)+'</b>.'}
  ];
}
// ---- Guide 2: draw a box, cut a hole. Gentle CAD: three tools, no jargon.
const toolSel=n=>'#toolbar button[data-tool="'+n+'"]';
function cadSteps(){
  return [
    {sel:toolSel('rect'),text:'Drawing on the computer is just <b>three moves</b>: draw a flat shape, pull it up, cut a hole. Nothing here can break. Start with the <b>Rectangle</b> tool: click it.'},
    {sel:'#view',soft:true,until:()=>nFaces()>=1,text:'Click once on the grid floor, move the mouse away, and click again. You have drawn a flat <b>rectangle</b>. (Made a mess? Press <b>Ctrl+Z</b> to undo.)'},
    {sel:toolSel('push'),text:'Now make it solid. This is the <b>Push/Pull</b> tool: it pulls a flat shape up into a 3D one. Click it.'},
    {sel:'#view',soft:true,until:()=>nFaces()>=5,text:'Click on the <b>top</b> of your rectangle, move the mouse up, and click again. It grows into a <b>box</b>! (You can also type a number, such as 20, and press Enter.)'},
    {sel:toolSel('circle'),text:'Now a hole. First draw a circle where the hole goes. Click the <b>Circle</b> tool.'},
    {sel:'#view',soft:true,until:b=>nFaces()>b,base:true,text:'Click on the <b>top of the box</b> for the middle of the hole, move out, and click for its size. A <b>circle</b> now sits on the box.'},
    {sel:toolSel('push'),text:'Same tool as before: <b>Push/Pull</b>. Click it again.'},
    {sel:'#view',soft:true,until:b=>nFaces()>b+3,base:true,text:'Click inside the <b>circle</b>, move the mouse <b>down</b> into the box and click. The circle is cut right out: that is a <b>hole</b>!'},
    {sel:toolSel('orbit'),text:'Well done! Now look at your work. Click <b>Orbit</b>, then drag in the picture to turn the box round.'},
    {sel:toolSel('select'),text:'Last one: click <b>Select</b> to get your ordinary pointer back.'}
  ];
}
function coachVisible(el){
  if(!el||el.disabled)return false;
  const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;
  const s=getComputedStyle(el);if(s.visibility==='hidden'||s.display==='none')return false;
  return true;// off the screen is fine: the guide scrolls it into view
}
function coachFind(){
  const st=coach.steps[coach.i];if(!st)return null;
  return [...document.querySelectorAll(st.sel)].find(el=>el!==coach.last&&coachVisible(el))||null;
}
function coachShow(el){
  const st=coach.steps[coach.i],n=coach.steps.length;
  const r=el?el.getBoundingClientRect():null,soft=!!(st&&st.soft);
  if(r){
    const pad=soft?-4:6;
    coRing.className=soft?'soft':'';
    coRing.style.cssText='display:block;left:'+(r.left-pad)+'px;top:'+(r.top-pad)+'px;width:'+(r.width+2*pad)+'px;height:'+(r.height+2*pad)+'px';
  }else coRing.style.display='none';
  const wait=!el&&Date.now()-coach.since>7000;
  coTip.innerHTML='<div class="coStep">Step '+(coach.i+1)+' of '+n+'</div><div>'+(el?st.text:'Getting the next screen ready…'+(wait?'<br>Can\'t see the button? Press <b>Skip this step</b>.':''))+'</div>'+
    '<div class="coBtns"><button id="coSkip">'+(soft?'I did it, next':'Skip this step')+'</button><button id="coStop" class="linkBtn">Stop the guide</button></div>';
  coTip.style.display='block';
  const w=coTip.offsetWidth,h=coTip.offsetHeight;
  let x,y;
  if(r&&soft){x=r.left+16;y=r.bottom-h-16;}// big picture area: tip in its bottom corner, out of the way of the drawing
  else if(r){x=Math.min(Math.max(10,r.left),innerWidth-w-10);y=r.bottom+14;if(y+h>innerHeight-10)y=Math.max(10,r.top-h-14);}
  else{x=Math.max(10,(innerWidth-w)/2);y=Math.max(10,innerHeight-h-30);}
  coTip.style.left=x+'px';coTip.style.top=y+'px';
}
function coachTick(){
  if(!coach.on||coach.pending)return;
  const st=coach.steps[coach.i];
  if(st&&st.until&&coach.stepStarted&&st.until(coach.base)){coach.pending=true;coRing.style.display='none';coTip.style.display='none';setTimeout(coachNext,500);return;}
  const el=coachFind();
  if(el&&!st.soft){
    const r=el.getBoundingClientRect();
    if(r.top<60||r.bottom>innerHeight-60||r.left<0||r.right>innerWidth){el.scrollIntoView({block:'center',inline:'center'});return coachShow(coachFind());}
  }
  coachShow(el);
}
function coachBegin(){// a step starts: remember how the drawing looks now, so "something changed" can be seen
  const st=coach.steps[coach.i];coach.base=nFaces();coach.stepStarted=!!st;coach.since=Date.now();
}
function coachNext(){
  coach.pending=false;coach.i++;
  if(coach.i>=coach.steps.length)return coachFinish();
  coachBegin();coachTick();
}
function coachFinish(){
  const g=coach.guide;coachStop(true);
  if(g==='first'){
    WF.store.set('coach_done','1');
    coTip.innerHTML='<div class="coStep">All done</div><div><b>🎉 You did it!</b> That is how every EvenUCan project goes: idea, parts, box, wiring, code.<br><br>Would you like to learn to <b>draw your own box</b> next? It is easier than it sounds.</div>'+
      '<div class="coBtns"><button id="coCad" class="primary">📐 Yes, show me how to draw</button><button id="coClose" class="linkBtn">Not now</button></div>';
    coTip.style.display='block';coTip.style.left=Math.max(10,(innerWidth-coTip.offsetWidth)/2)+'px';coTip.style.top=Math.max(10,innerHeight-coTip.offsetHeight-40)+'px';
  }else{
    WF.store.set('coach_cad_done','1');
    WF.flash('🎉 You drew a box and cut a hole. That is all CAD is! Try more tools, or press Ctrl+Z if you want to undo anything.',9000);
  }
}
function coachStop(done){
  coach.on=false;coach.pending=false;clearInterval(coach.timer);
  coRing.style.display='none';coTip.style.display='none';
  if(!done)WF.flash('Guide stopped. You can run it again any time from the top bar.',5000);
}
async function coachStart(){
  if(coach.on)return;
  if((!WF.docEmpty||intentNow())&&!await askConfirm('The guide builds a small practice project in a fresh start.\n\nIf you are working on something, save it first (💾 Save at the top) so you can open it again.\n\nStart the guide?'))return;
  const pf=WF.store.get('pref_pf')||'esphome';
  coach.guide='first';coach.steps=coachSteps(pf);coach.i=0;coach.last=null;coach.pending=false;coach.on=true;coachBegin();
  try{closeWizard();closeWiring();}catch(e){}
  gStep=null;drawGuide();
  iw.w={text:'',does:[],pf:'auto',noShow:wcSeen()};iw.welcome=true;iw.step='welcome';iw.err='';iw.busy=false;
  iwBack.style.display='grid';renderIntent();
  coach.timer=setInterval(coachTick,300);coachTick();
}
async function coachStartCad(){
  if(coach.on)return;
  coTip.style.display='none';
  if(!WF.docEmpty){
    if(!await askConfirm('The drawing guide needs an empty page, so it starts a new drawing (and clears the parts list of your current project).\n\nIf you are working on something, save it first (💾 Save at the top).\n\nStart the guide?'))return;
    $('bNew').click();// asks again if there are unsaved changes
    if(!WF.docEmpty)return;
  }
  iwBack.style.display='none';try{closeWizard();closeWiring();}catch(e){}
  gStep=null;drawGuide();
  coach.guide='cad';coach.steps=cadSteps();coach.i=0;coach.last=null;coach.pending=false;coach.on=true;coachBegin();
  coach.timer=setInterval(coachTick,300);coachTick();
}
// The click on the ringed button is the user's own click: let it do its job, then go on to the next step.
document.addEventListener('click',e=>{
  const id=e.target&&e.target.id;
  if(id==='coCad'){coachStartCad();return;}
  if(id==='coClose'){coTip.style.display='none';return;}
  if(!coach.on)return;
  if(id==='coSkip'){coach.last=null;coach.pending=false;coachNext();return;}
  if(id==='coStop'){coachStop(false);return;}
  if(coach.pending)return;
  const st=coach.steps[coach.i];if(!st||st.until)return;
  const hit=e.target.closest&&e.target.closest(st.sel);
  if(!hit||hit.disabled)return;
  coach.last=hit;coach.pending=true;coRing.style.display='none';coTip.style.display='none';
  setTimeout(coachNext,coach.i===coach.steps.length-1?900:450);
},true);
document.addEventListener('keydown',e=>{if(coach.on&&e.key==='Escape')coachStop(false);},true);
$('bGuide').onclick=()=>coachStart();
$('bGuideCad').onclick=()=>coachStartCad();
window.addEventListener('resize',()=>{if(coach.on)coachTick();});
