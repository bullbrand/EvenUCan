// EvenUCan Enclosure Wizard - 15-code-ai-and-requirements.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- (r3) Arduino and Raspberry Pi: the whole program is written by the user's AI from the idea and this wiring.
// Only when asked (the Generate button, or "Now let's look at the code"); kept until the wiring changes.
let pfCode=null,pfBusy=false,pfMsg='';// pfCode: {pf, sig, code, notes, warn}
// ---- AI countdown timer helpers (shared by pfGenerate and esphWithAI)
let _aiCd=null;
const _cdStart=function _cdStart(spanId,secs){
  if(_aiCd)clearInterval(_aiCd);
  let s=secs;
  const show=()=>{const el=document.getElementById(spanId);if(el)el.textContent=s+'s';};
  show();// show immediately, don't wait 1 second
  _aiCd=setInterval(()=>{s--;show();if(s<=0)clearInterval(_aiCd);},1000);
};
const _cdStop=function _cdStop(){if(_aiCd){clearInterval(_aiCd);_aiCd=null;}};
// Return a "try a different AI" hint if another provider has a key set up.
const _otherAiHint=function _otherAiHint(){
  const cur=aiProv();
  const others=Object.entries(PROVIDERS).filter(([k])=>k!==cur&&aiKey(k));
  if(!others.length)return '';
  return ' You could try switching to '+others.map(([,v])=>v.name).join(' or ')+'.';
};
// Arduino/Raspberry Pi need their own software on this computer, which (unlike ESPHome) EvenUCan never
// installs or runs anything of - just a presence check, so the Wiring window can point at the download page
// instead of assuming. In the desktop app that's a real check (window.wfNative.checkTool); the web page can't
// see what's on your computer at all, so there it just always offers the link.
let toolCheck={};
const toolLinkHtml=function toolLinkHtml(pf){
  const t=PLATFORMS[pf]&&PLATFORMS[pf].tool;if(!t)return '';
  if(window.wfNative&&window.wfNative.checkTool){
    if(!toolCheck[pf]){toolCheck[pf]={checking:true};window.wfNative.checkTool(t.check).then(r=>{toolCheck[pf]=r;if(wrBack.style.display==='grid'&&wr.tab==='esphome')renderWiringSide();});}
    const c=toolCheck[pf];
    if(c.checking)return `<div class="ewNote" style="margin-top:6px">Checking whether ${esc(t.name)} is on this computer…</div>`;
    if(c.found)return '';
  }
  return `<div class="ewNote" style="margin-top:6px">Don't have ${esc(t.name)} yet? You'll need it ${esc(t.why)}: <a href="${esc(t.url)}" target="_blank" rel="noopener">get it from ${esc(new URL(t.url).hostname)}</a>.</div>`;
};
const pfOfPlan=function pfOfPlan(P){
  const part=P.ctrl.part;if(espBoard(part))return (intentNow()||{}).platform==='esp32ide'?'esp32ide':'esphome';
  const mcu=part.mcu||(builtinById(part.id)||{}).mcu||'';
  return /bcm|rp1/.test(mcu)||/raspberry/i.test(part.name)?'raspberrypi':'arduino';
};
const planSig=P=>P.ctrl.part.id+'|'+P.nets.map(n=>n.name+':'+n.pins.map(p=>p.inst.label+'.'+p.pin.n).join(',')).join(';');
const pfFresh=P=>!!(pfCode&&pfCode.pf===pfOfPlan(P)&&pfCode.sig===planSig(P));
const PF_CODE_PROMPT={
  arduino:`You write Arduino sketches for complete beginners. Write ONE complete .ino sketch, ready to compile in the Arduino IDE, for the board and wiring below, that does what the project needs.
Rules:
- Start with a comment block whose first line is "// LIBRARIES_NEEDED:" followed by every library to install from the Arduino IDE Library Manager (its exact Library Manager name), one per line, or "//   (none: only built-in libraries)".
- Then the correct #include lines for everything used (Wire.h for I2C parts, and each library's own header).
- After the #include lines, ONE clearly marked SETTINGS block before setup(), headed "// ===== SETTINGS: everything you may want to change =====". Every value the user could want to edit goes in that block, one per line, each with a short plain-English comment: Wi-Fi name and password, any ntfy topic, the exact message text that gets sent, every pin, and every timing, cooldown or threshold constant. Nothing like that may be buried in loop() or a helper function - the message text in particular must be a named constant (e.g. const char* NTFY_MESSAGE) in this block, never written inline where it is sent.
- A #define for every pin the code uses, inside the SETTINGS block, with the EXACT pin numbers from the wiring below (Arduino pins 14-17 are A0-A3; I2C parts use the board's own SDA/SCL through Wire, so no #define for them).
- setup() and loop(), plus small helper functions with clear names. Plain-English comments explaining each step to someone who has never coded.
- Use only the parts in the wiring. Use millis() timing instead of long delay() calls when buttons or beeps must react.
- You MUST make the code do EVERY requirement listed under "Requirements". Never silently leave one out, never replace one with a comment, and never write a comment saying something isn't possible. If a requirement truly cannot be met with this board and these parts, write NO code: return {"refuse":true,"reason":"<one plain-English sentence: which requirement, and why>"} instead.
Return ONLY a JSON object: {"code":"<the complete sketch>","notes":"<two to four short plain-English sentences: what it does, which libraries to install, anything to adjust or calibrate>"}.`,
  raspberrypi:`You write Python 3 programs for a Raspberry Pi 4 (Raspberry Pi OS) for complete beginners. Write ONE complete program for the wiring below that does what the project needs.
Rules:
- The first line is exactly "#!/usr/bin/env python3".
- Then a comment block starting with "# Requirements (install with pip):" listing each pip package, one per line as "#   pip install <name>" (e.g. RPi.GPIO, smbus2, luma.oled, requests), plus any "sudo raspi-config" step needed (e.g. turn on I2C).
- Use BCM GPIO numbers EXACTLY as in the wiring below (GPIO.setmode(GPIO.BCM)); I2C parts are on bus 1.
- Small functions with clear names (e.g. read_tilt(), show_on_screen(), beep()) and a main() with the main loop.
- Wrap the main loop in try/finally and call GPIO.cleanup() (and close any I2C bus or display) in the finally block, so stopping it with Ctrl+C leaves the pins safe. Handle KeyboardInterrupt quietly.
- Plain-English comments for someone who has never coded. Use only the parts in the wiring. Put every setting in ONE clearly marked block near the top, after the imports, headed "# ===== SETTINGS: everything you may want to change =====": Wi-Fi details, API keys, topics, the exact message text that gets sent, pin numbers, timings and thresholds, each on its own line with a short comment. Nothing editable may be buried in a function - the message text in particular must be a named constant (e.g. NTFY_MESSAGE) in this block, never written inline where it is sent.
- You MUST make the code do EVERY requirement listed under "Requirements". Never silently leave one out, never replace one with a comment, and never write a comment saying something isn't possible. If a requirement truly cannot be met with this board and these parts, write NO code: return {"refuse":true,"reason":"<one plain-English sentence: which requirement, and why>"} instead.
Return ONLY a JSON object: {"code":"<the complete program>","notes":"<two to four short plain-English sentences: what it does, how to install and run it, anything to adjust>"}.`
};
PF_CODE_PROMPT.esp32ide=PF_CODE_PROMPT.arduino;// (wizard-r2) an ESP32 programmed with the Arduino IDE: the same sketch writer
// ---- (wizard-r2) Requirements: what the idea asks for is checked against the board and the power, and the code
// writer must meet every one (or refuse with a reason) - nothing is silently dropped any more.
const isIno=pf=>pf==='arduino'||pf==='esp32ide';
const POW_NAME={usb:'a USB cable',battery:'a battery inside the box',mains:'a mains adapter (a plug-in 5 V USB charger)'};
const NO_NET=/\b(i )?(don'?t|do not|no|without)( need| want)?( any| a)?( the)? ?(wi-?fi|internet|wireless)\b[^.]*/gi;
const NET_RE=/\b(my |your |the )?phone\b|send (me )?(a |an )?(message|text|notification|alert)|message (me|my)|text me|notif(y|ication)|\bsms\b|e-?mail|internet|online|weather|forecast|ntfy|home assistant|wi-?fi/i;
const PHONE_RE=/\bphone\b|message|notif|text me|\bsms\b|ntfy|e-?mail/i;
let wifiMem={ssid:'',pass:''};// typed in the Parts step; only ever written into the code made on this computer
const intentReqs=function intentReqs(it){
  it=it||intentNow()||{};const A=it.analysis||{},drop=it.dropped||[];
  let r=(A.requirements||[]).slice();
  if(!r.length&&it.desc)r=[String(it.desc)];
  if(drop.includes('wifi'))r=r.filter(x=>!NET_RE.test(String(x).replace(NO_NET,'')));
  if(intentTopic(it)&&!r.some(x=>PHONE_RE.test(x)))r.push('Send a message to the user\'s phone through ntfy.sh');
  return r;
};
const intentTopic=function intentTopic(it){
  it=it||intentNow();if(!it||(it.dropped||[]).includes('wifi'))return '';
  const v=intentInputs(it);return String(v.ntfy_topic||'').trim();
};
const netNeeded=(desc,A)=>{A=A||{};const txt=(String(desc||'')+' '+(A.requirements||[]).join(' ')).replace(NO_NET,'');return NET_RE.test(txt)||(A.extra_inputs_needed||[]).some(x=>/^(owm_api_key|ntfy_topic)$/.test(x.key));};
const copyText=function copyText(t){navigator.clipboard.writeText(t).then(()=>WF.flash('Copied'),()=>WF.flash('Couldn\'t copy: select it and press Ctrl+C.',5000));};
// Friendly suggestions when the idea mentions Wi-Fi or battery power; never blocks the user from continuing.
const capIssues=function capIssues(pf,desc,A,power,dropped){
  A=A||{};dropped=dropped||[];const out=[];
  const txt=(String(desc||'')+' '+(A.requirements||[]).join(' ')).replace(NO_NET,'');
  const net=netNeeded(desc,A);
  if(pf==='arduino'&&net&&!dropped.includes('wifi')){
    const what=PHONE_RE.test(txt)?'send a message to your phone':/weather|forecast/i.test(txt)?'get the weather from the internet':'use the internet';
    out.push({k:'wifi',block:false,msg:`Tip: Your idea mentions wanting to ${what}. An Arduino Nano doesn't have built-in Wi-Fi — switch to an ESP32 if you want wireless features!`,
      fixes:[['esp32ide','Switch to ESP32 (Arduino IDE)'],['esphome','Switch to ESP32 (ESPHome)'],['drop-wifi','Keep Arduino Nano (no Wi-Fi)']]});
  }
  const _noBat=String(desc||'').replace(/\b(no|not|without|never|don'?t need|doesn'?t need|does not need|needs? no|isn'?t needed)\b[^.,;]{0,25}\bbatter(y|ies)\b[^.,;]*/gi,' ').replace(/\bbatter(y|ies)\b[^.,;]{0,20}\b(not needed|isn'?t needed|is not needed|not required|unneeded)\b/gi,' ');
  const batWanted=/\bbatter(y|ies)\b|cordless|portable|no (power )?(cable|wires?|plug)|without (a )?(cable|plug|wires?)/i.test(_noBat);
  if(batWanted&&power!=='battery'&&!dropped.includes('battery'))
    out.push({k:'battery',block:false,msg:'Tip: Your description mentions battery power, while power below is currently set to '+POW_NAME[power]+'.',fixes:[['pow-battery','Switch to battery power'],['drop-battery','Keep '+POW_NAME[power]]]});
  if(power==='battery'&&pf==='raspberrypi')
    out.push({k:'pi-battery',block:false,msg:'Tip: A Raspberry Pi uses quite a bit of power — a small battery runs it for only a few hours.',fixes:[['pow-mains','Use a mains adapter instead'],['esphome','Switch to an ESP32']]});
  else if(power==='battery'&&net&&pf!=='arduino'&&!dropped.includes('wifi'))
    out.push({k:'wifi-battery',block:false,msg:'Tip: We set up sleep mode to save battery power between events. If you ever want it running non-stop without recharging, a USB plug-in adapter is even simpler.',fixes:[['pow-mains','Use a USB mains adapter instead']]});
  return out;
};
const capHtml=list=>list.map(c=>`<div class="capBox soft" role="status"><b>💡 ${esc(c.msg)}</b><div style="margin-top:4px">`+
  c.fixes.map(([act,label],i)=>`<button data-capfix="${act}"${!i?' class="primary"':''}>${esc(label)}</button>`).join('')+'</div></div>').join('');
// The ntfy.sh topic, big, with a copy button, easy rename, and how to get the messages on the phone.
const ntfyBox=function ntfyBox(topic){
  if(!topic)return '';
  return `<div class="ntfyBox"><b>📱 Messages to your phone</b><div>Your private topic name:</div>
<div style="display:flex;gap:6px;align-items:center;margin:5px 0"><span class="topic" style="font-size:15px;font-weight:700;letter-spacing:0.5px">${esc(topic)}</span><button data-copytext="${esc(topic)}">Copy</button><button id="btnEditTopic" class="sec" style="font-size:12px;padding:3px 8px" title="Change to your own memorable topic name">✏️ Change name</button></div>
<ol style="margin:4px 0 0;padding-left:20px"><li>Install the free <b>ntfy</b> app on your phone (App Store or Google Play).</li><li>Open it, tap <b>+</b> (Subscribe to topic) and paste this exact name. Leave the server as ntfy.sh.</li><li>Done: when your gadget sends a message, it pops up on your phone.</li></ol>
<div class="ewNote">No account is needed. Keep it secret so only you receive your device's messages.</div></div>`;
};
// The code there is now: {pf, name, text}, or null before it is written.
const currentCode=function currentCode(){
  let P=wr&&wr.plan;if(!P||P.error){P=planWiring();if(P.error)return null;}
  const pf=pfOfPlan(P),nm=esphSlug(esphForm().name||'my-device');
  if(pf==='esphome'){const r=esphomeYaml(P,esphForm());if(!r.yaml)return null;return {pf,name:nm+'.yaml',text:(wr&&wr.ai&&wr.ai.yaml)||r.yaml};}
  if(!pfCode||pfCode.pf!==pf)return null;
  return {pf,name:nm.replace(/-/g,'_')+(pf==='raspberrypi'?'.py':'.ino'),text:pfCode.code};
};
