// EvenUCan Enclosure Wizard - 03-catalogue-and-storage.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---------------------------------------------------------------- catalogue
const TYPES={
  board:{name:'Dev board / controller',mount:'floor',color:'#2f7d4f'},
  mic:{name:'Microphone',mount:'wall',color:'#7a4fb5'},
  speaker:{name:'Speaker',mount:'wall',color:'#3a4250'},
  amp:{name:'Amplifier',mount:'floor',color:'#2f5f9e'},
  charger:{name:'Charger board',mount:'floor',color:'#b03a3a'},
  battery:{name:'Battery',mount:'floor',color:'#c49a10'},
  sensor:{name:'Sensor',mount:'floor',color:'#24868a'},
  display:{name:'Display',mount:'floor',color:'#505050'},
  switch:{name:'Switch',mount:'floor',color:'#7d7d7d'},
  motor:{name:'Motor / motor driver',mount:'floor',color:'#c0602a'},
  relay:{name:'Relay / switching module',mount:'floor',color:'#a04a8a'},
  light:{name:'LED / light',mount:'floor',color:'#d4a017'},
  power:{name:'Power supply / regulator',mount:'floor',color:'#8a4a2a'},
  other:{name:'Other',mount:'floor',color:'#8a6a4a'}
};
// Colour choice for LED parts (type "light"): one part per size, the user ticks the colour.
const LED_COLOURS={red:'Red',green:'Green',yellow:'Yellow',orange:'Orange',blue:'Blue',white:'White'};
// Order the Parts Library list is split into (a kind not listed here goes last, before "Other").
const PL_ORDER=['board','sensor','display','motor','relay','light','mic','speaker','amp','charger','battery','power','switch','other'];
const typeOf=p=>TYPES[p.type]||TYPES.other;
// Feature types. x,y are the centre (mm, from the part's bottom-left corner as seen in its photo);
// edge features sit on an edge (side) at a position along it (u).
const FEAT={
  port:{name:'Port / socket',def:{kind:'USB-C',side:'xmin',u:5,zc:1.6,pw:12.5,ph:7},tip:'An opening for a plug (USB, power, jack). Usually in the wall (the part is placed with this edge against it); set "Opens through" to the lid or the floor for a socket that points up or down.'},
  switch:{name:'Switch lever',def:{side:'ymin',u:4,zc:1.8,pw:6.5,ph:3.2},tip:'A slot in the wall for a switch lever. The part is placed with this edge against a wall.'},
  antenna:{name:'Antenna',def:{side:'xmax',u:5,len:6,width:16},tip:'Kept 10 mm clear of other parts and away from batteries and speaker magnets.'},
  wire:{name:'Cable exit',def:{side:'xmax',u:5,dia:4},tip:'A notch in the nearest wall for a cable that leaves the box.'},
  mic:{name:'Mic sound hole',def:{x:5,y:5,dia:2.5},tip:'Must face outside: the part goes against a wall with a hole through it (or under a hole in the lid).'},
  cone:{name:'Speaker cone',def:{x:10,y:10,cw:30,ch:30},tip:'Gets a grille in the wall (or lid) in front of it.'},
  opening:{name:'Round opening',def:{x:5,y:5,dia:16},tip:'A round hole through the wall (or lid) the part faces, for ultrasonic transducers, IR sensors, buzzers or camera lenses. A wall part with openings faces the wall with its component side.'},
  hole:{name:'Mounting hole',def:{x:3,y:3,dia:3,mount:'screw'},tip:'Gets a screw post with a pilot hole, or a push-fit peg sized to this hole that the board drops onto (melt the tip flat afterwards to rivet it down for good).'},
  button:{name:'Button',def:{x:5,y:5,dia:4,lid:'hole',btop:3.1},tip:'Click the middle of the button. Then choose what the lid gets above it: a finger hole, a 1.5 mm hole for a paper clip (good for reset buttons), or a flex button: a springy tab in the lid with a post underneath that presses the button. For a flex button, lay the part on the table and measure from the table to the top of the button: EvenUCan works out the posts and the box itself.'},
  led:{name:'LED',def:{x:5,y:5,dia:3,poke:0},tip:'Gets a light hole in the lid above it. Set "Pokes out" to have the LEDs stand that many mm out of the lid: the part is raised on taller posts to reach, however high the box is.'},
  header:{name:'Pin header row',def:{x:10,y:2,fw:20,fd:2.54,dir:'down'},tip:'Pins are kept clear of the rails. Prototype style adds room for Dupont plugs above or below.'},
  heat:{name:'Gets hot',def:{x:5,y:5,fw:10,fd:10},tip:'Gets vent slots in the lid above it.'},
  window:{name:'Display window',def:{x:10,y:10,fw:20,fd:12},tip:'Gets a window cut in the lid.'},
  cutout:{name:'Cut-out',def:{thru:'lid',shape:'round',x:5,y:5,cw:6,ch:6,clear:0},tip:'A hole of any size, round or rectangular, through the lid, the floor or a side wall: for a jumper, reset button, SD card or anything else you need to reach or see. For one that opens through a wall, "Room behind it" keeps that whole side of the part back from the wall (e.g. screw terminals, so there\'s space for a screwdriver and wires), instead of the part sitting right up against it.'}
};
const EDGE_FEATS=['port','switch','antenna','wire'],RECT_FEATS=['cone','header','heat','window'];
const FFIELDS={port:['kind','thru','side','u','zc','pw','ph'],switch:['side','u','zc','pw','ph'],antenna:['side','u','len','width'],wire:['side','u','dia'],
  mic:['x','y','dia'],cone:['x','y','cw','ch'],opening:['x','y','dia'],hole:['x','y','dia','mount'],button:['x','y','lid','dia','btop'],led:['x','y','dia','poke'],
  header:['x','y','fw','fd','dir'],heat:['x','y','fw','fd'],window:['x','y','fw','fd'],cutout:['thru','shape','x','y','cw','ch','clear']};
const THRU={wall:'side wall',lid:'lid',floor:'floor'};
// Sits on an edge and opens through that side wall (side, u). A port set to open through the lid or the floor, and a
// cut-out through the lid or floor, sit at x,y on the part instead, like a button.
const isEdge=f=>(EDGE_FEATS.includes(f.t)&&!(f.t==='port'&&f.thru&&f.thru!=='wall'))||(f.t==='cutout'&&f.thru==='wall');
// The boxes the editor shows for a feature (ports and cut-outs change with where they open).
const fieldsOf=function fieldsOf(f){
  const wall=isEdge(f);
  if(f.t==='port')return wall?['kind','thru','side','u','zc','pw','ph']:['kind','thru','x','y','pw','ph'];
  if(f.t==='cutout')return ['thru','shape',...(wall?['side','u','zc']:['x','y']),'cw',...(f.shape==='rect'?['ch']:[]),...(wall?['clear']:[])];
  if(f.t==='button')return ['x','y','lid',...(f.lid==='pin'?[]:['dia']),...(f.lid==='flex'?['btop']:[])];
  return FFIELDS[f.t];
};
const BUTTON_LID={hole:'finger hole',pin:'paper-clip hole',flex:'flex button'};
const BUTTON_HELP={
  hole:'A finger-size hole in the lid above the button.',
  pin:'A 1.5 mm hole in the lid: push a straightened paper clip through it to press the button. Good for reset buttons.',
  flex:'One measurement: lay the part on the table and measure from the table up to the top of the button. Solder tails or pins underneath are fine: EvenUCan takes off "Pins / parts underneath" (set that once for the part), adds the posts and the box height itself, and leaves a 0.4 mm gap so it only presses when you push the tab.'};
