// ---- version: in the corner of the view, and the About box
// Shown bottom right and in About. The desktop app may override it via wfNative.version().
const APP_VERSION='1.9.161';
let appVersion=APP_VERSION;
(async()=>{try{if(window.wfNative&&window.wfNative.version)appVersion=await window.wfNative.version();}catch(e){/* intentional */}
  $('copyright').textContent='EvenUCan '+(appVersion?'v'+appVersion+' ':'')+'· © 2026 David John Waugh';})();
