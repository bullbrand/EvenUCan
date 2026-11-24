// EvenUCan Enclosure Wizard - 11-parts-ai-and-keys.js
// One of the wizard files in js/wizard/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

// ---- sizes from a dimension drawing: the free Google Gemini AI reads a picture or PDF into a draft part.
// Optional and the only part of the app that uses the internet (only when you ask it to read a drawing).
// The key is kept on this computer only and is never exported with parts.
const AI_MODELS=['gemini-2.5-flash','gemini-3.8-flash','gemini-3.6-flash','gemini-3-flash-preview','gemini-2.5-flash-lite'];
// Which AI does the reading: Google Gemini, Groq or OpenRouter (free keys) or Claude (paid key). Each keeps its own key.
const PROVIDERS={localai:{name:'Local AI (Offline Specialist — Qwen Coder)',short:'Local AI',key:'ollamaModel',noKey:true},gemini:{name:'Google Gemini (free)',short:'Gemini',key:'geminiKey'},groq:{name:'Groq (free)',short:'Groq',key:'groqKey'},openrouter:{name:'OpenRouter (free)',short:'OpenRouter',key:'openrouterKey'},claude:{name:'Claude (paid per use)',short:'Claude',key:'claudeKey'},openai:{name:'ChatGPT / OpenAI (paid per use)',short:'ChatGPT',key:'openaiKey'},grok:{name:'Grok / xAI (paid per use)',short:'Grok',key:'grokKey'},deepseek:{name:'DeepSeek (paid per use)',short:'DeepSeek',key:'deepseekKey'}};
const aiProv=()=>PROVIDERS[WF.store.get('aiProvider')]?WF.store.get('aiProvider'):'localai';
const aiKey=p=>{
  const pr=p||aiProv(),info=PROVIDERS[pr];
  if(!info)return null;
  const val=(window.SECRET_CACHE&&window.SECRET_CACHE[info.key])||WF.store.get(info.key);
  if(val)return val;
  if(info.noKey)return WF.store.get(pr+'Model')||(OA[pr]&&OA[pr].text&&OA[pr].text[0])||'evenucan-expert:latest';
  return null;
};
const keyLabel=()=>(aiKey()?(PROVIDERS[aiProv()].noKey?'Local AI Model: ':'Change '):'Set up ')+PROVIDERS[aiProv()].short+(PROVIDERS[aiProv()].noKey?'…':' key…');
let refDraw=null,aiNote='',aiBusy=false;
const clearRef=function clearRef(){if(refDraw&&refDraw.url)URL.revokeObjectURL(refDraw.url);refDraw=null;aiNote='';};
// Load a picture (the load event fires even while the window is minimised; decode() can wait until it's shown).
const loadImg=src=>new Promise((res,rej)=>{const im=new Image(),t=setTimeout(()=>rej(new Error('picture timed out')),15000);
let photoFrom='';
  im.onload=()=>{clearTimeout(t);res(im);};im.onerror=()=>{clearTimeout(t);rej(new Error('not a picture'));};im.src=src;});