const FLABEL={x:'X',y:'Y',dia:'Ø',cw:'Width',ch:'Height',fw:'Length',fd:'Width',u:'Along edge',zc:'Centre above PCB',pw:'Cut-out W',ph:'Cut-out H',len:'Depth',width:'Width',side:'Edge',dir:'Pins point',kind:'Type',thru:'Opens through',shape:'Shape',poke:'Pokes out (mm)',lid:'In the lid',btop:'Button top, from the table',clear:'Room behind it (mm)',mount:'Fitting'};
// Port cut-out sizes: big enough for the plug's moulded body to reach the socket.
const PORT_KINDS={'USB-C':[12.5,7],'2× USB-C':[25,8],'Micro-USB':[11,8],'Mini-USB':[11,8.5],'USB-A':[16,9],'DC barrel':[10,10],'3.5 mm jack':[7,7],'microSD':[14,3.5],'JST / wires':[7,5],'Custom':null};
const ROUND_KINDS=new Set(['DC barrel','3.5 mm jack']);
const SIDE_NAME={xmin:'Left',xmax:'Right',ymin:'Front',ymax:'Back'};
const EDGE_NAME={xmin:'left',xmax:'right',ymin:'bottom',ymax:'top'};

// ---------------------------------------------------------------- built-in parts
const BUILTIN=[
{"id":"p-esp32-devkit38","name":"ESP32 DevKit 38-pin (WROOM-32, CP2102, micro-USB)","type":"board","shape":"rect","w":54.64,"d":28.29,"pcb":1.6,"h":3.5,"below":8.5,"mount":"floor","notes":"ESP32-WROOM-32 DevKit, 38 pins (19 each side, rows 25.4 mm apart), CP2102 USB chip, micro-USB, EN and BOOT buttons, 4 corner holes. Antenna at the left end. Size is a photo estimate: measure your board. If it sits on the purple expansion board, use the \"on expansion board\" part instead of this one.","features":[{"t":"header","x":28.46,"y":26.7,"fw":48.26,"fd":2.54,"dir":"down"},{"t":"header","x":28.46,"y":1.3,"fw":48.26,"fd":2.54,"dir":"down"},{"t":"button","x":3.5,"y":6.5,"dia":4,"lid":"flex","btop":11.6},{"t":"antenna","side":"xmax","u":14,"len":6,"width":16},{"t":"port","kind":"USB-C","side":"xmin","u":14.5,"zc":1.6,"pw":12.5,"ph":7}],"pins":[{"n":"GND","r":"gnd","x":5.6,"y":26.7},{"n":"G23","r":"gpio","g":23,"x":8.14,"y":26.7},{"n":"G22","r":"gpio","g":22,"x":10.68,"y":26.7},{"n":"TXD","r":"gpio","g":1,"d":"UART TX (GPIO1), used for programming","x":13.22,"y":26.7},{"n":"RXD","r":"gpio","g":3,"d":"UART RX (GPIO3), used for programming","x":15.76,"y":26.7},{"n":"G21","r":"gpio","g":21,"x":18.3,"y":26.7},{"n":"GND","r":"gnd","x":20.84,"y":26.7},{"n":"G19","r":"gpio","g":19,"x":23.38,"y":26.7},{"n":"G18","r":"gpio","g":18,"x":25.92,"y":26.7},{"n":"G5","r":"gpio","g":5,"x":28.46,"y":26.7},{"n":"G17","r":"gpio","g":17,"x":31,"y":26.7},{"n":"G16","r":"gpio","g":16,"x":33.54,"y":26.7},{"n":"G4","r":"gpio","g":4,"x":36.08,"y":26.7},{"n":"G0","r":"gpio","g":0,"d":"Boot strapping pin: avoid for inputs that may be HIGH at power-on","x":38.62,"y":26.7},{"n":"G2","r":"gpio","g":2,"d":"Boot strapping pin: avoid for inputs that may be HIGH at power-on","x":41.16,"y":26.7},{"n":"G15","r":"gpio","g":15,"d":"Boot strapping pin: avoid for inputs that may be HIGH at power-on","x":43.7,"y":26.7},{"n":"SD1","r":"nc","d":"Flash memory pin: do not use","x":46.24,"y":26.7},{"n":"SD0","r":"nc","d":"Flash memory pin: do not use","x":48.78,"y":26.7},{"n":"CLK","r":"nc","d":"Flash memory pin: do not use","x":51.32,"y":26.7},{"n":"3V3","r":"3v3","x":5.6,"y":1.3},{"n":"EN","r":"nc","x":8.14,"y":1.3},{"n":"SP","r":"gpio","g":36,"d":"GPIO36, input only","x":10.68,"y":1.3},{"n":"SN","r":"gpio","g":39,"d":"GPIO39, input only","x":13.22,"y":1.3},{"n":"G34","r":"gpio","g":34,"d":"Input only","x":15.76,"y":1.3},{"n":"G35","r":"gpio","g":35,"d":"Input only","x":18.3,"y":1.3},{"n":"G32","r":"gpio","g":32,"x":20.84,"y":1.3},{"n":"G33","r":"gpio","g":33,"x":23.38,"y":1.3},{"n":"G25","r":"gpio","g":25,"x":25.92,"y":1.3},{"n":"G26","r":"gpio","g":26,"x":28.46,"y":1.3},{"n":"G27","r":"gpio","g":27,"x":31,"y":1.3},{"n":"G14","r":"gpio","g":14,"x":33.54,"y":1.3},{"n":"G12","r":"gpio","g":12,"d":"Boot strapping pin: avoid for inputs that may be HIGH at power-on","x":36.08,"y":1.3},{"n":"GND","r":"gnd","x":38.62,"y":1.3},{"n":"G13","r":"gpio","g":13,"x":41.16,"y":1.3},{"n":"SD2","r":"nc","d":"Flash memory pin: do not use","x":43.7,"y":1.3},{"n":"SD3","r":"nc","d":"Flash memory pin: do not use","x":46.24,"y":1.3},{"n":"CMD","r":"nc","d":"Flash memory pin: do not use","x":48.78,"y":1.3},{"n":"V5","r":"5v","x":51.32,"y":1.3}],"belowOn":8.5,"belowBare":0,"hdr":"on","acc":"measured"},
{"id":"p-d1mini","name":"Wemos D1 Mini (ESP8266)","type":"board","shape":"rect","w":34.2,"d":25.6,"pcb":1.2,"h":3.5,"below":8.5,"mount":"floor","notes":"Wemos / LOLIN D1 Mini: 34.2 x 25.6 mm, 16 pins in two rows of 8 (22.9 mm apart), USB at one end, the Wi-Fi module and its antenna at the other. Pin order checked against the maker's pinout. Pins D3, D4 and D8 decide how the board starts up, so EvenUCan leaves them free.","features":[{"t":"port","kind":"USB","side":"xmin","u":12.8,"zc":1.2,"pw":9.0,"ph":3.3},{"t":"antenna","side":"xmax","u":12.8,"len":6,"width":16},{"t":"header","x":17.71,"y":1.3,"fw":20.32,"fd":2.54,"dir":"down"},{"t":"header","x":17.71,"y":24.3,"fw":20.32,"fd":2.54,"dir":"down"}],"pins":[{"n":"RST","r":"nc","d":"reset pin: not used for wiring","x":26.6,"y":1.3},{"n":"A0","r":"gpio","g":17,"d":"the only analog input, 0 to 3.3 V","x":24.06,"y":1.3},{"n":"D0 (GPIO16)","r":"gpio","g":16,"d":"no PWM or I2C; fine for a simple on/off signal","x":21.52,"y":1.3},{"n":"D5 (GPIO14)","r":"gpio","g":14,"x":18.98,"y":1.3},{"n":"D6 (GPIO12)","r":"gpio","g":12,"x":16.44,"y":1.3},{"n":"D7 (GPIO13)","r":"gpio","g":13,"x":13.9,"y":1.3},{"n":"D8 (GPIO15)","r":"gpio","g":15,"d":"boot pin: must be LOW at power-up (kept free)","x":11.36,"y":1.3},{"n":"3V3","r":"3v3","x":8.82,"y":1.3},{"n":"TX (GPIO1)","r":"gpio","g":1,"d":"serial TX, used for programming (kept free)","x":26.6,"y":24.3},{"n":"RX (GPIO3)","r":"gpio","g":3,"d":"serial RX, used for programming (kept free)","x":24.06,"y":24.3},{"n":"D1 (GPIO5)","r":"gpio","g":5,"d":"I2C SCL","x":21.52,"y":24.3},{"n":"D2 (GPIO4)","r":"gpio","g":4,"d":"I2C SDA","x":18.98,"y":24.3},{"n":"D3 (GPIO0)","r":"gpio","g":0,"d":"boot pin: must be HIGH at power-up (kept free)","x":16.44,"y":24.3},{"n":"D4 (GPIO2)","r":"gpio","g":2,"d":"boot pin and the blue LED, must be HIGH at power-up (kept free)","x":13.9,"y":24.3},{"n":"GND","r":"gnd","x":11.36,"y":24.3},{"n":"5V","r":"5v","x":8.82,"y":24.3}],"belowOn":8.5,"belowBare":0,"hdr":"on","acc":"checked against the maker's pinout"},
{"id":"p-esp32c3-supermini","name":"ESP32-C3 Super Mini (USB-C)","type":"board","shape":"rect","w":22.52,"d":18.0,"pcb":1.2,"h":3.2,"below":8.5,"mount":"floor","notes":"ESP32-C3 Super Mini: 22.5 x 18 mm, 16 pins in two rows of 8, USB-C at one end, BOOT and RST buttons, ceramic antenna at the other end. Size and pin order checked against the ESPboards.dev pinout. Pins 2, 8, 9, 20 and 21 are boot, LED and serial pins, so EvenUCan leaves them free.","features":[{"t":"port","kind":"USB-C","side":"xmin","u":9.0,"zc":1.2,"pw":9.0,"ph":3.3},{"t":"antenna","side":"xmax","u":9.0,"len":5,"width":9},{"t":"header","x":11.29,"y":1.38,"fw":20.32,"fd":2.54,"dir":"down"},{"t":"header","x":11.29,"y":16.62,"fw":20.32,"fd":2.54,"dir":"down"}],"pins":[{"n":"5V","r":"5v","x":2.4,"y":1.38},{"n":"GND","r":"gnd","x":4.94,"y":1.38},{"n":"3V3","r":"3v3","x":7.48,"y":1.38},{"n":"GPIO4","r":"gpio","g":4,"x":10.02,"y":1.38},{"n":"GPIO3","r":"gpio","g":3,"x":12.56,"y":1.38},{"n":"GPIO2","r":"gpio","g":2,"d":"GPIO2: boot strapping pin (kept free)","x":15.1,"y":1.38},{"n":"GPIO1","r":"gpio","g":1,"x":17.64,"y":1.38},{"n":"GPIO0","r":"gpio","g":0,"x":20.18,"y":1.38},{"n":"GPIO5","r":"gpio","g":5,"x":2.4,"y":16.62},{"n":"GPIO6","r":"gpio","g":6,"x":4.94,"y":16.62},{"n":"GPIO7","r":"gpio","g":7,"x":7.48,"y":16.62},{"n":"GPIO8","r":"gpio","g":8,"d":"GPIO8: the blue LED, boot strapping pin (kept free)","x":10.02,"y":16.62},{"n":"GPIO9","r":"gpio","g":9,"d":"GPIO9: the BOOT button, boot strapping pin (kept free)","x":12.56,"y":16.62},{"n":"GPIO10","r":"gpio","g":10,"x":15.1,"y":16.62},{"n":"GPIO20","r":"gpio","g":20,"d":"GPIO20: serial RX, used for programming (kept free)","x":17.64,"y":16.62},{"n":"GPIO21","r":"gpio","g":21,"d":"GPIO21: serial TX, used for programming (kept free)","x":20.18,"y":16.62}],"belowOn":8.5,"belowBare":0,"hdr":"on","acc":"checked against the maker's pinout"},
{"id":"b-esp32s3","name":"ESP32-S3-DevKitC-1 N16R8","type":"board","shape":"rect","w":63.5,"d":27.94,"pcb":1.6,"h":3.5,"below":8.5,"mount":"floor","notes":"Two USB-C ports on the short end opposite the antenna. Header pins point down (8.5 mm). No mounting holes, so it sits on rails with end stops.","features":[{"t":"port","kind":"2× USB-C","side":"xmin","u":13.97,"zc":1.6,"pw":25,"ph":8},{"t":"antenna","side":"xmax","u":13.97,"len":6.35,"width":18},{"t":"header","x":31.4,"y":1.27,"fw":55.9,"fd":2.54,"dir":"down"},{"t":"header","x":31.4,"y":26.67,"fw":55.9,"fd":2.54,"dir":"down"},{"t":"button","x":34,"y":9.44,"dia":4,"lid":"flex","bh":1.5},{"t":"hole","x":2.4,"y":1.8,"dia":3},{"t":"hole","x":61.8,"y":26.6,"dia":3},{"t":"hole","x":61.8,"y":2.4,"dia":3},{"t":"hole","x":1.9,"y":27.3,"dia":3}],"pins":[{"n":"3V3","r":"3v3","x":58.07,"y":26.67,"h":"J1-1"},{"n":"3V3","r":"3v3","x":55.53,"y":26.67,"h":"J1-2"},{"n":"RST","r":"nc","x":52.99,"y":26.67,"h":"J1-3"},{"n":"GPIO4","r":"gpio","g":4,"x":50.45,"y":26.67,"h":"J1-4"},{"n":"GPIO5","r":"gpio","g":5,"x":47.91,"y":26.67,"h":"J1-5"},{"n":"GPIO6","r":"gpio","g":6,"x":45.37,"y":26.67,"h":"J1-6"},{"n":"GPIO7","r":"gpio","g":7,"x":42.83,"y":26.67,"h":"J1-7"},{"n":"GPIO15","r":"gpio","g":15,"x":40.29,"y":26.67,"h":"J1-8"},{"n":"GPIO16","r":"gpio","g":16,"x":37.75,"y":26.67,"h":"J1-9"},{"n":"GPIO17","r":"gpio","g":17,"x":35.21,"y":26.67,"h":"J1-10"},{"n":"GPIO18","r":"gpio","g":18,"x":32.67,"y":26.67,"h":"J1-11"},{"n":"GPIO8","r":"gpio","g":8,"x":30.13,"y":26.67,"h":"J1-12"},{"n":"GPIO3","r":"gpio","g":3,"x":27.59,"y":26.67,"h":"J1-13"},{"n":"GPIO46","r":"gpio","g":46,"x":25.05,"y":26.67,"h":"J1-14"},{"n":"GPIO9","r":"gpio","g":9,"x":22.51,"y":26.67,"h":"J1-15"},{"n":"GPIO10","r":"gpio","g":10,"x":19.97,"y":26.67,"h":"J1-16"},{"n":"GPIO11","r":"gpio","g":11,"x":17.43,"y":26.67,"h":"J1-17"},{"n":"GPIO12","r":"gpio","g":12,"x":14.89,"y":26.67,"h":"J1-18"},{"n":"GPIO13","r":"gpio","g":13,"x":12.35,"y":26.67,"h":"J1-19"},{"n":"GPIO14","r":"gpio","g":14,"x":9.81,"y":26.67,"h":"J1-20"},{"n":"5V","r":"5v","x":7.27,"y":26.67,"h":"J1-21"},{"n":"GND","r":"gnd","x":4.73,"y":26.67,"h":"J1-22"},{"n":"GND","r":"gnd","x":58.07,"y":1.27,"h":"J3-1"},{"n":"TX (GPIO43)","r":"gpio","g":43,"x":55.53,"y":1.27,"h":"J3-2"},{"n":"RX (GPIO44)","r":"gpio","g":44,"x":52.99,"y":1.27,"h":"J3-3"},{"n":"GPIO1","r":"gpio","g":1,"x":50.45,"y":1.27,"h":"J3-4"},{"n":"GPIO2","r":"gpio","g":2,"x":47.91,"y":1.27,"h":"J3-5"},{"n":"GPIO42","r":"gpio","g":42,"x":45.37,"y":1.27,"h":"J3-6"},{"n":"GPIO41","r":"gpio","g":41,"x":42.83,"y":1.27,"h":"J3-7"},{"n":"GPIO40","r":"gpio","g":40,"x":40.29,"y":1.27,"h":"J3-8"},{"n":"GPIO39","r":"gpio","g":39,"x":37.75,"y":1.27,"h":"J3-9"},{"n":"GPIO38","r":"gpio","g":38,"x":35.21,"y":1.27,"h":"J3-10"},{"n":"GPIO37","r":"gpio","g":37,"x":32.67,"y":1.27,"h":"J3-11"},{"n":"GPIO36","r":"gpio","g":36,"x":30.13,"y":1.27,"h":"J3-12"},{"n":"GPIO35","r":"gpio","g":35,"x":27.59,"y":1.27,"h":"J3-13"},{"n":"GPIO0","r":"gpio","g":0,"x":25.05,"y":1.27,"h":"J3-14"},{"n":"GPIO45","r":"gpio","g":45,"x":22.51,"y":1.27,"h":"J3-15"},{"n":"GPIO48","r":"gpio","g":48,"x":19.97,"y":1.27,"h":"J3-16"},{"n":"GPIO47","r":"gpio","g":47,"x":17.43,"y":1.27,"h":"J3-17"},{"n":"GPIO21","r":"gpio","g":21,"x":14.89,"y":1.27,"h":"J3-18"},{"n":"GPIO20","r":"gpio","g":20,"x":12.35,"y":1.27,"h":"J3-19"},{"n":"GPIO19","r":"gpio","g":19,"x":9.81,"y":1.27,"h":"J3-20"},{"n":"GND","r":"gnd","x":7.27,"y":1.27,"h":"J3-21"},{"n":"GND","r":"gnd","x":4.73,"y":1.27,"h":"J3-22"}]},
{"id":"b-lipo1000","name":"LiPo 3.7 V 1000 mAh (503450)","type":"battery","shape":"rect","w":50,"d":34,"pcb":0,"h":5.5,"below":0,"mount":"floor","notes":"Flat pouch cell, about 50 × 34 × 5 mm. Pouch cells vary, so measure yours.","features":[],"pins":[{"n":"+ (red)","r":"bat+","x":50,"y":21},{"n":"− (black)","r":"bat-","x":50,"y":13}]},
{"id":"b-tp4056c","name":"TP4056 Li-ion charger (USB-C)","type":"charger","shape":"rect","w":28,"d":17.5,"pcb":1.6,"h":3.3,"below":1.5,"mount":"floor","notes":"Typical TP4056 module with battery protection. Check the size and LED positions against your board.","features":[{"t":"port","kind":"USB-C","side":"xmin","u":8.75,"zc":1.6,"pw":12.5,"ph":7},{"t":"led","x":15,"y":3,"dia":3},{"t":"led","x":15,"y":14.5,"dia":3}],"pins":[{"n":"IN+","r":"nc","x":2,"y":15.5},{"n":"IN−","r":"nc","x":2,"y":2},{"n":"OUT+","r":"chg_out+","x":26,"y":15.5},{"n":"B+","r":"chg_b+","x":26,"y":11},{"n":"B−","r":"chg_b-","x":26,"y":6.5},{"n":"OUT−","r":"chg_out-","x":26,"y":2}]},
{"id":"b-18650","name":"18650 cell","type":"battery","shape":"rect","w":66,"d":19,"pcb":0,"h":19,"below":0,"mount":"floor","notes":"Ø18.5 × 65 mm cylinder (protected cells can be 69 mm long). Use the size of the holder if you use one.","features":[],"pins":[{"n":"+","r":"bat+","x":66,"y":9.5},{"n":"−","r":"bat-","x":0,"y":9.5}]},
{"id":"b-ss12","name":"Mini slide switch (SS12D00)","type":"switch","shape":"rect","w":8.6,"d":4.4,"pcb":0,"h":3.6,"below":0,"mount":"floor","notes":"The lever pokes out through a slot in the wall. Glue the switch body into its holder.","features":[{"t":"switch","side":"ymin","u":4.3,"zc":1.8,"pw":6.5,"ph":3.2}],"pins":[{"n":"A","r":"sw_a","x":1.8,"y":4.4},{"n":"COM","r":"sw_com","x":4.3,"y":4.4},{"n":"B","r":"nc","x":6.8,"y":4.4}]},
{"id":"p-mvvkfthdqtf5","name":"NANO FOOTPRINT (NANO)","type":"board","shape":"rect","w":43.18,"d":17.87,"pcb":1.6,"h":3,"below":0,"mount":"floor","features":[],"pins":[{"n":"D5","r":"gpio","g":5,"x":21.59,"y":16.56},{"n":"D4","r":"gpio","g":4,"x":24.13,"y":16.56},{"n":"D3","r":"gpio","g":3,"x":26.67,"y":16.56},{"n":"D2","r":"gpio","g":2,"x":29.21,"y":16.56},{"n":"GND","r":"gnd","x":31.75,"y":16.56},{"n":"RESET","r":"nc","x":34.29,"y":16.56},{"n":"D6","r":"gpio","g":6,"x":19.05,"y":16.56},{"n":"D7","r":"gpio","g":7,"x":16.51,"y":16.56},{"n":"D8","r":"gpio","g":8,"x":13.97,"y":16.56},{"n":"D9","r":"gpio","g":9,"x":11.43,"y":16.56},{"n":"D10","r":"gpio","g":10,"x":8.89,"y":16.56},{"n":"D11","r":"gpio","g":11,"x":6.35,"y":16.56},{"n":"D12","r":"gpio","g":12,"x":3.81,"y":16.56},{"n":"D0/RX","r":"sig","x":36.83,"y":16.56},{"n":"D1/TX","r":"sig","x":39.37,"y":16.56},{"n":"A4/SDA","r":"sig","x":21.59,"y":1.32},{"n":"A3","r":"gpio","x":19.05,"y":1.32},{"n":"A2","r":"gpio","x":16.51,"y":1.32},{"n":"A1","r":"gpio","x":13.97,"y":1.32},{"n":"A0","r":"gpio","x":11.43,"y":1.32},{"n":"AREF","r":"nc","x":8.89,"y":1.32},{"n":"A5/SCL","r":"sig","x":24.13,"y":1.32},{"n":"A6","r":"gpio","x":26.67,"y":1.32},{"n":"A7","r":"gpio","x":29.21,"y":1.32},{"n":"5V","r":"5v","x":31.75,"y":1.32},{"n":"RESET","r":"nc","x":34.29,"y":1.32},{"n":"GND","r":"gnd","x":36.83,"y":1.32},{"n":"VIN","r":"vin","x":39.37,"y":1.32},{"n":"3V3","r":"3v3","x":6.35,"y":1.32},{"n":"D13","r":"gpio","g":13,"x":3.81,"y":1.32}],"info":{"title":"NANO FOOTPRINT (NANO)","description":"Generic Nano Footprint Board 17.9 x 43.2 mm, 30 pins. From SparkFun-Boards.lbr (SparkFun Eagle Libraries), CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).","family":"Controller boards","props":{"family":"Controller boards","library":"SparkFun-Boards","package":"NANO"},"label":"","file":"SparkFun-Boards.lbr","tags":["SparkFun-Boards","Eagle","Controller boards"],"credit":"From SparkFun-Boards.lbr (SparkFun Eagle Libraries), CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)."},"notes":"Pins, size and picture imported from the part \"NANO FOOTPRINT (NANO)\" (SparkFun-Boards.lbr / NANO). Part data from an Eagle library: From SparkFun-Boards.lbr (SparkFun Eagle Libraries), CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Check the pin roles before wiring. The size comes from the library's drawn outline: measure the board before designing a box.\n"},
{"name":"ES32A08 8-Relay ESP32 Industrial Expansion Board","type":"board","shape":"rect","w":180,"d":72,"pcb":1.6,"h":17.4,"below":0,"mount":"floor","acc":"drawing","hdr":"on","belowOn":0,"belowBare":0,"features":[{"t":"hole","x":3,"y":3,"dia":3},{"t":"hole","x":177.5,"y":3,"dia":3},{"t":"hole","x":3,"y":69,"dia":3},{"t":"hole","x":177.5,"y":69,"dia":3},{"t":"cutout","shape":"round","cw":12.5,"ch":12.5,"side":"ymin","u":15,"zc":8.7,"thru":"wall","clear":10,"x":5,"y":5},{"t":"cutout","shape":"round","cw":12.5,"ch":12.5,"side":"ymin","u":40,"zc":8.7,"thru":"wall","clear":10,"x":5,"y":5},{"t":"cutout","shape":"round","cw":12.5,"ch":12.5,"side":"ymin","u":65,"zc":8.7,"thru":"wall","clear":10,"x":5,"y":5},{"t":"cutout","shape":"round","cw":12.5,"ch":12.5,"side":"ymin","u":90,"zc":8.7,"thru":"wall","clear":10,"x":5,"y":5},{"t":"cutout","shape":"round","cw":12.5,"ch":12.5,"side":"ymin","u":115,"zc":8.7,"thru":"wall","clear":10,"x":5,"y":5}],"pins":[{"n":"GND","x":10,"y":2,"r":"gnd"},{"n":"IN1","x":15.08,"y":2,"r":"sig"},{"n":"IN2","x":20.16,"y":2,"r":"sig"},{"n":"IN3","x":25.24,"y":2,"r":"sig"},{"n":"IN4","x":30.32,"y":2,"r":"sig"},{"n":"IN5","x":35.4,"y":2,"r":"sig"},{"n":"IN6","x":40.48,"y":2,"r":"sig"},{"n":"IN7","x":45.56,"y":2,"r":"sig"},{"n":"IN8","x":50.64,"y":2,"r":"sig"},{"n":"NO4","x":100,"y":2,"r":"sig"},{"n":"COM4","x":105.08,"y":2,"r":"sig"},{"n":"NC4","x":110.16,"y":2,"r":"sig"},{"n":"NO3","x":115.24,"y":2,"r":"sig"},{"n":"COM3","x":120.32,"y":2,"r":"sig"},{"n":"NC3","x":125.4,"y":2,"r":"sig"},{"n":"NO2","x":130.48,"y":2,"r":"sig"},{"n":"COM2","x":135.56,"y":2,"r":"sig"},{"n":"NC2","x":140.64,"y":2,"r":"sig"},{"n":"NO1","x":145.72,"y":2,"r":"sig"},{"n":"COM1","x":150.8,"y":2,"r":"sig"},{"n":"NC1","x":155.88,"y":2,"r":"sig"},{"n":"GND","x":10,"y":70,"r":"gnd"},{"n":"V4","x":15.08,"y":70,"r":"sig"},{"n":"GND","x":20.16,"y":70,"r":"gnd"},{"n":"V3","x":25.24,"y":70,"r":"sig"},{"n":"GND","x":30.32,"y":70,"r":"gnd"},{"n":"V2","x":35.4,"y":70,"r":"sig"},{"n":"GND","x":40.48,"y":70,"r":"gnd"},{"n":"V1","x":45.56,"y":70,"r":"sig"},{"n":"GND","x":50.64,"y":70,"r":"gnd"},{"n":"I4","x":55.72,"y":70,"r":"sig"},{"n":"GND","x":60.8,"y":70,"r":"gnd"},{"n":"I3","x":65.88,"y":70,"r":"sig"},{"n":"GND","x":70.96,"y":70,"r":"gnd"},{"n":"I2","x":76.04,"y":70,"r":"sig"},{"n":"GND","x":81.12,"y":70,"r":"gnd"},{"n":"I1","x":86.2,"y":70,"r":"sig"},{"n":"B-","x":91.28,"y":70,"r":"sig"},{"n":"A+","x":96.36,"y":70,"r":"sig"},{"n":"GND","x":101.44,"y":70,"r":"gnd"},{"n":"VIN","x":106.52,"y":70,"r":"vin"},{"n":"NO8","x":115,"y":70,"r":"sig"},{"n":"COM8","x":120.08,"y":70,"r":"sig"},{"n":"NC8","x":125.16,"y":70,"r":"sig"},{"n":"NO7","x":130.24,"y":70,"r":"sig"},{"n":"COM7","x":135.32,"y":70,"r":"sig"},{"n":"NC7","x":140.4,"y":70,"r":"sig"},{"n":"NO6","x":145.48,"y":70,"r":"sig"},{"n":"COM6","x":150.56,"y":70,"r":"sig"},{"n":"NC6","x":155.64,"y":70,"r":"sig"},{"n":"NO5","x":160.72,"y":70,"r":"sig"},{"n":"COM5","x":165.8,"y":70,"r":"sig"},{"n":"NC5","x":170.88,"y":70,"r":"sig"}],"notes":"ES32A08: an ESP32-DevKitC (38-pin WROOM-32) plugs into this board's own on-board socket, so this part models the WHOLE assembly (carrier + ESP32) as one footprint - don't add a separate ESP32 board for it. There are no exposed raw GPIO terminals: every screw terminal is a dedicated function (relay, input, analog or power) wired internally by the board's own shift registers.\nSize (180 x 72 x 19mm bare / 20mm with the DIN-rail shell) is from the maker's spec sheet.\nPin names, groups and which edge they're on were read directly off the user's own close-up photos of the real board (not just the maker's GitHub page), so they're solid: bottom edge = GND+IN1-8 (opto inputs) then NO4/COM4/NC4...NO1/COM1/NC1 (relays 1-4); top edge = GND/V1-4 (0-10V in) / GND/I1-4 (4-20mA in) / B-,A+ (RS485) / GND,VIN (power in) then NO8/COM8/NC8...NO5/COM5/NC5 (relays 5-8).\nMounting holes: 4 corners, Ø3mm, hole edge 1.5mm from the board edge on the left side and 1mm on the right (same top and bottom) - measured directly by the user, so these are solid.\nPin POSITIONS are still an estimate: evenly spaced at a standard 5.08mm terminal pitch along the edge they're on, not measured with calipers. Measure your actual board and use 'Check size...' before cutting anything tight. 4-20mA maps to GPIO36/39/34/35 and 0-10V to GPIO32/33/25/26 internally, per the maker's spec, in case you ever need to reflash the firmware.\n\nCable entry: 5 PG7 glands (12.5mm holes), evenly spaced along ONE wall (all on the 'ymin' side) - WaughForm can't put wall cut-outs on two OPPOSITE edges of the same part at once (it would need an exact non-integer box size to touch both walls, which auto-sizing can't hit), so all 5 looms enter through a single cable-entry panel instead of splitting across both long edges. Wire from each gland to its actual terminal (power/VIN, or a jack's relay+input) inside the box by hand; the gland positions aren't tied to specific pins.","edgeClear":{"ymax":10},"id":"p-mvwmge9fx4ak"},
{"id":"p-mvzgm549177o","name":"Arduino UNO R4 WiFi","type":"board","shape":"rect","w":68.6,"d":53.3,"pcb":1.6,"h":11,"below":0,"mount":"floor","features":[{"t":"hole","x":15.24,"y":50.8,"dia":3.2,"mount":"screw"},{"t":"hole","x":13.97,"y":2.54,"dia":3.2,"mount":"screw"},{"t":"hole","x":66.04,"y":7.62,"dia":3.2,"mount":"screw"},{"t":"hole","x":66.04,"y":35.56,"dia":3.2,"mount":"screw"},{"t":"port","kind":"USB-C","side":"xmin","u":37.8,"zc":1.5,"pw":12.5,"ph":7},{"t":"port","kind":"DC barrel","side":"xmin","u":7.8,"zc":4.5,"pw":10,"ph":10},{"t":"port","kind":"Custom","side":"ymin","u":35,"zc":1,"pw":12.5,"ph":7},{"t":"button","x":6.5,"y":49.3,"dia":3.5,"lid":"hole","btop":3.1},{"t":"window","x":46,"y":26,"fw":18,"fd":12},{"t":"led","x":62,"y":12,"dia":1,"poke":0},{"t":"led","x":62,"y":15,"dia":1,"poke":0},{"t":"led","x":62,"y":18,"dia":1,"poke":0},{"t":"led","x":25,"y":45,"dia":1,"poke":0},{"t":"port","kind":"JST / wires","side":"xmax","u":14.3,"zc":1.6,"pw":7,"ph":5}],"belowOn":0,"belowBare":0,"hdr":"off","acc":"drawing","notes":"Standard Arduino Uno form factor with USB-C, DC barrel jack, and 8x12 LED matrix.\nSizes read by AI from \"ABX00087-full-pinout.pdf\" on 11/2/2026. Check them before printing.\nStandard Arduino Uno form factor with added 12x8 LED matrix and Qwiic connector.\nSizes read by AI from \"uno R4 wifi.jpg\" on 11/2/2026. Check them before printing.\nStandard Arduino Uno form factor with USB-C and 12x8 LED matrix.\nSizes read by AI from the AI's own knowledge of \"Arduino UNO R4 WiFi\" (no web pages) on 11/2/2026. Check them before printing.\nStandard Arduino Uno form factor with USB-C, 12x8 LED matrix, and Qwiic connector.\nSizes read by AI from \"uno R4 wifi.jpg\" on 11/2/2026. Check them before printing.","pins":[{"n":"D19/SCL","r":"scl","x":17.78,"y":50.8},{"n":"D18/SDA","r":"sda","x":20.32,"y":50.8},{"n":"AREF","r":"sig","x":22.86,"y":50.8},{"n":"GND","r":"gnd","x":25.4,"y":50.8},{"n":"D13","r":"sig","x":27.94,"y":50.8},{"n":"D12","r":"sig","x":30.48,"y":50.8},{"n":"~D11","r":"sig","x":33.02,"y":50.8},{"n":"~D10","r":"sig","x":35.56,"y":50.8},{"n":"~D9","r":"sig","x":38.1,"y":50.8},{"n":"D8","r":"sig","x":40.64,"y":50.8},{"n":"D7","r":"sig","x":45.72,"y":50.8},{"n":"~D6","r":"sig","x":48.26,"y":50.8},{"n":"~D5","r":"sig","x":50.8,"y":50.8},{"n":"D4","r":"sig","x":53.34,"y":50.8},{"n":"~D3","r":"sig","x":55.88,"y":50.8},{"n":"D2","r":"sig","x":58.42,"y":50.8},{"n":"D1/TX","r":"sig","x":60.96,"y":50.8},{"n":"D0/RX","r":"sig","x":63.5,"y":50.8},{"n":"NC","r":"nc","x":25.4,"y":2.54},{"n":"IOREF","r":"sig","x":27.94,"y":2.54},{"n":"RESET","r":"sig","x":30.48,"y":2.54},{"n":"3V3","r":"3v3","x":33.02,"y":2.54},{"n":"5V","r":"5v","x":35.56,"y":2.54},{"n":"GND","r":"gnd","x":38.1,"y":2.54},{"n":"GND","r":"gnd","x":40.64,"y":2.54},{"n":"VIN","r":"vin","x":43.18,"y":2.54},{"n":"A0","r":"sig","x":50.8,"y":2.54},{"n":"A1","r":"sig","x":53.34,"y":2.54},{"n":"A2","r":"sig","x":55.88,"y":2.54},{"n":"A3","r":"sig","x":58.42,"y":2.54},{"n":"A4","r":"sda","x":60.96,"y":2.54},{"n":"A5","r":"scl","x":63.5,"y":2.54}]}
];
// Boards checked against the maker's own drawing with tools/curate-parts.js (src/js/parts-curated.js, made by build.js)
if(typeof CURATED_PARTS!=='undefined')for(const c of CURATED_PARTS)BUILTIN.push(c);
// Old built-ins that a curated part now replaces: dropped from the list. Projects saved with the old id are pointed at the curated one.
const DUP_ALIAS={'p-mvzgm549177o':'c-arduino-uno-r4-wifi','p-mvvkfthdqtf5':'c-arduino-nano-a000005'};
for(let i=BUILTIN.length-1;i>=0;i--)if(DUP_ALIAS[BUILTIN[i].id]&&BUILTIN.some(b=>b.id===DUP_ALIAS[BUILTIN[i].id]))BUILTIN.splice(i,1);
for(const b of BUILTIN)b.builtin=true;
// ---- pins, for the wiring diagram. x,y: position on the part (mm, same frame as its features; approximate
// where the maker gives no drawing). r: the pin's role, which the wiring rules work from (see ROLES).
const hdr=(names,y,x1,step)=>names.map((n,i)=>({n,x:+(x1-i*step).toFixed(2),y}));
const s3=n=>/^\d+$/.test(n)?{n:'GPIO'+n,r:'gpio',g:+n}:n==='TX'?{n:'TX (GPIO43)',r:'gpio',g:43}:n==='RX'?{n:'RX (GPIO44)',r:'gpio',g:44}:
  n==='3V3'?{n,r:'3v3'}:n==='5V'?{n:'5V',r:'5v'}:n==='G'?{n:'GND',r:'gnd'}:{n,r:'nc'};
