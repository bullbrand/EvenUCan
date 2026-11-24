// Stops new hard-coded colours from creeping back into the interface.
// It counts colour values (#rgb / #rrggbb) inside inline style="" attributes in js/ and EvenUCan.html, and in css/.
// Canvas drawing colours and the icon artwork are not counted. The count for each file may only go down.
// Usage:  node tools/check-colours.js            (fails if any file has more colours than the baseline)
//         node tools/check-colours.js --update   (rewrite the baseline after a deliberate clean-up)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, 'colour-baseline.json');
const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const STYLE_ATTR = /style="([^"]*)"/g;
const TOKEN_DECL = /--[\w-]+\s*:/;   // a theme token definition may hold colours

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) { if (name !== 'vendor' && name !== 'node_modules') walk(p, out); }
    else out.push(p);
  }
  return out;
}

function countFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  let n = 0;
  if (file.endsWith('.css')) {
    for (const line of text.split('\n')) if (!TOKEN_DECL.test(line)) n += (line.match(HEX) || []).length;
  } else {
    for (const m of text.matchAll(STYLE_ATTR)) n += (m[1].match(HEX) || []).length;
  }
  return { rel, n };
}

const files = [
  ...walk(path.join(ROOT, 'js'), []).filter(f => f.endsWith('.js')),
  path.join(ROOT, 'EvenUCan.html'),
  ...walk(path.join(ROOT, 'css'), []).filter(f => f.endsWith('.css')),
];
const counts = {};
for (const f of files) {
  const { rel, n } = countFile(f);
  if (n > 0) counts[rel] = n;
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
  console.log('colour baseline written: ' + Object.keys(counts).length + ' files, ' +
    Object.values(counts).reduce((a, b) => a + b, 0) + ' colours');
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error('No baseline yet. Run: node tools/check-colours.js --update');
  process.exit(2);
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const bad = [];
for (const [rel, n] of Object.entries(counts)) {
  const allowed = base[rel] || 0;
  if (n > allowed) bad.push(`${rel}: ${n} hard-coded colours, the limit is ${allowed}`);
}
if (bad.length) {
  console.error('New hard-coded colours found. Use a theme token (var(--panel), var(--text), var(--accent)...) instead:');
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
console.log(`Colour check passed: ${total} hard-coded colours (baseline ${baseTotal}), none added.`);
