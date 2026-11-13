// Stitches src/ into app/EvenUCan.html (the single file Electron and web.zip ship).
// Every "<!-- INJECT path -->" line in src/index.html is replaced by that file's exact bytes
// (paths relative to src/). Zero dependencies. Usage: node build.js
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const src=path.join(__dirname,'src'),out=path.join(__dirname,'app','EvenUCan.html');
const html=fs.readFileSync(path.join(src,'index.html'),'utf8').replace(/^<!-- INJECT (\S+) -->\n/gm,
  (m,p)=>fs.readFileSync(path.join(src,p),'utf8'));
fs.writeFileSync(out,html);
console.log('built app/EvenUCan.html',Buffer.byteLength(html),'bytes sha256',
  crypto.createHash('sha256').update(html).digest('hex'));
