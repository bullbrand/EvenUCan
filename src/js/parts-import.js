// ---- Fritzing parts → pins (names, roles, positions), board size and picture.
// A .fzpz file (or .fzp + .svg) works in the desktop app and in a web browser.
// Fritzing's part graphics and data are © Fritzing contributors, CC BY-SA 3.0 (noted on the imported part).
document.body.insertAdjacentHTML('beforeend','<input type="file" id="plFzIn" accept=".fzpz,.fzp,.svg" multiple style="display:none">');
// ---- Fritzing bulk import dialog
(function(){
  document.body.insertAdjacentHTML('beforeend',`
<div id="fzImBack" class="ewBack"><div class="ewWin" style="width:min(560px,95vw);min-height:300px">
  <div class="ewHead"><h2>Import Fritzing Parts</h2><button id="fzImX" class="x" title="Close">✕</button></div>
  <div id="fzImDrop" style="margin:16px;border:3px dashed #aab4cc;border-radius:12px;min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;cursor:pointer;transition:background .15s;user-select:none">
    <span style="font-size:2rem">📦</span>
    <b style="font-size:1.1em;color:#334">Drop .fzpz files here</b>
    <small style="color:#778">Or click to browse — you can drop hundreds at once</small>
  </div>
  <input type="file" id="fzImIn" accept=".fzpz" multiple style="display:none">
  <div id="fzImLog" style="margin:0 16px 8px;max-height:220px;overflow-y:auto;font-size:0.82em;font-family:monospace;background:#f6f8ff;border-radius:6px;padding:6px 10px;display:none"></div>
  <div class="ewFoot" style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px">
    <button id="fzImDone" class="primary" disabled>Done</button>
  </div>
</div></div>`);
  const back=$('fzImBack'),drop=$('fzImDrop'),inp=$('fzImIn'),log=$('fzImLog'),done=$('fzImDone'),closeBtn=$('fzImX');
  function closeDialog(){back.style.display='none';inp.value='';}
  closeBtn.onclick=closeDialog;
  back.addEventListener('click',e=>{if(e.target===back)closeDialog();});
  done.onclick=closeDialog;
  drop.onclick=()=>inp.click();
  drop.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();drop.style.background='#e8eeff';}});
  drop.addEventListener('dragleave',()=>{drop.style.background='';});
  drop.addEventListener('drop',e=>{e.preventDefault();drop.style.background='';const files=[...e.dataTransfer.files].filter(f=>/\.fzpz$/i.test(f.name));if(files.length)startImport(files);});
  inp.addEventListener('change',e=>{const files=[...e.target.files].filter(f=>/\.fzpz$/i.test(f.name));e.target.value='';if(files.length)startImport(files);});
  const rows=new Map();
  async function startImport(zFiles){
    drop.style.display='none';log.style.display='block';done.disabled=true;rows.clear();
    log.innerHTML='<div style="color:#556">Starting import of <b>'+zFiles.length+'</b> file'+(zFiles.length===1?'':'s')+'…</div>';
    // Pre-create a row for each file so progress appears immediately
    zFiles.forEach((z,i)=>{
      const row=document.createElement('div');
      row.style.cssText='padding:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#778';
      row.textContent=(i+1)+'/'+zFiles.length+' '+z.name;
      log.appendChild(row);rows.set(i,row);
    });
    log.scrollTop=log.scrollHeight;
    const result=await bulkImportFzpz(zFiles,(i,total,fname,ok,detail)=>{
      if(i<0){// storage full signal
        const r=document.createElement('div');r.style.cssText='color:#c44;font-weight:bold';r.textContent='⚠ Could not save: storage is full';log.appendChild(r);return;}
      const row=rows.get(i);if(!row)return;
      if(ok){row.style.color='#2a7';row.textContent=(i+1)+'/'+total+' '+fname+' ✓ '+String(detail).slice(0,50);}
      else{row.style.color='#c44';row.textContent=(i+1)+'/'+total+' '+fname+' — '+detail;}
      log.scrollTop=log.scrollHeight;
    });
    if(result){lay=null;renderList();}
    const summary=document.createElement('div');
    summary.style.cssText='margin-top:6px;font-weight:bold;color:'+((result&&result.failed)?'#884':'#2a7');
    summary.textContent='Done: '+(result?result.saved:0)+' part'+(result&&result.saved===1?'':'s')+' imported'+(result&&result.failed?' · '+result.failed+' failed':'');
    log.appendChild(summary);log.scrollTop=log.scrollHeight;
    done.disabled=false;drop.style.display='';
  }
})();
function guessRole(name,desc,title){
  const l=String(name||'').trim().toLowerCase(),d=String(desc||'').toLowerCase();
  if(/^(gnd|g|vss|ground|0v|v-|-|gnd\d+|agnd|dgnd)$/.test(l)||(/^ground/.test(d)&&l.length<6))return {r:'gnd'};
  if(/^(3v3|3\.3v|\+3\.3v|\+3v3|3\.3|3v)$/.test(l))return {r:'3v3'};
  if(/^(5v|\+5v|5v0|vbus|usb)$/.test(l))return {r:'5v'};
  if(/^(vin|v\s?in|raw)$/.test(l))return {r:'vin'};
  if(/^(vcc|vdd|v\+|\+|pwr|power|vs)$/.test(l)){
    // modules known to need 5 V (ultrasonic rangers), or a description that says so
    if(/\b5\s?v\b/.test(d)||/hc-?sr04|srf0?5|ultrason/i.test(title||''))return {r:'5v'};
    if(/3\.3\s?v/.test(d))return {r:'3v3'};
    return {r:'vcc'};
  }
  if(/^(nc|n\/c|n\.c\.|null|unused|dnc)$/.test(l))return {r:'nc'};
  if(/^sda/.test(l))return {r:'sda'};
  if(/^scl/.test(l))return {r:'scl'};
  if(/^trig/.test(l))return {r:'trig'};
  if(/^echo/.test(l))return {r:'echo'};
  if(/^(out|mode)$/.test(l)&&/srf0?5|ultrason|sonar/i.test(title||''))return {r:'nc'};// an ultrasonic sensor's mode pin
  let m=l.match(/^(?:gpio|io|d|p)\s*-?(\d{1,2})$/);if(m)return {r:'gpio',g:+m[1]};
  if(/^a\d{1,2}$/.test(l))return {r:'gpio'};
  if(/^(tx|txd|tx0|txo)$/.test(l))return {r:'uart_tx'};
  if(/^(rx|rxd|rx0|rxi)$/.test(l))return {r:'uart_rx'};
  if(/^(rst|reset|en|aref|ioref|boot)$/.test(l))return {r:'nc'};
  return {r:'sig'};
}
// Board size (mm), pin centres (mm from the top-left) and a picture, from a Fritzing breadboard SVG.
// The SVG is placed (hidden) on the page so its own transforms are measured exactly; scripts are removed first.
async function svgGeometry(svgText,ids,maxPx){
  const clean=String(svgText).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi,'');
  const doc=new DOMParser().parseFromString(clean,'image/svg+xml'),root=doc.documentElement;
  if(!root||root.nodeName.toLowerCase()!=='svg')return null;
  const unit=v=>{const m=String(v||'').trim().match(/^([\d.]+)\s*(in|mm|cm|pt|px)?$/i);return m?+m[1]*{in:25.4,mm:1,cm:10,pt:25.4/72,px:25.4/90}[(m[2]||'px').toLowerCase()]:null;};
  const vb=(root.getAttribute('viewBox')||'').trim().split(/[\s]+/).map(Number);
  let w=unit(root.getAttribute('width')),h=unit(root.getAttribute('height'));
  if(!w&&vb.length===4)w=vb[2]*25.4/90;if(!h&&vb.length===4)h=vb[3]*25.4/90;
  if(!(w>0&&h>0))return null;
  const svg=document.importNode(root,true);
  svg.setAttribute('width',w+'mm');svg.setAttribute('height',h+'mm');svg.setAttribute('preserveAspectRatio','none');
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-30000px;top:0;overflow:hidden;width:4000px;height:4000px';
  host.appendChild(svg);document.body.appendChild(host);
  const pos={},px=25.4/96;// CSS pixels to mm
  try{
    for(const id of ids){
      const el=svg.querySelector('[id="'+CSS.escape(id)+'"]');if(!el||!el.getBBox)continue;
      const bb=el.getBBox();let p=svg.createSVGPoint();p.x=bb.x+bb.width/2;p.y=bb.y+bb.height/2;
      p=p.matrixTransform(el.getCTM());pos[id]=[p.x*px,p.y*px];
    }
  }finally{host.remove();}
  // picture: the breadboard drawing at up to 10 px per mm
  let photo=null;
  try{
    const k=Math.min(10,(maxPx||900)/Math.max(w,h)),cw=Math.max(1,Math.round(w*k)),ch=Math.max(1,Math.round(h*k));
    svg.setAttribute('width',cw);svg.setAttribute('height',ch);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
    const im=await loadImg(url);URL.revokeObjectURL(url);
    const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cw,ch);x.drawImage(im,0,0,cw,ch);
    photo=c.toDataURL('image/jpeg',maxPx?0.8:0.85);
  }catch(e){console.warn('EvenUCan: no picture could be made from the part drawing',e);}
  return {w,h,pos,photo};
}
// Everything EvenUCan takes from a part file: its name, description, properties, pins and, from the breadboard
// picture, the board size, pin positions and a picture (maxPx: picture size). Used for importing a part, and by
// tools\build-parts-library.js to make the parts library that comes with the app.
async function fritzingData(fzpText,svgText,fileName,maxPx){
  const x=new DOMParser().parseFromString(fzpText,'application/xml');
  if(x.querySelector('parsererror'))return {error:'That part file could not be read'};
  const title=((x.querySelector('title')||{}).textContent||fileName||'Imported part').replace(/\s+/g,' ').trim();
  const conns=[...x.querySelectorAll('connectors > connector')].map(c=>{
    const p=c.querySelector('breadboardView p');
    return {name:c.getAttribute('name')||c.getAttribute('id'),desc:(c.querySelector('description')||{}).textContent||'',svgId:p&&p.getAttribute('svgId')};
  });
  if(!conns.length)return {error:'That part file has no pins'};
  // (descriptions are often a small web page: drop its style rules and tags, keep the words)
  const txt=s=>(s||'').replace(/<(style|script)[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/^\s*p,\s*li\s*\{[^}]*\}/,'').replace(/\s+/g,' ').trim(),props={};
  for(const p of x.querySelectorAll('properties > property')){const k=p.getAttribute('name'),v=txt(p.textContent);if(k&&v)props[k]=v.slice(0,80);}
  const info={title,description:txt((x.querySelector('module > description')||x.querySelector('description')||{}).textContent).slice(0,700),
    family:props.family||'',props,label:txt((x.querySelector('label')||{}).textContent).slice(0,40),file:fileName||'',
    tags:[...x.querySelectorAll('tags > tag')].map(t=>txt(t.textContent)).filter(Boolean).slice(0,20)};
  let g=null;
  if(svgText){try{g=await svgGeometry(svgText,conns.map(c=>c.svgId).filter(Boolean),maxPx);}catch(e){g=null;}}
  return {title,conns,info,g,file:fileName||''};
}
async function applyFritzing(fzpText,svgText,fileName){
  const d=await fritzingData(fzpText,svgText,fileName);
  if(d.error)return WF.flash(d.error);
  return applyFritzingData(d);
}
async function applyFritzingData(d){
  const {title,conns,info}=d,fileName=d.file,g=d.g?{...d.g}:null;
  const dd=g?g.h:20;
  const pins=conns.map(c=>{
    const r=guessRole(c.name,c.desc,title),q={n:c.name,r:r.r};if(r.g!==undefined)q.g=r.g;
    if(c.desc&&c.desc.trim()&&c.desc.trim()!==c.name)q.d=c.desc.trim().slice(0,100);// the part file's own words for the pin
    const p=g&&g.pos[c.svgId];if(p){q.x=+p[0].toFixed(2);q.y=+(dd-p[1]).toFixed(2);}
    return q;
  });
  const ctrl=pins.filter(p=>p.r==='gpio').length>=8;
  if(!ctrl)for(const p of pins)if(p.r==='gpio'){p.r='sig';delete p.g;}
  // parts made from Eagle libraries also bring their mounting holes (mm from the top-left, like the pins)
  const holes=g?(d.features||[]).filter(f=>f&&f.t==='hole').map(f=>({t:'hole',x:+(+f.x).toFixed(2),y:+(dd-f.y).toFixed(2),dia:+f.dia||3})):[];
  // a board drawn standing up is turned so its long side runs left to right, like every other part
  let turned=false;
  if(g&&g.h>g.w*1.02){const t={w:g.w,d:g.h,pins,photo:g.photo,features:holes};await turnPart(t);g.w=t.w;g.h=t.d;g.photo=t.photo;turned=true;}
  const fresh=ed.name==='New part'&&!ed.features.length&&!ed.photo;
  let all=true;
  if(!fresh){
    const c=await choose('Use the imported "'+title+'" for "'+ed.name+'":',['Pins only','Pins, size and picture','Cancel']);
    if(c<0||c===2)return;all=c===1;
  }
  ed.pins=pins;
  // what the part file says about the module, so the ESPHome file can be written for it later without asking
  ed.info=clone(info);
  if(all){
    if(fresh){ed.name=title.slice(0,80);
      const t=title.toLowerCase();ed.type=ctrl?'board':/speaker/.test(t)?'speaker':/batter|lipo/.test(t)?'battery':/switch/.test(t)?'switch':/display|oled|lcd|tft/.test(t)?'display':/mic/.test(t)?'mic':/amp/.test(t)?'amp':/charg/.test(t)?'charger':/sensor|sonar|ultrason/.test(t)?'sensor':'other';
      ed.mount=TYPES[ed.type].mount;}
    if(g){ed.shape='rect';ed.w=+g.w.toFixed(2);ed.d=+g.h.toFixed(2);if(g.photo)ed.photo=g.photo;}
    if(g&&holes.length)ed.features=[...ed.features.filter(f=>f.t!=='hole'),...holes];
    if(g)ed.acc=info&&info.credit?'drawing':'approx';// Eagle outlines are real; Fritzing pictures are for wiring diagrams
  }
  if(ctrl&&/esp32-?s3/i.test(title))ed.mcu='esp32s3';
  // each library's licence asks for its credit wherever its parts are used (Fritzing: CC BY-SA 3.0; Eagle parts carry their own)
  ed.notes=('Pins'+(all&&g?', size and picture':'')+(all&&holes.length?' and mounting holes':'')+' imported from the part "'+title+'" ('+(fileName||'parts library')+'). '+
    (info&&info.credit?'Part data from an Eagle library: '+info.credit+' Check the pin roles before wiring. The size comes from the library\'s drawn outline: measure the board before designing a box.'
      :'Part data and picture © Fritzing contributors, CC BY-SA 3.0. Check the pin roles before wiring. The picture keeps the pin spacing exact but is sometimes drawn smaller than the real board: measure the board before designing a box.')+'\n'+(ed.notes||'')).slice(0,2000);
  edDirty=true;edSel=-1;renderEditor();
  WF.flash(pins.length+' pins'+(all&&holes.length?' and '+holes.length+' mounting hole'+(holes.length>1?'s':''):'')+' imported'+(g?'':' (no picture found, so pin positions are unknown)')+(turned?', turned so the long side runs left to right':'')+'. Check each pin\'s role in the Pins list'+(all&&g?', and measure the board: these pictures are sometimes drawn smaller than the real board':'')+'. Then Save part.',9000);
}
async function bulkImportFzpz(zFiles,onProgress){
  let saved=0,failed=0;
  if(!onProgress)WF.flash('Importing '+zFiles.length+' part'+(zFiles.length===1?'':'s')+'…',60000);
  for(let _i=0;_i<zFiles.length;_i++){const z=zFiles[_i];
    try{
      const all=await WF.readZip(await z.arrayBuffer()),names=Object.keys(all),td=new TextDecoder();
      const fzpName=names.find(n=>/\.fzp$/i.test(n));
      if(!fzpName){failed++;if(onProgress)onProgress(_i,zFiles.length,z.name,false,'no .fzp inside');continue;}
      const svgName=names.find(n=>/breadboard.*\.svg$/i.test(n))||names.find(n=>/\.svg$/i.test(n));
      const d=await fritzingData(td.decode(all[fzpName]),svgName?td.decode(all[svgName]):null,z.name);
      if(d.error){failed++;if(onProgress)onProgress(_i,zFiles.length,z.name,false,d.error);continue;}
      const {title,conns,info}=d,g=d.g?{...d.g}:null;
      const dd=g?g.h:20;
      const pins=conns.map(c=>{
        const r=guessRole(c.name,c.desc,title),q={n:c.name,r:r.r};if(r.g!==undefined)q.g=r.g;
        if(c.desc&&c.desc.trim()&&c.desc.trim()!==c.name)q.d=c.desc.trim().slice(0,100);
        const p=g&&g.pos[c.svgId];if(p){q.x=+p[0].toFixed(2);q.y=+(dd-p[1]).toFixed(2);}
        return q;
      });
      const ctrl=pins.filter(p=>p.r==='gpio').length>=8;
      if(!ctrl)for(const p of pins)if(p.r==='gpio'){p.r='sig';delete p.g;}
      const holes=g?(d.features||[]).filter(f=>f&&f.t==='hole').map(f=>({t:'hole',x:+(+f.x).toFixed(2),y:+(dd-f.y).toFixed(2),dia:+f.dia||3})):[];
      if(g&&g.h>g.w*1.02){const t={w:g.w,d:g.h,pins,photo:g.photo,features:holes};await turnPart(t);g.w=t.w;g.h=t.d;g.photo=t.photo;}
      const tl=title.toLowerCase();
      const type=ctrl?'board':/speaker/.test(tl)?'speaker':/batter|lipo/.test(tl)?'battery':/switch/.test(tl)?'switch':/display|oled|lcd|tft/.test(tl)?'display':/mic/.test(tl)?'mic':/amp/.test(tl)?'amp':/charg/.test(tl)?'charger':/sensor|sonar|ultrason/.test(tl)?'sensor':'other';
      const part=tidyPart({id:newPartId(),name:title.slice(0,80),type,mount:TYPES[type].mount,
        shape:'rect',w:g?+g.w.toFixed(2):30,d:g?+g.h.toFixed(2):20,pcb:1.6,h:3,below:0,
        features:holes,acc:g?(info&&info.credit?'drawing':'approx'):undefined,
        photo:(g&&g.photo&&!onProgress)?g.photo:undefined,pins,info:clone(info),notes:
        ('Pins, size and picture imported from "'+title+'" ('+(z.name||'parts library')+').'+
        (info&&info.credit?' Part data from an Eagle library: '+info.credit+' Check pin roles.'
          :' Part data and picture © Fritzing contributors, CC BY-SA 3.0. Check pin roles.')).slice(0,2000)});
      if(ctrl&&/esp32-?s3/i.test(title))part.mcu='esp32s3';
      custom.push(part);saved++;
      if(onProgress)onProgress(_i,zFiles.length,z.name,true,title);
    }catch(e){failed++;if(onProgress)onProgress(_i,zFiles.length,z.name,false,'error');}
  }
  if(saved&&!saveLib()){if(onProgress)onProgress(-1,0,'','storage full','');else WF.flash('Imported but could not save: storage is full');return;}
  if(onProgress)return{saved,failed};
  if(saved){lay=null;renderList();WF.flash('Saved '+saved+' part'+(saved===1?'':'s')+(failed?' ('+failed+' could not be read)':''));}
  else WF.flash('Could not read '+(failed===1?'that part file':'any of those part files'));
}
// ---- Parts browser: search the parts library (or the Fritzing parts on this computer) by name, by kind,
// or by plain words for what a part does ("gyroscope", "air quality", "screen"), with a picture of each.
const PART_KINDS=[
  ['sensor','Sensors','sensor|gyro|acceleromet|imu|dof|magnetomet|compass|temperature|humidity|pressure|barometer|thermo|ultrason|sonar|distance|proximity|pir|motion|light sens|ldr|photo|lux|colou?r sens|gas|air quality|co2|smoke|alcohol|dust|moisture|soil|water|rain|flex|force|load cell|weight|hall|current sens|heart|pulse|gesture|touch'],
  ['board','Boards and controllers','arduino|esp32|esp8266|esp-|wemos|nodemcu|raspberry|pico|microcontroller|teensy|feather|itsy|qt py|lilypad|picaxe|attiny|atmega|stm32|particle|photon|xiao|micro:bit|microbit'],
  ['display','Displays','display|oled|lcd|tft|e-?paper|e-?ink|7.?segment|seven segment|matrix'],
  ['led','LEDs and lights','\\bled\\b|leds|neopixel|ws281|rgb|light strip|lamp'],
  ['motor','Motors and drivers','motor|servo|stepper|h-?bridge|driver|l298|l293|drv8|tb66|uln2003|actuator|solenoid|vibration'],
  ['input','Buttons, switches and knobs','button|switch|potentiomet|rotary|encoder|joystick|keypad|key pad|tactile|slider|knob'],
  ['sound','Sound','speaker|buzzer|piezo|microphone|\\bmic\\b|audio|amplifier|\\bamp\\b|mp3|dfplayer|sound'],
  ['radio','Wireless and communication','bluetooth|wi-?fi|wireless|radio|\\brf\\b|nrf24|lora|xbee|gps|gsm|zigbee|ethernet|can bus|rs-?485|rfid|nfc|infrared|\\bir\\b'],
  ['power','Power and batteries','battery|charger|regulator|power|boost|buck|lipo|solar|usb power|voltage source|dc-?dc'],
  ['relay','Relays','relay'],
  ['storage','Memory and clocks','sd card|micro ?sd|eeprom|flash|rtc|real.?time clock|ds3231|ds1307'],
  ['connector','Connectors and headers','connector|header|terminal|jack|socket|jst|molex|usb conn|plug|jumper|wire'],
  ['chip','Chips (ICs)','\\bic\\b|logic|op.?amp|timer|555|shift register|74hc|multiplexer|eeprom|transistor|mosfet|diode'],
  ['passive','Resistors, capacitors and similar','resistor|capacitor|inductor|crystal|oscillator|fuse|ferrite']
].map(([k,n,re])=>({k,n,re:new RegExp(re,'i')}));
// plain words people use, and the words parts are actually described with
const PART_WORDS={gyroscope:'gyro imu dof mpu',gyro:'gyro imu dof mpu',accelerometer:'accel imu dof adxl mpu lis3dh',tilt:'tilt accel imu',
  temperature:'temp thermo dht ds18b20 bme280 bmp280 lm35 tmp',temp:'temp thermo dht ds18b20',humidity:'humid dht sht aht bme280',
  distance:'distance ultrason sonar hc-sr04 srf05 vl53 tof lidar',ultrasonic:'ultrason sonar hc-sr04 srf05',motion:'motion pir hc-sr501',
  light:'light ldr photo lux bh1750 tsl',screen:'display oled lcd tft',display:'display oled lcd tft',gas:'gas mq- air quality co2',
  air:'mq- co2 ccs811 ens160 sgp tvoc voc gas',quality:'mq- co2 ccs811 ens160 sgp tvoc voc',smoke:'smoke mq-2 gas',sound:'sound microphone mic',speaker:'speaker buzzer audio',
  motor:'motor servo stepper',wifi:'wifi wi-fi esp',bluetooth:'bluetooth ble hc-05 hc-06',clock:'rtc clock ds3231 ds1307',
  weight:'load cell hx711 weight',heart:'heart pulse max30',water:'water moisture rain soil',button:'button push tactile switch',
  knob:'potentiometer rotary encoder knob',battery:'battery lipo 18650 charger',relay:'relay',gps:'gps neo-6m'};
