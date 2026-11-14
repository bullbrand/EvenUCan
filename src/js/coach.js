// ---- (coach-r1) "Build my first project": a guided walk-through. It dims the screen, rings the one button to click next
// and waits for the click, from the first idea right through to sending the code to ESPHome / the Arduino IDE.
// It uses no AI. It only points at buttons that already exist, so every step is the real app, not a pretend one.
document.body.insertAdjacentHTML('beforeend','<div id="coRing" aria-hidden="true"></div><div id="coTip" role="status" aria-live="polite"></div>');
const coRing=$('coRing'),coTip=$('coTip');
const coach={on:false,i:0,steps:[],last:null,timer:null,since:0,pending:false};
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
function coachVisible(el){
  if(!el||el.disabled)return false;
  const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;
  const s=getComputedStyle(el);if(s.visibility==='hidden'||s.display==='none')return false;
  return r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;
}
function coachFind(){
  const st=coach.steps[coach.i];if(!st)return null;
  return [...document.querySelectorAll(st.sel)].find(el=>el!==coach.last&&coachVisible(el))||null;
}
function coachShow(el){
  const st=coach.steps[coach.i],n=coach.steps.length;
  const r=el?el.getBoundingClientRect():null;
  if(r){
    coRing.style.cssText='display:block;left:'+(r.left-6)+'px;top:'+(r.top-6)+'px;width:'+(r.width+12)+'px;height:'+(r.height+12)+'px';
  }else coRing.style.display='none';
  const wait=!el&&Date.now()-coach.since>7000;
  coTip.innerHTML='<div class="coStep">Step '+(coach.i+1)+' of '+n+'</div><div>'+(el?st.text:'Getting the next screen ready…'+(wait?'<br>Can\'t see the button? Press <b>Skip this step</b>.':''))+'</div>'+
    '<div class="coBtns"><button id="coSkip">Skip this step</button><button id="coStop" class="linkBtn">Stop the guide</button></div>';
  coTip.style.display='block';
  const w=coTip.offsetWidth,h=coTip.offsetHeight;
  let x,y;
  if(r){x=Math.min(Math.max(10,r.left),innerWidth-w-10);y=r.bottom+14;if(y+h>innerHeight-10)y=Math.max(10,r.top-h-14);}
  else{x=Math.max(10,(innerWidth-w)/2);y=Math.max(10,innerHeight-h-30);}
  coTip.style.left=x+'px';coTip.style.top=y+'px';
}
function coachTick(){
  if(!coach.on||coach.pending)return;
  const el=coachFind();
  if(el&&coach.i>=0){
    const r=el.getBoundingClientRect();
    if(r.top<60||r.bottom>innerHeight-60)el.scrollIntoView({block:'center'});
  }
  coachShow(el);
}
function coachNext(){
  coach.pending=false;coach.i++;coach.since=Date.now();
  if(coach.i>=coach.steps.length)return coachFinish();
  coachTick();
}
function coachFinish(){
  coachStop(true);
  WF.store.set('coach_done','1');
  WF.flash('🎉 You did it! That is how every EvenUCan project goes. Start your own with 💡 Start a project.',9000);
}
function coachStop(done){
  coach.on=false;coach.pending=false;clearInterval(coach.timer);
  coRing.style.display='none';coTip.style.display='none';
  if(!done)WF.flash('Guide stopped. You can run it again any time from 🧭 First project.',5000);
}
async function coachStart(){
  if(coach.on)return;
  if((!WF.docEmpty||intentNow())&&!await askConfirm('The guide builds a small practice project in a fresh start.\n\nIf you are working on something, save it first (💾 Save at the top) so you can open it again.\n\nStart the guide?'))return;
  const pf=WF.store.get('pref_pf')||'esphome';
  coach.steps=coachSteps(pf);coach.i=0;coach.last=null;coach.since=Date.now();coach.pending=false;coach.on=true;
  try{closeWizard();closeWiring();}catch(e){}
  gStep=null;drawGuide();
  iw.w={text:'',does:[],pf:'auto',noShow:wcSeen()};iw.welcome=true;iw.step='welcome';iw.err='';iw.busy=false;
  iwBack.style.display='grid';renderIntent();
  coach.timer=setInterval(coachTick,300);coachTick();
}
// The click on the ringed button is the user's own click: let it do its job, then go on to the next step.
document.addEventListener('click',e=>{
  if(!coach.on)return;
  const id=e.target&&e.target.id;
  if(id==='coSkip'){coach.last=null;coachNext();return;}
  if(id==='coStop'){coachStop(false);return;}
  if(coach.pending)return;
  const st=coach.steps[coach.i];if(!st)return;
  const hit=e.target.closest&&e.target.closest(st.sel);
  if(!hit||hit.disabled)return;
  coach.last=hit;coach.pending=true;coRing.style.display='none';coTip.style.display='none';
  setTimeout(coachNext,coach.i===coach.steps.length-1?900:450);
},true);
document.addEventListener('keydown',e=>{if(coach.on&&e.key==='Escape')coachStop(false);},true);
$('bGuide').onclick=()=>coachStart();
window.addEventListener('resize',()=>{if(coach.on)coachTick();});