const toDataURL=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});
const openWeb=url=>window.open(url,'_blank','noopener');
// Your own search, worded to reach the maker's documentation (where the dimension drawings are);
// images=true opens Google Images, where drawings show up as pictures to drag into "Read a drawing".
const findDrawings=async function findDrawings(images){
  let q=ed.name&&ed.name!=='New part'?ed.name:'';
  q=await WF.askText((images?'Search pictures':'Search the web')+' for which part? (the part number works best)',q);
  if(!q||!q.trim())return;
  openWeb('https://www.google.com/search?'+(images?'udm=2&':'')+'q='+encodeURIComponent(q.trim()+' technical documentation schematic sizes'));
  WF.flash(images?'Your web browser shows pictures. Find a dimension drawing, copy or save it, then press Ctrl+V here or click "Read a drawing…".':'Your web browser is searching. Save a dimension drawing (picture or PDF), then click "Read a drawing…".',8000);
};
// Someone may already have made a part file for this board: it carries the pins, size and picture.
const findPartFile=async function findPartFile(){
  let q=ed.name&&ed.name!=='New part'?ed.name:'';
  q=await WF.askText('Search for a part file (.fzpz) for which part? (the part number works best)',q);
  if(!q||!q.trim())return;
  openWeb('https://www.google.com/search?q='+encodeURIComponent(q.trim()+' fzpz'));
  WF.flash('Your web browser is searching for part files. Download a .fzpz that matches your board, then drag it onto the part picture here (or click "Import pins…" and "Use a .fzpz file…").',10000);
};
// Setting up an AI key: what each AI is good for, steps to get a key (free for Gemini, Groq and OpenRouter), a button that
// opens the right web page, and a Test that sends "hello" to prove the key works before it is saved.
const KEY_HELP={
  gemini:{site:'https://aistudio.google.com/apikey',open:'Open Google AI Studio',
    about:'Free. Good at looking parts up on the web. Can be busy at peak times.',
    steps:['Click <b>Open Google AI Studio</b> below. It opens in your web browser.','Sign in with any Google account (a Gmail address is fine).','Click <b>Create API key</b>. If it asks for a project, let it make one for you.','Click <b>Copy</b> next to your new key (it starts with <code>AIza</code>).','Come back here, paste it in the box below and click <b>Test</b>.']},
  groq:{site:'https://console.groq.com/keys',open:'Open Groq',
    about:'Free (about 30 requests a minute and 1,000 a day), no card needed. Very fast. Good for ideas, Ask AI and writing code. It can\'t search the web, so Look up online uses what it already knows. It can read pictures of drawings, but not PDFs. Works in the web version.',
    steps:['Click <b>Open Groq</b> below. It opens in your web browser.','Sign up free (an email or Google account is fine, no card needed).','Go to the <b>Playground</b>, then click <b>API Keys</b> at the top right.','Click <b>Create API Key</b>, give it any name, and copy the key (it starts with <code>gsk_</code>). You only see it once.','Come back here, paste it in the box below and click <b>Test</b>.']},
  openrouter:{site:'https://openrouter.ai/settings/keys',open:'Open OpenRouter',
    about:'Free models, no card needed, but only about 50 requests a day (and 20 a minute), so it runs out sooner than the others. Some free models may keep what you send to improve their AI, so don\'t type anything private. It can\'t search the web, so Look up online uses what it already knows. It can read pictures of drawings, but not PDFs. Works in the web version.',
    steps:['Click <b>Open OpenRouter</b> below. It opens in your web browser.','Sign up free and log in.','Find <b>API Keys</b> (under your account menu at the top right) and click <b>Create</b> (or <b>Create API Key</b>).','If it asks for a tier or credit limit, pick any: it\'s free, and you won\'t be billed because you haven\'t entered a payment method. Copy the key (it starts with <code>sk-or-</code>).','Come back here, paste it in the box below and click <b>Test</b>.']},
  claude:{site:'https://console.anthropic.com/settings/keys',open:'Open the Anthropic Console',
    about:'Paid per use from credit you add: roughly US$0.10–0.40 per web look-up, a few cents for the rest. The most reliable, and rarely busy.',
    steps:['Click <b>Open the Anthropic Console</b> below and sign in or sign up.','Add some credit under <b>Billing</b>.','Go to <b>Settings › API Keys</b> and click <b>Create Key</b>.','Copy the key (it starts with <code>sk-ant-</code>).','Come back here, paste it in the box below and click <b>Test</b>.']},
  localai:{site:'',open:'',
    about:'100% Offline & Standalone: A specialist local AI runs on your computer with zero API keys and no internet connection required. Expert at small electronics, ESPHome YAML, and Arduino (.ino) code.',
    steps:['Local AI runs quietly right here on your computer (100% offline, zero internet or cloud keys needed).','Recommended specialist model: <code>evenucan-expert:latest</code> (pre-configured for embedded electronics, YAML & INO).','Click any available model below or type its name and click <b>Test</b> to verify.']},
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
const aiTest=async function aiTest(p,key){
  const ask='Reply with just the word: hello';
  if(OA[p]){
    const A=OA[p];let last='';
    for(const m of oaOrder(p,A.local?key:null)){
      const {status,j,msg}=await oaChat(p,key,m,ask,A.testTokens||20);
      if(status===401||status===403)throw new Error(A.local?'Local AI said no model name was given. Type the exact model name (e.g. evenucan-expert:latest) and test again.':A.name+' didn\'t accept this key. Check you copied all of it (it starts with '+A.starts+').');
      if(status===429)throw new Error('The key looks fine, but '+A.name+' is busy or the free limit ('+A.limit+') was reached. Wait a minute (or until tomorrow for a daily limit) and test again.');
      if(status===200){const c=j.choices&&j.choices[0];return String((c&&c.message&&c.message.content)||'').replace(/<think>[\s\S]*?<\/think>/g,'').trim()||'(an empty reply)';}
      last=msg||'HTTP '+status;// busy or renamed model: try the next
    }
    throw new Error(A.local?'Local AI didn\'t answer ('+last+'). Check the model name is exactly the one you chose, and that it is installed.':A.name+' didn\'t answer ('+last+'). The key may still be fine: test again in a minute.');
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
  for(const m of [WF.store.get('geminiModel'),...AI_MODELS].filter((m,i,a)=>m&&a.indexOf(m)===i&&!/gemini-1\.|gemini-2\.0/i.test(m))){
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
};
// After an AI or key changes, redraw whichever window shows the AI menu.
const aiChanged=function aiChanged(){
  if(plBack.style.display==='grid'&&ed)renderEditor();
  if(wrBack.style.display==='grid')renderWiringSide();
};
// Is Local AI ready right now, and what models does it have? Desktop: asks the main process (no CORS
// limit there). Web: asks the page's own origin can usually reach localhost even cross-origin for a
// plain GET, so this is tried directly; it simply shows "not running" if the browser blocks it.
const checkLocalAiStatus=async function checkLocalAiStatus(){
  if(/^https?:$/.test(location.protocol)){
    try{
      const pr=await fetch('/api/ai/models',{signal:AbortSignal.timeout(2000)});
      if(pr.ok){
        const pj=await pr.json();
        if(pj.models&&pj.models.length)return {running:true,models:pj.models.map(m=>({name:m,vision:m.includes('vl')||m.includes('vision')||m.includes('3.5')}))};
      }
    }catch(e){}
  }
  return {running:false,models:[]};
};
const askKey=function askKey(prov){
  return new Promise(res=>{
    const back=document.createElement('div');back.id='askBack';// (while it is open, keys belong to it)
    back.innerHTML='<div id="askBox" class="keyBox"></div>';
    const box=back.querySelector('#askBox');
    let p=PROVIDERS[prov]?prov:aiProv(),busy=false,localAiStatus=null,localAiChecking=false,bi=null;
    // Built-in Local AI (EvenUCan's own engine and model list). Null when the local helper cannot be reached.
    const loadBuiltin=async()=>{try{const r=await fetch('/api/ai/models',{signal:AbortSignal.timeout(3000)});if(r.ok){const j=await r.json();if(j.status==='ok')return j;}}catch(e){}return null;};
    const modelKey=n=>String(n).replace(/[^a-z0-9]/gi,'_');
    const postJson=(url,obj)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}).then(r=>r.json());
    const startDownload=async(name,btn)=>{
      const sp=box.querySelector('#dl-'+modelKey(name));
      btn.disabled=true;
      try{await postJson('/api/ai/models/pull',{name});}catch(e){}
      const tick=async()=>{
        let s={};try{s=await (await fetch('/api/ai/models/pull/status?name='+encodeURIComponent(name))).json();}catch(e){}
        if(s.status==='running'){if(sp)sp.textContent=(s.total?Math.round(100*s.done/s.total):0)+'% downloaded';setTimeout(tick,1000);return;}
        if(s.status==='done'){WF.flash(name+' is ready. Pick it to use it.',5000);checkLocalAi();return;}
        if(sp)sp.textContent='Download failed: '+(s.error||'unknown error');btn.disabled=false;
      };
      tick();
    };
    const checkLocalAi=()=>{
      if(p!=='localai'||localAiChecking)return;
      localAiChecking=true;
      loadBuiltin().then(async b=>{
        if(b){bi=b;localAiStatus={running:true,models:b.installed.map(m=>({name:m.name,vision:false}))};}
        else{bi=null;localAiStatus=await checkLocalAiStatus();}
        localAiChecking=false;if(p==='localai')drawLocalAiStatus();
      });
    };
    const drawLocalAiStatus=()=>{
      const el=box.querySelector('#localAiStatus');if(!el)return;
      const desk=!!(window.wfNative&&window.wfNative.checkTool);
      if(localAiChecking){el.innerHTML='<div class="ewNote">Checking whether Local AI is ready…</div>';return;}
      if(!localAiStatus){el.innerHTML='';return;}
      if(bi){
        const inst=bi.installed||[],cat=bi.catalog||[];
        el.innerHTML=`<div class="${bi.selected?'ok':'warn'}">${bi.selected?'✓ Local AI is ready and will use <b>'+esc(bi.selected)+'</b>.':'Local AI needs a model. Download one below, then pick it.'}</div>`+
          (inst.length?`<div class="btns" style="flex-wrap:wrap">${inst.map(m=>`<button data-k="pick" data-m="${esc(m.name)}">Use ${esc(m.name)}</button><button data-k="delModel" data-m="${esc(m.name)}">Delete</button>`).join('')}</div>`:'')+
          `<div class="ewNote" style="margin-top:6px"><b>Models you can download</b> (they are saved on this computer)</div>`+
          (cat.filter(m=>!m.installed).map(m=>`<div class="btns" style="flex-wrap:wrap;align-items:center"><span>${esc(m.title)} · about ${(m.size_mb/1024).toFixed(1)} GB</span><button data-k="dlModel" data-m="${esc(m.name)}">Download</button><span class="ewNote" id="dl-${modelKey(m.name)}"></span></div>`).join('')||'<div class="ewNote">Every model in the list is already downloaded.</div>');
        return;
      }
      if(localAiStatus.running){
        el.innerHTML=`<div class="ok">✓ Local AI is ready${localAiStatus.models.length?', with '+localAiStatus.models.length+' model'+(localAiStatus.models.length===1?'':'s')+' ready:':'. '+(localAiStatus.models.length===0?'No models yet - pull one first (see step 2 above).':'')}</div>`+
          (localAiStatus.models.length?`<div class="btns" style="flex-wrap:wrap">${localAiStatus.models.map(m=>`<button data-k="pick" data-m="${esc(m.name)}">${esc(m.name)}${m.vision?' 📷':''}</button>`).join('')}</div>`:'');
      }else if(desk){
        el.innerHTML='<div class="warn">Local AI doesn\'t seem to be running.</div>';
      }else{
        el.innerHTML='<div class="ewNote">Type the model name below and click <b>Test</b> to confirm it works.</div>';
      }
    };
    const draw=()=>{
      const h=KEY_HELP[p],has=!!aiKey(p),noKey=!!PROVIDERS[p].noKey,word=noKey?'model name':'key';
      box.innerHTML=`<div class="kHead"><b>AI ${word} for</b> <select data-k="prov">${Object.entries(PROVIDERS).map(([k,v])=>`<option value="${k}"${k===p?' selected':''}>${esc(v.name)}${aiKey(k)?' ✓':''}</option>`).join('')}</select></div>
<div class="ewNote">${h.about}</div>${has?'<div class="ok">✓ A '+word+' is saved for this AI. '+(noKey?'Change it below if you\'re using a different model.':'Paste a new one to replace it.')+'</div>':''}
<ol>${h.steps.map(s=>`<li>${s}</li>`).join('')}</ol>
${h.site?'<div class="btns kOpen"><button data-k="open">'+esc(h.open)+'</button></div>':''}
${noKey?'<div id="localAiStatus"></div>':''}
<input data-k="key" autocomplete="off" spellcheck="false" placeholder="${noKey?'Or type a model name, e.g. qwen2.5-coder:1.5b':'Paste your '+esc(PROVIDERS[p].short)+' key here'}" value="${esc(has?aiKey(p):'')}">
${noKey?(()=>{try{const all=JSON.parse(WF.store.get('ollamaTimings')||'{}'),m=aiKey(p)||'',arr=m&&all[m];if(!arr||!arr.length)return'';const avg=Math.round(arr.reduce((a,b)=>a+b,0)/arr.length),last=arr[arr.length-1];return`<div class="ewNote" id="ollTimings" style="margin-top:4px">⏱ <b>${esc(m)}</b>: last ${last}s · avg ${avg}s over ${arr.length} run${arr.length===1?'':'s'}</div>`;}catch(e){return'';}})():''}
<div class="kTest"></div>
<div class="btns">${has?`<button data-k="remove">Remove ${word}</button>`:''}<button data-k="test">Test</button><button data-ok>Save</button><button data-cancel>Cancel</button></div>
<div class="ewNote" style="margin-top:6px">${noKey?'The model name stays on this computer only, and nothing is ever sent anywhere else.':'The key stays on this computer only.'}</div>`;
      box.querySelector('input').focus();
      if(noKey){checkLocalAi();drawLocalAiStatus();}
    };
    const done=()=>{back.remove();aiChanged();res();};
    const save=()=>{
      const v=box.querySelector('input').value.trim(),word=PROVIDERS[p].noKey?'model name':'key';
      if(!v&&PROVIDERS[p].noKey){const out=box.querySelector('.kTest');if(out)out.innerHTML='<span class="bad">Type the model name first (e.g. evenucan-expert:latest).</span>';return;}
      if(v&&!PROVIDERS[p].noKey){const sv=saveSecret(PROVIDERS[p].key,v);if(!sv.ok){WF.flash(sv.message,6000);return;}WF.store.set('aiProvider',p);WF.flash(PROVIDERS[p].short+' '+word+' saved in your secrets file on this computer. EvenUCan now uses '+PROVIDERS[p].name+'.',5000);}
      else if(v){WF.store.set(PROVIDERS[p].key,v);WF.store.set('aiProvider',p);WF.flash(PROVIDERS[p].short+' '+word+' saved on this computer. EvenUCan now uses '+PROVIDERS[p].name+'.',5000);}
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
    box.addEventListener('change',e=>{if(e.target.dataset.k==='prov'){p=e.target.value;localAiStatus=null;draw();}});
    box.addEventListener('click',e=>{
      const k=e.target.dataset.k;if(busy)return;
      if(k==='open')openWeb(KEY_HELP[p].site);
      else if(k==='test')test();
      else if(k==='remove'){if(!PROVIDERS[p].noKey)removeSecret(PROVIDERS[p].key);else localStorage.removeItem('opensketch.'+PROVIDERS[p].key);WF.flash(PROVIDERS[p].short+' '+(PROVIDERS[p].noKey?'model name':'key')+' removed');draw();}
      else if(k==='pick'){
        const inp=box.querySelector('input');inp.value=e.target.dataset.m;inp.focus();
        if(bi)postJson('/api/ai/models/select',{name:e.target.dataset.m}).then(r=>{if(r.status==='ok'){bi=r;WF.flash('Local AI will use '+e.target.dataset.m+'.',4000);checkLocalAi();}else WF.flash(r.message||'Could not choose that model.',5000);}).catch(()=>{});
      }
      else if(k==='dlModel'){startDownload(e.target.dataset.m,e.target);}
      else if(k==='delModel'){
        if(!confirm('Delete '+e.target.dataset.m+' from this computer? You can download it again later.'))return;
        postJson('/api/ai/models/delete',{name:e.target.dataset.m}).then(r=>{if(r.status==='ok'){bi=r;}WF.flash('Model deleted.',3000);checkLocalAi();}).catch(()=>{});
      }
      else if(e.target.hasAttribute('data-ok'))save();
      else if(e.target.hasAttribute('data-cancel'))done();
    });
    box.addEventListener('keydown',e=>{e.stopPropagation();if(busy)return;if(e.key==='Enter'&&e.target.tagName==='INPUT')save();else if(e.key==='Escape')done();});
    document.body.appendChild(back);draw();
  });
};
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
const shrinkImage=async function shrinkImage(f){
  if(f.size<3e6&&/^image\/(png|jpeg|gif|webp)$/.test(f.type))return {b64:await fileB64(f),mime:f.type};// (Claude takes up to 5 MB per picture)
  const url=URL.createObjectURL(f),im=await loadImg(url);
  const k=Math.min(1,3000/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
  c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);
  return {b64:c.toDataURL('image/jpeg',0.9).split(',')[1],mime:'image/jpeg'};
};
// The JSON object in an AI's reply (it may come wrapped in a sentence or ``` fences).
const aiJSON=function aiJSON(txt,web){
  const s=txt.indexOf('{'),e=txt.lastIndexOf('}');
  if(s<0||e<s)throw softErr(web?'The AI didn\'t give sizes.':'The AI couldn\'t read sizes from that file. Try a clearer drawing.');
  try{return JSON.parse(txt.slice(s,e+1));}catch(err){throw softErr('The AI\'s answer was garbled.');}
};
// Links it names itself plus the pages its search tool returned, without repeats.
const aiSources=function aiSources(data,found){
  const all=[...(Array.isArray(data.sources)?data.sources:[]).filter(u=>typeof u==='string'&&/^https:\/\//.test(u)).map(u=>({uri:u,title:u.replace(/^https:\/\/(www\.)?/,'').slice(0,60)})),...found];
  return all.filter((x,i)=>all.findIndex(y=>y.uri===x.uri)===i).slice(0,6);
};
// One request to Claude through the official Anthropic SDK (embedded above). content: the message blocks;
// web: let Claude search the web and open pages and PDFs itself.
const claude=async function claude(content,web){
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
};
// One request to Gemini. parts: the message; web: let it search Google and open pages/PDFs itself.
// Returns {data, sources}. Tries each model in turn, so a renamed or retired model doesn't break it.
// The last thing Google sent back (shown by "Show AI reply" when something goes wrong).
let aiLastReply='';
const softErr=(msg)=>Object.assign(new Error(msg),{soft:true});// worth retrying another way
const gemini=async function gemini(parts,tools){
  const key=aiKey('gemini'),web=!!tools;
  // Free-tier web search is on the 2.5 Flash models only; plain reading works on any of them.
  const order=web?['gemini-2.5-flash','gemini-2.5-flash-lite']:[WF.store.get('geminiModel'),...AI_MODELS].filter((m,i,a)=>m&&a.indexOf(m)===i&&!/gemini-1\.|gemini-2\.0/i.test(m));
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
  if(busy)throw (web?softErr:(m=>new Error(m)))('Google\'s free AI is too busy right now. Try again in a few minutes, or switch to Groq or Claude.');
  throw web?softErr('Web search for the AI isn\'t available on this key ('+skipped+').'):new Error('None of Google\'s free Gemini models answered. They may have been renamed; an app update will fix this.');
};
// (1.9.38) Groq and OpenRouter speak the same OpenAI-style "chat completions", so both share
// this code. Both accept calls straight from a web page.
// None of them can search the web or read PDFs. Model lists checked against each provider's model page (Nov 2026).
const OA={
  groq:{name:'Groq',starts:'gsk_',url:'https://api.groq.com/openai/v1/chat/completions',free:true,
    text:['openai/gpt-oss-120b','llama-3.3-70b-versatile','qwen/qwen3.8-27b','openai/gpt-oss-20b','llama-3.1-8b-instant'],
    vision:['qwen/qwen3.8-27b','meta-models/muse-spark-open'],limit:'about 30 requests a minute, 1,000 a day',testTokens:200},
  openrouter:{name:'OpenRouter',starts:'sk-or-',url:'https://openrouter.ai/api/v1/chat/completions',free:true,
    text:['openrouter/free','nvidia/nemotron-3-ultra-550b-a55b:free','google/gemma-4-31b-it:free'],
    vision:['openrouter/free','google/gemma-4-31b-it:free','nvidia/nemotron-3.5-super-vl:free'],limit:'about 50 requests a day',testTokens:200,
    headers:{'X-Title':'EvenUCan'}},
  // (1.9.41) a model on this computer, not the internet. No key: the "key" box holds the model's exact
  // name instead (e.g. "qwen2.5-coder:1.5b"), the same name shown in the model list. 100% offline specialist.
  localai:{name:'Local AI (Offline Specialist)',url:'/api/ai/chat',
    text:['evenucan-expert:latest','qwen2.5-coder:1.5b','qwen3.5:4b','llama3.1:latest','gemma:2b','llama3:latest','lfm3:latest'],
    vision:['qwen3.5:4b'],local:true,limit:'100% offline on your computer (no internet needed)',testTokens:60},
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
// One request, fetched directly from the page.
const oaChat=async function oaChat(p,key,model,content,maxTokens){
  const A=OA[p];
  // For Local AI: force stream:false (streaming would break JSON.parse);
  // cap max_tokens at 3072 to allow complete YAML/INO files.
  const mt=A.local?Math.min(maxTokens,3072):maxTokens;
  let msgs=Array.isArray(content)&&content[0]&&content[0].role?content:[{role:'user',content}];
  if(A.local&&!msgs.some(m=>m.role==='system')){
    msgs=[{
      role:'system',
      content:'You are the EvenUCan Embedded Hardware & Firmware Specialist (offline AI). You specialize in small microcontrollers (ESP32, ESP32-S3, ESP8266, RP2040, Arduino Uno/Nano), ESPHome YAML configurations, and Arduino C++ (.ino) code. Always output safe, clean, compile-ready code matching the hardware pins and electrical safety constraints.'+(typeof pinGuideForPrompt==='function'?'\n'+pinGuideForPrompt():'')
    },...msgs];
  }
  const body=JSON.stringify({model,messages:msgs,temperature:0.1,max_tokens:mt,...(A.local?{stream:false}:{})});
  let status,raw;
    const _oMs=A.local?300000:60000;// local models get 5 min; cloud APIs get 60 s
    const _oSig=AbortSignal.timeout?AbortSignal.timeout(_oMs):(()=>{const ac=new AbortController();setTimeout(()=>ac.abort(),_oMs);return ac.signal;})();
    const _t0=A.local?Date.now():0;
    let reqUrl=A.url;
    if(A.local&&/^https?:$/.test(location.protocol)){
      reqUrl='/api/ai/chat';
    }
    try{
      let r;
      try{
        r=await fetch(reqUrl,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},A.local?{}:{Authorization:'Bearer '+key},A.headers||{}),body,signal:_oSig});
      }catch(err){
        if(reqUrl!==A.url){
          r=await fetch(A.url,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},A.local?{}:{Authorization:'Bearer '+key},A.headers||{}),body,signal:_oSig});
        }else throw err;
      }
      status=r.status;raw=await r.text();
    }
    catch(e){console.error('EvenUCan: oaChat fetch failed',p,e);if(e&&(e.name==='AbortError'||e.name==='TimeoutError'))throw new Error((A.local?'Local AI':'The AI ('+A.name+')')+' took too long to reply (over '+(A.local?'5 min':'60 s')+'). '+(A.local?'The model may be too large for your computer. Try a smaller one, e.g. qwen2.5-coder:1.5b.':'Try again or switch to another provider.'));throw new Error(A.local?'Couldn\'t reach Local AI on this computer. Make sure Local AI is set up on this computer. Error: '+(e&&e.message||e):'Couldn\'t reach '+A.name+'. Check the internet connection and try again.');}
    if(A.local&&status===200){// record response time for this model
      try{const secs=Math.round((Date.now()-_t0)/1000);const all=JSON.parse(WF.store.get('ollamaTimings')||'{}');const arr=(all[model]||[]).slice(-9);arr.push(secs);all[model]=arr;WF.store.set('ollamaTimings',JSON.stringify(all));}catch(e){/* non-critical */}
    }
  let j={};try{j=JSON.parse(raw);}catch(e){/* intentional: handled below as an empty answer */}
  return {status,j,msg:String(j.detail||j.title||(j.error&&(j.error.message||j.error))||'')};
};
const oaSkip=(status,msg)=>status===404||status===410||(status===400&&/model|not found|not supported|unknown|decommission|no endpoints|image/i.test(msg));
const oaAI=async function oaAI(p,text,pic){
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
};
// These AIs take pictures only up to about 180 KB inside a request: shrink until it fits (drawings stay readable at ~1200 px).
const nvSmall=async function nvSmall(b64,mime){
  if(b64.length<175000)return {b64,mime};
  const im=await loadImg('data:'+mime+';base64,'+b64);
  for(const px of [1600,1300,1100,900,700]){
    const k=Math.min(1,px/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
    c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
    const s=c.toDataURL('image/jpeg',0.8).split(',')[1];if(s.length<175000)return {b64:s,mime:'image/jpeg'};
  }
  throw new Error('That picture is too detailed for this AI. Crop it to just the drawing, or switch to Gemini or Claude.');
};
// Turn the AI's answer into the part being edited (a draft: nothing is saved until you click Save part).
const applyDrawing=function applyDrawing(d,src,sources){
  const n=(v,def)=>{const x=num(v,NaN);return isFinite(x)&&x>=0?Math.round(x*100)/100:def;};
  if(d.name)ed.name=String(d.name).slice(0,80);
  delete ed.photo; delete ed.img;
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
};
// Vision-capable providers in priority order for failover
const VISION_PROVIDERS=['gemini','openai','claude','openrouter'];
const getVisionFailoverList=function getVisionFailoverList(){
  const primary=aiProv(),queue=[];
  const hasKey=p=>p==='localai'||!!aiKey(p);
  const isVision=p=>VISION_PROVIDERS.includes(p)&&hasKey(p);
  // Strictly skip text-only providers (DeepSeek, Groq) during photo/drawing reading
  if(isVision(primary))queue.push(primary);
  for(const p of VISION_PROVIDERS){
    if(!queue.includes(p)&&isVision(p))queue.push(p);
  }
  return queue;
};

// Have the chosen AI read a drawing (picture or PDF, base64) into part data with automatic vision failover.
const aiRead=async function aiRead(b64,mime,hint){
  const ask=AI_PROMPT+'\n\n'+hint;
  const queue=getVisionFailoverList();
  if(!queue.length){
    if(aiProv()==='deepseek'){
      throw new Error('DeepSeek is a text-only AI and cannot read pictures. Please configure Google Gemini, Claude, or OpenAI in EvenUCan settings.');
    }
    const nm=PROVIDERS[aiProv()]?PROVIDERS[aiProv()].name:aiProv();
    throw new Error(nm+' cannot read pictures. Please set up a key for Google Gemini, Claude, OpenAI, or OpenRouter.');
  }

  let lastErr=null;
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    if(i>0){
      const pName=PROVIDERS[p]?PROVIDERS[p].name:p;
      if(typeof WF!=='undefined'&&WF.flash){
        WF.flash('Primary AI busy — switching to next available vision AI ('+pName+')...',5000);
      }
    }
    try{
      if(p==='gemini'){
        const {data}=await gemini([{inline_data:{mime_type:mime,data:b64}},{text:ask}],false);
        if(data)return data;
      }else if(p==='claude'){
        const {data}=await claude([mime==='application/pdf'?{type:'document',source:{type:'base64',media_type:mime,data:b64}}:{type:'image',source:{type:'base64',media_type:mime,data:b64}},{type:'text',text:ask}],false);
        if(data)return data;
      }else if(isOA(p)){
        if(mime==='application/pdf'){
          if(queue.length>1)continue;
          throw new Error((OA[p]?.name||p)+" can't read PDFs. Use a picture of the drawing, or switch to Gemini or Claude.");
        }
        const r=await oaAI(p,ask,await nvSmall(b64,mime));
        if(r&&r.data)return r.data;
      }
    }catch(e){
      console.warn(`EvenUCan: vision AI provider ${p} failed:`,e);
      lastErr=e;
      continue;
    }
  }
  throw lastErr||new Error('All vision AI providers failed to read the drawing.');
};
const readDrawing=async function readDrawing(file){
  if(aiBusy)return;
  if(!file)return;
  const pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!pdf&&!/^image\//.test(file.type))return WF.flash('Use a picture (PNG, JPG…) or a PDF of the drawing');
  if(file.size>18e6)return WF.flash('That file is too big (over 18 MB). Use a smaller picture or just the page with the drawing.');
  if(!getVisionFailoverList().length){await askKey();if(!getVisionFailoverList().length)return;}
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
};
// Fully automatic: the AI searches the web for the part, opens its datasheet or product page, and fills a draft.
const lookupOnline=async function lookupOnline(){
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
    // (Groq and OpenRouter can't search the web, so they go straight to what they already know)
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
    aiBusy=false;
    renderEditor();
    WF.flash(got.known?(useNv?'Draft filled in from what '+OA[aiProv()].name+'\'s AI knows (it can\'t search the web). Check every size before saving.':'Draft filled in from the AI\'s own knowledge (the web search found nothing). Check every size before saving.'):/Exact positions/.test(extra)?'Draft filled in from the web, with positions read from a dimension drawing. Check it, then Save part.':'Draft filled in from the web. Check it against the sources, then Save part.',8000);
  }catch(e){aiBusy=false;aiFail(e);}
};
// Something went wrong: say what, and offer to show exactly what Google sent back. A plain JS error (as
// opposed to one of this app's own, already-written-for-a-person Error/softErr messages) means a bug, not
// something the user did - never shown as its raw technical message, but kept (full message and stack) for
// "Show error details" to display from right inside the app: the desktop build has no DevTools/console to
// point someone at (it runs without the menu that provides the usual F12), so that has to be self-contained.
let aiBugDetail='';
const aiFail=function aiFail(e){
  console.error('EvenUCan: AI assist failed',e);
  const bug=e instanceof TypeError||e instanceof ReferenceError||e instanceof RangeError;
  aiBugDetail=bug?(e.stack||e.message||String(e)):'';
  const msg=bug?'Something went wrong reading that - try again, or try a clearer drawing. (This looks like a bug in EvenUCan, not something you did - click "Show error details" below to see it, and take a screenshot to report it.)':(e.message||String(e));
  WF.flash(msg,9000);
  aiNote='<b>Couldn\'t fill in the part:</b> '+esc(msg)+(bug?'<button id="plAiBug">Show error details</button>':'')+(aiLastReply?'<button id="plAiReply">Show AI reply</button>':'');
  renderEditor();// buttons back to normal, message in the yellow bar
};
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
