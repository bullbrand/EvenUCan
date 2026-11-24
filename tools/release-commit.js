// Runs after "npm run dist": commits the version bump, tags it, and pushes, so GitHub always matches the installer you tested.
// Only the files the bump touches are committed (everything else was already committed: the build refuses to start otherwise).
const { execFileSync } = require('child_process');
const root = require('path').join(__dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const ver = JSON.parse(require('fs').readFileSync(root + '/package.json', 'utf8')).version;
const files = ['package.json', 'package-lock.json', 'js/cad/14-print-check-help-updates.js', 'sw.js'];
git('add', ...files);
if (!git('diff', '--cached', '--name-only')) { console.log('nothing to commit for ' + ver); process.exit(0); }
git('commit', '-m', 'Version ' + ver);
try { git('tag', 'v' + ver); } catch (e) { console.warn('tag v' + ver + ' already exists - left as it is'); }
console.log('committed version ' + ver + ', tagged v' + ver);
try { git('push', 'origin', 'main', '--tags'); console.log('pushed to GitHub'); }
catch (e) { console.warn('Could not push (offline or not signed in). Run  git push origin main --tags  later.'); }