const BUILTIN_PINS={
  // Espressif ESP32-S3-DevKitC-1 v1.1 user guide: J1 along the top edge here, J3 along the bottom, pin 1 at the antenna end
  'b-esp32s3':[...hdr(['3V3','3V3','RST','4','5','6','7','15','16','17','18','8','3','46','9','10','11','12','13','14','5V','G'],26.67,58.07,2.54).map((p,i)=>({...s3(p.n),x:p.x,y:p.y,h:'J1-'+(i+1)})),
               ...hdr(['G','TX','RX','1','2','42','41','40','39','38','37','36','35','0','45','48','47','21','20','19','G','G'],1.27,58.07,2.54).map((p,i)=>({...s3(p.n),x:p.x,y:p.y,h:'J3-'+(i+1)}))],
  'b-inmp441':[{n:'SCK',r:'mic_sck',x:2.5,y:9},{n:'WS',r:'mic_ws',x:7,y:11.5},{n:'L/R',r:'mic_lr',x:11.5,y:9},{n:'SD',r:'mic_sd',x:2.5,y:5},{n:'VDD',r:'3v3',x:7,y:2.5},{n:'GND',r:'gnd',x:11.5,y:5}],
  'b-max98357':[...['LRC','BCLK','DIN','GAIN','SD','GND','Vin'].map((n,i)=>({n,x:+(1.23+i*2.54).toFixed(2),y:1.6,r:{LRC:'amp_lrc',BCLK:'amp_bclk',DIN:'amp_din',GAIN:'amp_gain',SD:'amp_sd',GND:'gnd',Vin:'vin'}[n]})),
    {n:'Speaker +',r:'amp_out+',x:6,y:17},{n:'Speaker −',r:'amp_out-',x:11.7,y:17}],
  'b-spk3w':[{n:'+ (red)',r:'spk+',x:31.9,y:0},{n:'− (black)',r:'spk-',x:37.9,y:0}],
  'b-tp4056c':[{n:'IN+',r:'nc',x:2,y:15.5},{n:'IN−',r:'nc',x:2,y:2},{n:'OUT+',r:'chg_out+',x:26,y:15.5},{n:'B+',r:'chg_b+',x:26,y:11},{n:'B−',r:'chg_b-',x:26,y:6.5},{n:'OUT−',r:'chg_out-',x:26,y:2}],
  'b-lipo1000':[{n:'+ (red)',r:'bat+',x:50,y:21},{n:'− (black)',r:'bat-',x:50,y:13}],
  'b-18650':[{n:'+',r:'bat+',x:66,y:9.5},{n:'−',r:'bat-',x:0,y:9.5}],
  'b-ss12':[{n:'A',r:'sw_a',x:1.8,y:4.4},{n:'COM',r:'sw_com',x:4.3,y:4.4},{n:'B',r:'nc',x:6.8,y:4.4}]
};
for(const b of BUILTIN){if(BUILTIN_PINS[b.id])b.pins=BUILTIN_PINS[b.id];if(b.id==='b-esp32s3')b.mcu='esp32s3';if(b.id==='p-esp32-devkit38'){b.mcu='esp32';b.i2c=[21,22];}if(b.id==='p-esp32c3-supermini'){b.mcu='esp32c3';b.i2c=[6,7];}if(b.id==='p-d1mini'){b.mcu='esp8266';b.i2c=[4,5];}}

