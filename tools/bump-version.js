// Bumps the app version everywhere at once, so every build is identifiable (Help > About, the corner of the 3D view,
// the installer file name, and the offline cache name all show the same number).
//   node tools/bump-version.js            1.9.164 -> 1.9.165  (what "npm run dist" does before every build)
//   node tools/bump-version.js --require-clean   same, but stops if anything is uncommitted (used by the build)
//   node tools/bump-version.js --set 1.9.170   set an exact version without counting up
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(root, f), s);
const one = (s, re, to, what) => { if ((s.match(new RegExp(re.source, 'g')) || []).length !== 1) throw new Error('expected exactly one ' + what); return s.replace(re, to); };

if (process.argv.includes('--require-clean')) {
  const dirty = require('child_process').execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty) { console.error('Not building: there are uncommitted changes, so the version number would not match one exact set of code.\nCommit them first:\n' + dirty); process.exit(1); }
}
const pkg = rd('package.json');
const cur = (pkg.match(/"version":\s*"(\d+\.\d+\.\d+)"/) || [])[1];
if (!cur) throw new Error('no version in package.json');
const i = process.argv.indexOf('--set');
let next;
if (i > -1) { next = process.argv[i + 1]; if (!/^\d+\.\d+\.\d+$/.test(next || '')) throw new Error('--set needs a version like 1.9.170'); }
else { const p = cur.split('.').map(Number); p[2]++; next = p.join('.'); }

wr('package.json', one(pkg, /("version":\s*")\d+\.\d+\.\d+(")/, '$1' + next + '$2', 'version in package.json'));
if (fs.existsSync(path.join(root, 'package-lock.json'))) {
  const lock = JSON.parse(rd('package-lock.json')); lock.version = next; if (lock.packages && lock.packages['']) lock.packages[''].version = next;
  wr('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
}
wr('js/cad/14-print-check-help-updates.js', one(rd('js/cad/14-print-check-help-updates.js'), /const APP_VERSION='[^']*';/, "const APP_VERSION='" + next + "';", 'APP_VERSION'));
// the offline cache is named after the version, so a new build always replaces the old cached files
wr('sw.js', one(rd('sw.js'), /const CACHE = '[^']*';/, "const CACHE = 'evenucan-" + next + "';", 'CACHE in sw.js'));
console.log('version ' + cur + ' -> ' + next);