const partText=p=>(p.title+' | '+(p.family||'')+' | '+(p.pkg||'')+' | '+(p.tags||[]).join(' ')+' | '+(p.desc||'')).toLowerCase();
const partKind=p=>{const s=p.title+' '+(p.family||'')+' '+(p.tags||[]).join(' ');return (PART_KINDS.find(k=>k.re.test(s))||{k:'other'}).k;};
function searchParts(list,q,kind){
  const words=q.toLowerCase().split(/[\s]+/).filter(Boolean);
  // each word (and the words parts use for it) must start a word in the part's text: "air" finds "air quality", not "pair"
  const wre=a=>new RegExp('(^|[^a-z0-9])'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
  const wordRes=words.map(w=>[w,[w,...(PART_WORDS[w]||'').split(' ').filter(Boolean)].map(a=>[a,wre(a)])]);
  const out=[];
  for(const p of list){
    if(kind&&kind!=='all'&&(p._kind||(p._kind=partKind(p)))!==kind)continue;
    if(!words.length){out.push([0,p]);continue;}
    const all=p._txt||(p._txt=partText(p)),title=p.title.toLowerCase(),head=(p.family+' '+(p.tags||[]).join(' ')).toLowerCase();
    let score=0,ok=true;
    for(const [w,alts] of wordRes){
      let best=0;
      for(const [a,re] of alts){const k=a===w?1:0.6;if(re.test(title))best=Math.max(best,3*k);else if(re.test(head))best=Math.max(best,2*k);else if(re.test(all))best=Math.max(best,1*k);}
      if(!best){ok=false;break;}score+=best;
    }
    if(ok)out.push([score,p]);
  }
  return out.sort((a,b)=>b[0]-a[0]||a[1].title.localeCompare(b[1].title)).map(x=>x[1]);
}
// ---- Where ready-made parts come from: the desktop app reads its own copy of parts-library.json; in a
// web browser it's the parts-library.json file the user picks once, kept in the browser's own storage (IndexedDB).
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('evenucan',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
async function idbGet(k){const d=await idb();return new Promise((res,rej)=>{const q=d.transaction('files').objectStore('files').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
async function idbSet(k,v){const d=await idb();return new Promise((res,rej)=>{const tx=d.transaction('files','readwrite');tx.objectStore('files').put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
let webLib=null;
// (r5) Bump when the shipped parts-library.json changes: a browser that kept an older copy in
// IndexedDB then refreshes it automatically instead of showing the old one for ever.
const LIB_VER='2026-11-05';
function pickLibraryFile(){
  return new Promise(done=>{
    let settled=false;const finish=v=>{if(settled)return;settled=true;window.removeEventListener('focus',onFocus);done(v);};
    const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
    inp.multiple=true;// parts-library.json, and eagle-parts.json too if it is chosen with it
    inp.onchange=async()=>{const fls=[...inp.files];if(!fls.length)return finish(null);
      try{WF.flash('Reading the parts library…',8000);
        const all=await Promise.all(fls.map(async fl=>JSON.parse(await fl.text())));
        if(all.some(x=>!x||!Array.isArray(x.parts)||!x.parts.length||!x.parts[0].conns))throw new Error('not a EvenUCan parts library');
        const j={...all[0],parts:all.flatMap(x=>x.parts)};j.ver=LIB_VER;j.made=LIB_VER;// (r5) the user chose this file: keep it as it is, no stale-library nudge later
        try{await idbSet('parts-library',j);}catch(e){WF.flash('The browser wouldn\'t keep the library, so it will ask again next time',6000);}
        WF.flash(j.parts.length+' parts loaded'+' and kept in this browser',4000);finish(j);}
      catch(e){WF.flash('That file isn\'t the parts library ('+(e.message||e)+'). Choose parts-library.json.',7000);finish(null);}};
    // Belt and braces: cancelling the file picker fires no 'change' event at all in most browsers, and a
    // click() the browser silently refused to honour (e.g. because too long had passed since the user's own
    // click) fires neither change nor focus - either way, nothing here should wait forever. The window
    // regains focus the moment any native file dialog closes, picked or not, so that's the first signal; a
    // fallback timeout covers a click() that never opened anything at all.
    const onFocus=()=>setTimeout(()=>{if(!inp.files.length)finish(null);},300);
    window.addEventListener('focus',onFocus);
    setTimeout(()=>finish(null),20000);
    inp.click();
  });
}
// (r1) When the page is served from a web server the library files sit next to it, so fetch them (relative URLs)
// instead of asking. Opened from a file (file://, e.g. a USB stick) browsers block that, so the file picker is kept.
async function fetchLibrary(){
  if(!/^https?:$/.test(location.protocol))return null;
  try{
    const get=async f=>{const r=await fetch(f,{cache:'no-cache'});if(!r.ok)throw new Error(f+': HTTP '+r.status);return r.json();};
    const main=await get('parts-library.json');
    if(!main||!Array.isArray(main.parts)||!main.parts.length)throw new Error('parts-library.json is not a parts library');
    const extra=await Promise.all(['eagle-parts.json','kicad-parts.json'].map(f=>get(f).catch(e=>{console.warn('EvenUCan: optional '+f+' not loaded',e);return null;})));
    const j={...main,parts:[main,...extra].filter(x=>x&&Array.isArray(x.parts)).flatMap(x=>x.parts)};j.ver=LIB_VER;
    try{await idbSet('parts-library',j);}catch(e){console.warn('EvenUCan: the browser would not keep the parts library',e);}
    return j;
  }catch(e){console.warn('EvenUCan: could not fetch the parts library next to the page, will ask for it',e);return null;}
}
let webLibList=null;// (r1) the search list, built the first time it is needed and reused
// (r4 fix) intentMatch() only finds out it needs the library AFTER the AI call returns (the AI decides what
// to search for) - by then the user's click is several seconds stale, and browsers can silently refuse to
// open a file picker outside a fresh click, leaving pickLibraryFile()'s promise unresolved forever ("Finding
// matching parts…" hangs). So get the library ready - from cache, or the automatic server fetch, or (only if
// neither works) the file-picker prompt - as the FIRST thing done after the click, before the AI is asked.
async function ensureLibraryReady(){
  // Parts JSON databases disconnected — AI search used instead, no file needed.
  if(window.wfNative&&window.wfNative.fritzingList)return;
}
let libAsked=false;// (r4 fix) from deep async code (not a direct click), ask at most once a session - a second
// prompt there would be just as stale-click-prone as the first one was. A direct click (freshClick=true)
// always gets its own, genuinely fresh chance, regardless of an earlier decline.
async function partsSource(ask,freshClick){
  if(window.wfNative&&window.wfNative.fritzingList)return {list:()=>window.wfNative.fritzingList(),load:id=>window.wfNative.fritzingLoad(id)};
  if(!webLib){try{const w=await idbGet('parts-library');webLib=(w&&w.ver===LIB_VER&&(!w.made||w.made===LIB_VER))?w:null;}catch(e){console.warn('EvenUCan: could not read the kept parts library',e);}}
  if(!webLib&&ask)webLib=await fetchLibrary();
  if(!webLib&&ask&&(freshClick||!libAsked)){
    libAsked=true;
    if(!confirm('In a web browser the parts library comes as a separate file, parts-library.json (it\'s with EvenUCan.html, or in the desktop app\'s folder).\n\nChoose it now? It is kept in this browser, so you only do this once.'))return null;
    webLib=await pickLibraryFile();
  }
  if(!webLib)return null;
  const P=webLib.parts;
  return {list:async()=>{
      if(!webLibList||webLibList.src!==P)webLibList={src:P,list:P.map((p,id)=>({id,title:p.title,folder:p.folder,library:true,family:p.info.family||'',pkg:((p.info.props||{}).package)||'',tags:p.info.tags||[],desc:(p.info.description||'').slice(0,300)}))};
      return webLibList.list;},
    load:async id=>{const d=P[id];if(!d)throw new Error('no such part');return {data:{title:d.title,conns:d.conns,info:d.info,g:d.g,file:d.file,features:d.features}};}};
}
let partsSrc=null;
const fzPreviewCache=new Map();
async function fzPreview(id){
  if(fzPreviewCache.has(id))return fzPreviewCache.get(id);
  const pr=(async()=>{const r=await partsSrc.load(id);
    if(r.data)return {photo:r.data.g&&r.data.g.photo,pins:r.data.conns.length,w:r.data.g&&r.data.g.w,h:r.data.g&&r.data.g.h,data:r.data};
    const photo=r.svg?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(r.svg):null;
    return {photo,pins:(r.fzp.match(/<connector\b/g)||[]).length,raw:r};})();
  fzPreviewCache.set(id,pr);return pr;
}
function pickFritzing(list,title){
  return new Promise(done=>{
    const lib=list[0]&&list[0].library,back=document.createElement('div');back.id='askBack';
    const counts={};for(const p of list){const k=p._kind||(p._kind=partKind(p));counts[k]=(counts[k]||0)+1;}
    const kinds=[...PART_KINDS,{k:'other',n:'Other'}].filter(k=>counts[k.k]).map(k=>`<option value="${k.k}">${esc(k.n)} (${counts[k.k]})</option>`).join('');
    back.innerHTML=`<div id="askBox" class="fzBox"><div class="msg"><b>${esc(title||'Parts library')}</b> · ${list.length} parts ${lib?'in the EvenUCan parts library <span class="ewNote">(from the Fritzing parts, © Fritzing contributors, CC BY-SA 3.0)</span>':'in the Fritzing parts on this computer'}</div>
<div class="fzBar"><input placeholder="Search: a part number, or what it does, e.g. gyroscope, air quality, screen" autocomplete="off"><select><option value="all">All kinds</option>${kinds}</select></div>
<div class="fzMain"><div class="fzList"></div><div class="fzPrev"><div class="ewNote">Click a part to see it here.</div></div></div>
<div class="btns"><button data-f="file">Use a .fzpz file…</button><button data-f="cancel">Cancel</button></div></div>`;
    const inp=back.querySelector('input'),sel=back.querySelector('select'),box=back.querySelector('.fzList'),prev=back.querySelector('.fzPrev');
    let cur=null,timer=0;
    const show=()=>{
      const hits=searchParts(list,inp.value,sel.value),shown=hits.slice(0,300);
      box.innerHTML=(hits.length>300?`<div class="ewNote" style="padding:4px 6px">Showing 300 of ${hits.length}: type more to narrow it down.</div>`:'')+
        shown.map(p=>`<div class="fzRow" data-id="${p.id}"><b>${esc(p.title)}</b><span class="ewNote">${esc(p.family||'')}${p.pkg?' · '+esc(p.pkg):''}</span></div>`).join('')||'<div class="ewNote" style="padding:6px">No parts match. Try another word, or "All kinds".</div>';
      if(shown[0]&&cur===null)preview(shown[0].id);
    };
    const preview=async id=>{
      cur=id;for(const r of box.querySelectorAll('.fzRow'))r.classList.toggle('on',+r.dataset.id===id);
      const p=list.find(x=>x.id===id);if(!p)return;
      prev.innerHTML=`<h4 style="margin:0 0 4px">${esc(p.title)}</h4><div class="ewNote">${esc(p.family||'')}${p.pkg?' · '+esc(p.pkg):''}</div><div class="ewRow"><button class="primary" data-f="box" title="Save this part and put it in the Enclosure Wizard's box">Add to my box</button><button data-f="use" title="Open it as a new part, to check and change before saving">Open to check first</button></div><div class="fzPic"><span class="ewNote">Loading the picture…</span></div><div class="ewNote fzDesc">${esc((p.desc||'').replace(/^\s*p,\s*li\s*\{[^}]*\}\s*/,''))}</div>`;
      try{const v=await fzPreview(id);if(cur!==id)return;
        prev.querySelector('.fzPic').innerHTML=(v.photo?`<img src="${v.photo}" alt="">`:'<span class="ewNote">No picture</span>')+`<div class="ewNote">${v.pins} pins${v.w?' · about '+Math.round(Math.max(v.w,v.h))+' × '+Math.round(Math.min(v.w,v.h))+' mm':''}</div>`;}
      catch(e){if(cur===id)prev.querySelector('.fzPic').innerHTML='<span class="ewNote">Couldn\'t read this part.</span>';}
    };
    const fin=v=>{back.remove();done(v);};
    inp.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{cur=null;show();},120);});
    sel.addEventListener('change',()=>{cur=null;show();});
    box.addEventListener('click',e=>{const r=e.target.closest('.fzRow');if(r)preview(+r.dataset.id);});
    box.addEventListener('dblclick',e=>{const r=e.target.closest('.fzRow');if(r)fin(+r.dataset.id);});
    prev.addEventListener('click',e=>{const a=e.target.dataset.f;if((a==='use'||a==='box')&&cur!==null)fin(a==='box'?{id:cur,box:true}:cur);});
    back.querySelector('[data-f=file]').onclick=()=>fin('file');back.querySelector('[data-f=cancel]').onclick=()=>fin(null);
    back.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')fin(null);if(e.key==='Enter'&&cur!==null)fin(cur);});
    document.body.appendChild(back);show();inp.focus();
  });
}
// "Browse parts…": pick a ready-made part. "Add to my box" saves it and adds it to the Enclosure Wizard in one go;
// "Open to check first" opens it as a new part to check and save.
async function browseParts(){
  // (r1) the first time, reading the library (about 28 MB) takes a moment: show that something is happening
  const btn=$('plBrowse'),label=btn.textContent,first=!webLibList&&!(window.wfNative&&window.wfNative.fritzingList);
  if(btn.disabled)return;
  if(first){btn.disabled=true;btn.textContent='Loading parts…';WF.flash('Loading the parts library…',15000);}
  let src=null,list=[];
  try{
    src=await partsSource(true,true);if(!src)return;
    partsSrc=src;fzPreviewCache.clear();
    try{list=await src.list();}catch(e){console.error('EvenUCan: could not list the parts library',e);}
  }finally{if(first){btn.disabled=false;btn.textContent=label;if(list.length)WF.flash(list.length+' parts ready',2000);else $('toast').style.display='none';}}
  if(!list.length)return WF.flash('No parts library was found');
  if(edDirty&&!confirm('Discard the changes to "'+ed.name+'"?'))return;
  let id=await pickFritzing(list,'Browse parts'),box=false;
  if(id===null)return;
  if(id&&id.box){box=true;id=id.id;}
  if(id==='file'){$('plNew').click();WF.flash('Choose a part file: .fzpz (or a .fzp together with its breadboard .svg)',6000);$('plFzIn').click();return;}
  edDirty=false;$('plNew').click();
  try{const r=await src.load(id);await (r.data?applyFritzingData(r.data):applyFritzing(r.fzp,r.svg,r.file));renderList();
    if(box){if(!savePart())return;wiz.items.push({pid:ed.id,qty:1,mount:'auto',wall:'auto'});saveWiz();lay=null;WF.flash(ed.name+' saved and added to your box',5000);openWizard();return;}
    WF.flash('Added as a new part: check its size and pins, then click Save part',6000);}
  catch(e){WF.flash('Could not read that part: '+(e.message||e));}
}
async function fritzingImport(){
  const src=await partsSource(false);// (in a browser: only if the parts library has been chosen before)
  if(src){
    partsSrc=src;fzPreviewCache.clear();
    let list=[];try{list=await src.list();}catch(e){console.error('EvenUCan: could not list the parts library',e);}
    if(list.length){
      let id=await pickFritzing(list);
      if(id===null)return;
      if(id&&id.id!==undefined)id=id.id;
      if(id!=='file'){try{const r=await src.load(id);await (r.data?applyFritzingData(r.data):applyFritzing(r.fzp,r.svg,r.file));}catch(e){WF.flash('Could not read that part: '+(e.message||e));}return;}
    }
  }
  WF.flash('Choose a part file: .fzpz (or a .fzp together with its breadboard .svg)',6000);
  $('plFzIn').click();
}
$('plFzIn').addEventListener('change',async e=>{
  const files=[...e.target.files];e.target.value='';if(!files.length)return;
  try{
    const fzpzFiles=files.filter(f=>/\.fzpz$/i.test(f.name));
    if(fzpzFiles.length>1)return bulkImportFzpz(fzpzFiles);
    const z=fzpzFiles[0];
    if(z){
      const all=await WF.readZip(await z.arrayBuffer()),names=Object.keys(all),td=new TextDecoder();
      const fzp=names.find(n=>/\.fzp$/i.test(n)),svg=names.find(n=>/breadboard.*\.svg$/i.test(n))||names.find(n=>/\.svg$/i.test(n));
      if(!fzp)return WF.flash('No part description (.fzp) inside that file');
      return applyFritzing(td.decode(all[fzp]),svg?td.decode(all[svg]):null,z.name);
    }
    const fzp=files.find(f=>/\.fzp$/i.test(f.name)),svg=files.find(f=>/\.svg$/i.test(f.name));
    if(!fzp)return WF.flash('Choose a .fzpz file, or a .fzp file (with its breadboard .svg)');
    await applyFritzing(await fzp.text(),svg?await svg.text():null,fzp.name);
  }catch(err){WF.flash('Could not read that part file: '+(err.message||err));}
});
$('wrX').onclick=$('wrClose').onclick=closeWiring;
$('wrRedo').onclick=openWiring;
$('wrTxt').onclick=()=>{if(wr)WF.download('Wiring list.txt',wiringText(),'text/plain');};
$('wrPng').onclick=wrSavePicture;