// ---------------------------------------------------------------- library storage
const LIB_KEY='parts';
// (r1) If the saved parts can't be read, don't carry on with an empty list: the next save would overwrite (lose)
// them all. Keep a copy under 'parts.damaged', stop saving over them this session, and tell the user.
let libDamaged=false;
const readCustom=function readCustom(){
  // Support chunked storage: opensketch.parts.0, .1, … assembled in order
  let raw=WF.store.get(LIB_KEY);
  if(raw==null){
    // try chunked
    let chunks=[],i=0;
    while(true){const c=WF.store.get(LIB_KEY+'.'+i);if(c==null)break;chunks.push(c);i++;}
    if(chunks.length)raw='['+chunks.map(c=>c.slice(1,-1)).join(',')+']';
  }
  try{const a=JSON.parse(raw||'[]');libDamaged=false;return Array.isArray(a)?a.filter(p=>p&&p.id):[];}
  catch(e){
    console.error('EvenUCan: the saved parts could not be read',e);libDamaged=true;
    if(raw&&WF.store.get(LIB_KEY+'.damaged')==null)WF.store.trySet(LIB_KEY+'.damaged',raw);
    setTimeout(()=>WF.flash('⚠ Your saved parts could not be read. They have been left untouched (a copy is kept); new parts won\'t be saved until EvenUCan is restarted.',10000),800);
    return [];
  }
};
// Sidecars: top photos (evp.) and product thumbnail images (evi.) stored per-part
const EVP='evp.', EVI='evi.';
const builtinById=id=>BUILTIN.find(b=>b.id===id);
const photoGet=function photoGet(id){try{return localStorage.getItem(EVP+id)||null;}catch(e){return null;}};
const photoSave=function photoSave(id,url){try{localStorage.setItem(EVP+id,url);return true;}catch(e){return false;}};
const photoDel=function photoDel(id){try{localStorage.removeItem(EVP+id);}catch(e){}};

const imgGet=function imgGet(id){try{return localStorage.getItem(EVI+id)||null;}catch(e){return null;}};
const imgSave=function imgSave(id,url){try{localStorage.setItem(EVI+id,url);return true;}catch(e){return false;}};
const imgDel=function imgDel(id){try{localStorage.removeItem(EVI+id);}catch(e){}};

const injectPhotos=function injectPhotos(parts){
  parts.forEach(p=>{
    const ph=photoGet(p.id);if(ph&&!p.photo)p.photo=ph;
    const im=imgGet(p.id);if(im&&!p.img)p.img=im;
  });
};
let custom=readCustom();injectPhotos(custom);
// Migrate: if parts loaded with embedded photos (from older WaughForm 3D format), save to sidecar keys
(()=>{let migrated=0;custom.forEach(p=>{if(p.photo&&p.photo.startsWith('data:')&&!photoGet(p.id)){photoSave(p.id,p.photo);migrated++;}});if(migrated)console.log('EvenUCan: migrated '+migrated+' embedded photos to sidecar keys');})();
// Clean up and sanitize: move any product images accidentally stored as top photos over to evi.*, and clear duplicate/stale entries
(()=>{
  try{
    // 1. Move old evp.* product images to evi.* and remove evp.* for builtin parts
    const toMigrate=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith(EVP)){
        const id=k.slice(EVP.length);
        const val=localStorage.getItem(k);
        toMigrate.push({id,val});
      }
    }
    toMigrate.forEach(({id,val})=>{
      if(!imgGet(id)) imgSave(id,val);
      if(builtinById(id)) photoDel(id);
    });

    // 2. Sanitize duplicates: if any image dataUrl was stamped across multiple parts (due to earlier thumbCache bug), remove the duplicates
    const valCounts={}, valKeys={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith(EVI)){
        const val=localStorage.getItem(k);
        if(val){
          valCounts[val]=(valCounts[val]||0)+1;
          valKeys[val]=valKeys[val]||[];
          valKeys[val].push(k);
        }
      }
    }
    for(const [val,count] of Object.entries(valCounts)){
      if(count>1){
        valKeys[val].forEach(k=>{
          localStorage.removeItem(k);
          const id=k.slice(EVI.length);
          const bp=builtinById(id); if(bp) delete bp.img;
          const cp=custom.find(c=>c.id===id); if(cp) delete cp.img;
        });
      }
    }
  }catch(e){}
})();
const saveLib=function saveLib(){
  if(libDamaged){WF.flash('⚠ Not saved: your saved parts could not be read, so EvenUCan won\'t write over them.',7000);return false;}
  // Strip in-memory photos and product images before serialising (they live in sidecar keys)
  const toSave=custom.map(p=>{if(!p.photo&&!p.img)return p;const{photo,img,...rest}=p;return rest;});
  // Split into chunks of ~400 parts to stay well under the 5 MB localStorage limit per key
  const CSIZE=400;
  try{
    // Remove old single-key save
    localStorage.removeItem('opensketch.'+LIB_KEY);
    // Remove old chunks beyond what we're about to write
    for(let i=Math.ceil(toSave.length/CSIZE);;i++){const k='opensketch.'+LIB_KEY+'.'+i;if(localStorage.getItem(k)==null)break;localStorage.removeItem(k);}
    for(let i=0;i<Math.ceil(toSave.length/CSIZE)||i===0;i++){
      localStorage.setItem('opensketch.'+LIB_KEY+'.'+i,JSON.stringify(toSave.slice(i*CSIZE,(i+1)*CSIZE)));
    }
    return true;
  }
  catch(e){WF.flash('Could not save the parts library: this computer\'s storage for the app is full. Remove some photos or parts.',7000);return false;}
};
// A built-in part you edit is saved as your own copy with the same id ("Reset" brings the original back).
const allParts=function allParts(){
  const own=new Map(custom.map(p=>[p.id,p]));
  const res=[...BUILTIN.map(b=>own.get(b.id)||b),...custom.filter(c=>!builtinById(c.id))];
  injectPhotos(res);
  return res;
};
const partById=id=>allParts().find(p=>p.id===id)||allParts().find(p=>p.id===DUP_ALIAS[id])||null;
const newPartId=()=>'p-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
// How far a part's sizes can be trusted, shown as a label and checked by the Enclosure report: measured (checked
// with calipers), drawing (a maker's dimension drawing or a CAD library) or approx (Fritzing pictures, which are
// drawn for wiring diagrams, AI memory, photo estimates). A part without its own setting gets one from its notes.
const ACC={measured:'✅ Measured',drawing:'📐 From a drawing',approx:'⚠️ Approximate',unknown:'Not checked'};
const accOf=function accOf(p){
  if(ACC[p.acc])return p.acc;
  if(builtinById(p.id)&&!custom.some(c=>c.id===p.id))return 'drawing';
  const n=p.notes||'';
  if(/\bMeasured \d/.test(n))return 'measured';
  if(/Fritzing contributors|photo estimate|own knowledge|AI's memory|similar listings|seller (figures|pages)/i.test(n))return 'approx';
  if((p.info&&p.info.credit)||/Eagle library|Sizes read by AI from "/i.test(n))return 'drawing';
  return 'unknown';
};
const tidyPart=function tidyPart(p){
  p.w=Math.max(0.5,num(p.w,10));p.d=Math.max(0.5,num(p.d,10));p.pcb=Math.max(0,num(p.pcb,1.6));p.h=Math.max(0,num(p.h,0));p.below=Math.max(0,num(p.below,0));
  // Header pins: a board is often sold both bare and with header pins already soldered on, which changes how far
  // anything sticks out underneath (and so the mounting posts and any flex button). belowOn/belowBare keep both
  // heights so switching the "Header pins" choice doesn't lose either one; hdr says which is now in use (p.below).
  if(p.hdr===undefined){p.belowOn=Math.max(0,num(p.belowOn,p.below));p.belowBare=Math.max(0,num(p.belowBare,0));p.hdr=p.below>0.05?'on':'off';}
  else{p.belowOn=Math.max(0,num(p.belowOn,p.below));p.belowBare=Math.max(0,num(p.belowBare,0));}
  p.below=p.hdr==='off'?p.belowBare:p.belowOn;
  if(!TYPES[p.type])p.type='other';if(p.shape!=='round')p.shape='rect';if(p.mount!=='wall'&&p.mount!=='outside')p.mount='floor';
  p.features=(p.features||[]).filter(f=>f&&FEAT[f.t]);
  // (1.9.7 measured a flex button from the top of the board; now it is from the table the part lies on, resting on
  // whatever sticks out underneath)
  for(const f of p.features)if(f.t==='button'&&f.bh!==undefined){if(f.btop===undefined)f.btop=+(p.below+p.pcb+num(f.bh,1.5)).toFixed(2);delete f.bh;}
  for(const f of p.features){const d=FEAT[f.t].def;for(const k in d)if(f[k]===undefined)f[k]=d[k];}
  return p;
};

// ---------------------------------------------------------------- styles and rules
const STYLES={
  compact:{name:'Compact',desc:'Soldered wires, tight fit. The smallest box.',wall:2,floor:2,gap:1,wallGap:0.6,topClear:1.5,headUp:0,headDown:0,cable:false,lid:'push'},
  proto:{name:'Prototype / Dupont',desc:'Room for Dupont jumper plugs on the pins, wider gaps and a cable slot.',wall:2,floor:2,gap:4,wallGap:3,topClear:3,headUp:18,headDown:15,cable:true,lid:'push'},
  rugged:{name:'Rugged',desc:'5 mm walls, screw-down lid with a wide gasket groove, mounting ears, and taller screw posts for a brass insert.',wall:5,floor:3,gap:2,wallGap:1,topClear:2,headUp:0,headDown:0,cable:false,lid:'screws',ears:true,groove:true,postH:6}
};
const LIDS={push:'Push-fit lid (lip)',snap:'Snap-fit lid (clicks on)',screws:'Screw-down lid (4 × M3 self-tapping)'};
const PORT_GAP=0.4,LIP=3,LIP_T=1.6,LID_CLEAR=0.13,POST=7,ANT_KEEP=10;
// Push-fit accessories: a peg mount (board drops onto the post through its own hole), and printable
// plugs/rivets sized to match a hole, each a touch undersize for a friction fit (tune per printer).
const PEG_CLEAR=0.3,PEG_POKE=2.5,PLUG_CLEAR=0.3,PLUG_CAP_OVER=2,PLUG_CAP_T=2.5,RIVET_BARB=0.35;
// Keep-away pairs (hard, mm between the parts) and keep-near pairs (preferred).
const AWAY=[['mic','speaker',25,'microphone away from the speaker, so it doesn\'t hear it'],['battery','speaker',6,'battery away from the speaker magnet']];
const ANT_AWAY={battery:15,speaker:15};
const NEAR=[['charger','battery'],['amp','speaker'],['switch','charger'],['switch','battery']];
