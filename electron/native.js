// Native features for the desktop window: installed-program check, Local AI status/start, "Open in Arduino IDE / Thonny /
// ESPHome", ESPHome config check, folder choosers. Registered once from main.js; the page reaches them only through
// window.wfNative (electron/preload.js). Only this app's own page (the local server's address) may ask.
// Ported from the previous release's main.js (see docs/electron-hooks-removed.md).
'use strict';
const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

function register({ origin, getWindow }) {
const ORIGIN = origin;   // e.g. http://localhost:8080


// %VAR% (Windows) and a leading ~ (home folder) in the paths below.
function expandPath(p) {
  return p
    .replace(/%([^%]+)%/g, (m, k) => process.env[k] || process.env[k.toUpperCase()] || m)
    .replace(/^~(?=$|[\\/])/, os.homedir());
}

const TOOL_PATHS = {
  arduino: {
    win32: ['%PROGRAMFILES%\\Arduino IDE\\Arduino IDE.exe', '%LOCALAPPDATA%\\Programs\\Arduino IDE\\Arduino IDE.exe'],
    darwin: ['/Applications/Arduino IDE.app'],
    linux: ['~/.local/bin/arduino-ide', '/usr/bin/arduino-ide', '/usr/local/bin/arduino-ide']
  },
  esphome: {
    win32: ['%PROGRAMFILES%\\ESPHome Device Builder\\ESPHome Device Builder.exe', '%LOCALAPPDATA%\\Programs\\ESPHome Device Builder\\ESPHome Device Builder.exe'],
    darwin: ['/Applications/ESPHome Device Builder.app'],
    linux: ['~/.local/bin/esphome-device-builder']
  },
  pi: {
    win32: ['%PROGRAMFILES%\\Thonny\\thonny.exe', '%LOCALAPPDATA%\\Programs\\Thonny\\thonny.exe'],
    darwin: ['/Applications/Thonny.app'],
    linux: ['/usr/bin/thonny', '~/.local/bin/thonny']
  },
  // the Wiring window's Raspberry Pi hint asks about VS Code
  vscode: {
    win32: ['%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe', '%PROGRAMFILES%\\Microsoft VS Code\\Code.exe'],
    darwin: ['/Applications/Visual Studio Code.app'],
    linux: ['/usr/bin/code', '/usr/local/bin/code', '/snap/bin/code']
  }
};
const TOOL_ALIAS = { raspberrypi: 'pi', thonny: 'pi', 'arduino-ide': 'arduino' };
const ESPHOME_URL = 'http://localhost:6052';

const toolKey = (pf) => {
  const k = String(pf || '').toLowerCase();
  return TOOL_ALIAS[k] || k;
};

function findTool(key) {
  const list = (TOOL_PATHS[key] && TOOL_PATHS[key][process.platform]) || [];
  for (const p of list) {
    const full = expandPath(p);
    if (!full.includes('%') && fs.existsSync(full)) return full;
  }
  return '';
}

// The ESPHome dashboard answers on port 6052 while it runs (desktop app, Docker or "esphome dashboard").
async function esphomeRunning() {
  try {
    await fetch(ESPHOME_URL + '/', { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

function fromApp(event) {
  try {
    return String(event.senderFrame ? event.senderFrame.url : '').startsWith(ORIGIN + '/');
  } catch {
    return false;
  }
}

// A safe file / sketch name: letters, numbers, _ and - only (Arduino sketch rules), never empty or a path.
function safeName(name) {
  let n = path.basename(String(name || '')).replace(/\.(ino|py|ya?ml|txt)$/i, '');
  n = n.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  if (!n) n = 'EvenUCan_project';
  if (/^[0-9]/.test(n)) n = 'p_' + n;
  return n;
}

// Start a program without waiting for it; resolves once it started (or failed to).
function launch(cmd, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
    } catch (e) {
      resolve({ ok: false, err: String((e && e.message) || e) });
      return;
    }
    child.once('error', (e) => resolve({ ok: false, err: String((e && e.message) || e) }));
    child.once('spawn', () => {
      child.unref();
      resolve({ ok: true, err: '' });
    });
  });
}

// On a Mac the tools are .app bundles, opened with "open -a".
const openWith = (appPath, file) =>
  process.platform === 'darwin' ? launch('open', ['-a', appPath, file]) : launch(appPath, [file]);

const TOOL_NAMES = { arduino: 'Arduino IDE', pi: 'Thonny', esphome: 'ESPHome Device Builder' };

ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('check-tool', async (event, pf) => {
  const key = toolKey(pf);
  if (!fromApp(event) || !TOOL_PATHS[key]) return { found: false, path: '', version: '' };
  try {
    const found = findTool(key);
    if (found) return { found: true, path: found, version: '' };
    if (key === 'esphome' && (await esphomeRunning())) return { found: true, path: ESPHOME_URL, version: '' };
  } catch (e) {
    console.error('EvenUCan: tool check failed', key, e);
  }
  return { found: false, path: '', version: '' };
});

// ---------------------------------------------------------------- "Open in ESPHome / Arduino IDE / Thonny"
// The folders EvenUCan writes into are remembered in <userData>/evenucan-settings.json
// ({ esphomeDir, arduinoDir, piDir }); the user can change them with chooseFolder().
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'evenucan-settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')) || {}; } catch { return {}; }
}
function writeSettings(patch) {
  const s = Object.assign(readSettings(), patch);
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(s, null, 2), 'utf8');
  } catch (e) { console.error('EvenUCan: could not save settings', e); }
  return s;
}
const isDir = (p) => { try { return !!p && fs.statSync(p).isDirectory(); } catch { return false; } };

// A program on the PATH (esphome, arduino-ide, thonny), with Windows' .exe/.cmd endings.
function onPath(cmd) {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').concat(['']) : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = path.join(dir.replace(/^"|"$/g, ''), cmd + ext.toLowerCase());
      try { if (fs.statSync(full).isFile()) return full; } catch { /* not here */ }
    }
  }
  return '';
}
const PATH_NAMES = { arduino: ['arduino-ide', 'Arduino IDE'], pi: ['thonny'] };
const findProgram = (key) => findTool(key) || (PATH_NAMES[key] || []).map(onPath).find(Boolean) || '';

// ESPHome Device Builder (the desktop app) keeps its devices in ~/esphome unless its own settings.json says
// otherwise ("config_dir"); "esphome dashboard" users often use ~/.esphome or ~/esphome too.
function esphomeAppSettingsDir() {
  const home = os.homedir();
  const dirs = process.platform === 'win32' ? [path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'io.esphome.builder')]
    : process.platform === 'darwin' ? [path.join(home, 'Library', 'Application Support', 'io.esphome.builder')]
    : [path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'io.esphome.builder')];
  for (const d of dirs) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(d, 'settings.json'), 'utf8'));
      if (s && s.config_dir && isDir(expandPath(s.config_dir))) return expandPath(s.config_dir);
    } catch { /* not installed, or no setting */ }
  }
  return '';
}
function knownEsphomeDir() {
  const s = readSettings();
  if (isDir(s.esphomeDir)) return s.esphomeDir;
  return esphomeAppSettingsDir() || [path.join(os.homedir(), 'esphome'), path.join(os.homedir(), '.esphome')].find(isDir) || '';
}

const FOLDER_ASK = {
  projects: { key: 'projectsDir', title: 'Choose where to keep your projects',
    msg: 'Where should EvenUCan keep your projects?',
    detail: 'Each project is saved here as a file, so you keep it even if the browser data is cleared. The default is the "EvenUCan\Projects" folder in Documents.' },
  esphome: { key: 'esphomeDir', title: 'Choose your ESPHome folder',
    msg: 'Where does ESPHome keep its devices?',
    detail: 'ESPHome Device Builder uses the "esphome" folder in your user folder. If you run ESPHome another way, pick its config folder (the one with your other .yaml files).' },
  arduino: { key: 'arduinoDir', title: 'Choose your Arduino sketchbook',
    msg: 'Where is your Arduino sketchbook?',
    detail: 'It is usually the "Arduino" folder in Documents. The Arduino IDE shows it in File > Preferences > Sketchbook location.' },
  pi: { key: 'piDir', title: 'Choose a folder for your Pi programs',
    msg: 'Where should your Raspberry Pi programs go?',
    detail: 'For example a folder called "EvenUCan" in Documents.' }
};
async function askFolder(kind, start) {
  const A = FOLDER_ASK[kind];
  const r = await dialog.showOpenDialog(getWindow() || undefined, {
    title: A.title, message: A.msg + ' ' + A.detail, buttonLabel: 'Use this folder',
    defaultPath: start && isDir(start) ? start : os.homedir(),
    properties: ['openDirectory', 'createDirectory', 'promptToCreate']
  });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return '';
  const dir = r.filePaths[0];
  fs.mkdirSync(dir, { recursive: true });
  writeSettings({ [A.key]: dir });
  return dir;
}
function defaultDir(kind) {
  const s = readSettings(), docs = app.getPath('documents');
  if (kind === 'projects') return isDir(s.projectsDir) ? s.projectsDir : path.join(docs, 'EvenUCan', 'Projects');
  if (kind === 'arduino') return isDir(s.arduinoDir) ? s.arduinoDir : path.join(docs, 'Arduino');
  if (kind === 'pi') return isDir(s.piDir) ? s.piDir : path.join(docs, 'EvenUCan');
  return knownEsphomeDir();
}

// Write a file; a different file already there is kept as <name>.bak first, so nothing is lost.
function writeKeepingOld(file, text) {
  try {
    const old = fs.readFileSync(file, 'utf8');
    if (old === text) return;
    fs.writeFileSync(file + '.bak', old, 'utf8');
  } catch { /* no old file */ }
  fs.writeFileSync(file, text, 'utf8');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

ipcMain.handle('choose-folder', async (event, kind) => {
  if (!fromApp(event) || !FOLDER_ASK[kind]) return { ok: false, dir: '' };
  try {
    const dir = await askFolder(kind, defaultDir(kind));
    return { ok: !!dir, dir };
  } catch (e) {
    console.error('EvenUCan: choose folder failed', e);
    return { ok: false, dir: '', err: String((e && e.message) || e) };
  }
});

// esphomeSend(yaml, slug, overwrite) -> {ok, found, exists, dir, file, opened:'dashboard'|'started'|'app'|'', secretsOk, err}
ipcMain.handle('esphome-send', async (event, yaml, slug, overwrite) => {
  if (!fromApp(event)) return { ok: false, found: false, err: 'Not allowed.' };
  try {
    const text = String(yaml == null ? '' : yaml);
    if (!text.trim()) return { ok: false, found: false, err: 'There is no ESPHome file yet.' };
    let dir = knownEsphomeDir();
    if (!dir) dir = await askFolder('esphome', path.join(os.homedir(), 'esphome'));
    if (!dir) return { ok: false, found: false, err: 'No ESPHome folder was chosen, so the file was downloaded instead.' };
    const name = safeName(slug).replace(/_/g, '-').toLowerCase() || 'my-device';
    const file = path.join(dir, name + '.yaml');
    if (!overwrite && fs.existsSync(file) && fs.readFileSync(file, 'utf8') !== text) return { ok: false, found: true, exists: true, dir, file };
    writeKeepingOld(file, text);
    let secretsOk = false;
    try { secretsOk = /wifi_ssid/.test(fs.readFileSync(path.join(dir, 'secrets.yaml'), 'utf8')); } catch { /* none yet */ }

    let opened = '', err = '';
    if (await esphomeRunning()) {
      await shell.openExternal(ESPHOME_URL);
      opened = 'dashboard';
    } else if (onPath('esphome')) {
      const r = await launch(onPath('esphome'), ['dashboard', dir]);
      if (r.ok) {
        for (let i = 0; i < 40 && !(await esphomeRunning()); i++) await sleep(1000);
        if (await esphomeRunning()) { await shell.openExternal(ESPHOME_URL); opened = 'started'; }
        else err = 'ESPHome is starting but is slow to open. Wait a minute, then click Open ESPHome.';
      } else err = 'Could not start ESPHome: ' + r.err;
    } else if (findTool('esphome')) {
      const r = process.platform === 'darwin' ? await launch('open', ['-a', findTool('esphome')]) : await launch(findTool('esphome'), []);
      if (r.ok) opened = 'app'; else err = 'Could not start ESPHome Device Builder: ' + r.err;
    } else {
      err = 'The file is in your ESPHome folder, but ESPHome isn\'t running and EvenUCan couldn\'t find it on this computer. Start ESPHome Device Builder (or install it from esphome.io/install).';
    }
    return { ok: true, found: true, exists: false, dir, file, opened, secretsOk, err };
  } catch (e) {
    console.error('EvenUCan: send to ESPHome failed', e);
    return { ok: false, found: false, err: String((e && e.message) || e) };
  }
});

// esphomeCheck(yaml?, slug?) -> {cli, dashboard, found, ok, out}. With a file, runs "esphome config" on a copy of it
// (next to a copy of the user's secrets.yaml, or stand-in Wi-Fi details) - the same as Validate in ESPHome.
ipcMain.handle('esphome-check', async (event, yaml, slug) => {
  if (!fromApp(event)) return { cli: '', dashboard: false, found: false, ok: false, out: 'Not allowed.' };
  const cli = onPath('esphome'), dashboard = await esphomeRunning();
  if (yaml == null || yaml === '') return { cli, dashboard, found: !!cli || dashboard };
  if (!cli) return { cli: '', dashboard, found: false, ok: false, out: '' };
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evenucan-check-'));
    const name = safeName(slug).replace(/_/g, '-').toLowerCase() || 'my-device';
    fs.writeFileSync(path.join(tmp, name + '.yaml'), String(yaml), 'utf8');
    const real = knownEsphomeDir() && path.join(knownEsphomeDir(), 'secrets.yaml');
    if (real && fs.existsSync(real)) fs.copyFileSync(real, path.join(tmp, 'secrets.yaml'));
    else fs.writeFileSync(path.join(tmp, 'secrets.yaml'), 'wifi_ssid: "check"\nwifi_password: "checkcheck"\n', 'utf8');
    const out = await new Promise((resolve) => {
      let buf = '';
      const p = spawn(cli, ['config', path.join(tmp, name + '.yaml')], { windowsHide: true });
      const t = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 180000);
      p.stdout.on('data', (d) => { buf += d; });
      p.stderr.on('data', (d) => { buf += d; });
      p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, buf: buf + String(e.message || e) }); });
      p.on('close', (code) => { clearTimeout(t); resolve({ code, buf }); });
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    return { cli, dashboard, found: true, ok: out.code === 0, out: out.buf.slice(-20000) };
  } catch (e) {
    console.error('EvenUCan: ESPHome check failed', e);
    return { cli, dashboard, found: true, ok: false, out: String((e && e.message) || e) };
  }
});

// openInIde(pf, code, filename): Arduino -> <sketchbook>/<name>/<name>.ino, Pi -> <folder>/<name>.py, then start the
// Arduino IDE / Thonny with it (or whatever program the computer uses for that kind of file).
// -> {ok, file, dir, launched:'ide'|'default', err}
ipcMain.handle('open-in-ide', async (event, pf, code, filename) => {
  const key = toolKey(pf);
  if (!fromApp(event)) return { ok: false, err: 'Not allowed.' };
  try {
    if (key === 'esphome') {
      await shell.openExternal(ESPHOME_URL);
      return { ok: true, launched: 'ide', err: '' };
    }
    if (key !== 'arduino' && key !== 'pi') return { ok: false, err: 'Unknown board type: ' + pf };
    const text = String(code == null ? '' : code);
    if (!text.trim()) return { ok: false, err: 'There is no code to open yet.' };
    if (text.length > 5 * 1024 * 1024) return { ok: false, err: 'The code is too big to open.' };

    const name = safeName(filename);
    const root = defaultDir(key);
    let dir, file;
    if (key === 'arduino') {
      // The Arduino IDE wants each sketch in a folder with the same name: <sketchbook>/<name>/<name>.ino
      dir = path.join(root, name);
      file = path.join(dir, name + '.ino');
    } else {
      dir = root;
      file = path.join(dir, name + '.py');
    }
    fs.mkdirSync(dir, { recursive: true });
    writeKeepingOld(file, text);

    const exe = findProgram(key);
    if (exe) {
      const r = await openWith(exe, file);
      if (r.ok) return { ok: true, file, dir, launched: 'ide', err: '' };
      console.warn('EvenUCan: could not start', exe, r.err);
    }
    const err = await shell.openPath(file);
    if (!err) return { ok: true, file, dir, launched: 'default', err: exe ? '' : TOOL_NAMES[key] + ' wasn\'t found, so the file was opened with this computer\'s usual program for it.' };
    return { ok: true, file, dir, launched: '', err: TOOL_NAMES[key] + ' wasn\'t found on this computer, so it couldn\'t be opened. The file is saved: install ' + TOOL_NAMES[key] + ', then open it from there.' };
  } catch (e) {
    console.error('EvenUCan: open in IDE failed', key, e);
    return { ok: false, err: String((e && e.message) || e) };
  }
});

// ---------------------------------------------------------------- "Watch phone photo folder"
// Watches a normal folder (for example OneDrive\Pictures\Camera Roll, where phone photos are copied) and sends each
// new photo to the page. Works for any user: the folder is either found automatically or picked once with a dialog.
const PHOTO_EXT = /\.(jpe?g|png|webp|heic)$/i;
const PHOTO_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
const photoWatch = { timer: null, dir: '', seen: new Set(), sizes: new Map(), startTime: 0, sender: null, busy: false };

// Where phone photos show up on a Windows PC, checked in this order. The first folder that exists is watched.
//  - Phone Link (Windows 11, Android and Samsung): CrossDevice<phone name>storageDCIMCamera
//  - iCloud for Windows (iPhone): PicturesiCloud PhotosDownloads   (not tested on this PC)
//  - OneDrive camera upload (phone to OneDrive): OneDrivePicturesCamera Roll
//  - Any normal Camera Roll folder
// If none exists, the user is asked to pick a folder once.
function phoneCameraFolder() {
  const base = path.join(os.homedir(), "CrossDevice");
  let phones = [];
  try { phones = fs.readdirSync(base); } catch { return ""; }
  for (const p of phones) {
    const cam = path.join(base, p, "storage", "DCIM", "Camera");
    if (isDir(cam)) return cam;
  }
  return "";
}

function guessPhotoFolder() {
  const home = os.homedir();
  return phoneCameraFolder() || [
    path.join(home, "Pictures", "iCloud Photos", "Downloads"),
    path.join(home, "OneDrive", "Pictures", "Camera Roll"),
    path.join(home, "Pictures", "Camera Roll")
  ].find((d) => isDir(d)) || "";
}

function listPhotoNames(dir) {
  return fs.readdirSync(dir).filter((n) => PHOTO_EXT.test(n));
}

async function photoWatchTick() {
  if (!photoWatch.timer || photoWatch.busy || !photoWatch.dir) return;
  // the measure window was closed: stop watching
  if (!photoWatch.sender || photoWatch.sender.isDestroyed()) { stopPhotoWatch(); return; }
  photoWatch.busy = true;
  try {
    // New = a photo name that was not in the folder when watching started. Times are not used: a photo
    // copied from the phone keeps its original capture time.
    const fresh = [];
    for (const name of listPhotoNames(photoWatch.dir)) {
      if (photoWatch.seen.has(name)) continue;
      try {
        const full = path.join(photoWatch.dir, name);
        const st = fs.statSync(full);
        if (st.isFile()) fresh.push({ name, full, st });
      } catch { /* removed or still being written */ }
    }
    fresh.sort((a, b) => a.st.mtimeMs - b.st.mtimeMs);
    const item = fresh[0];
    if (!item) return;
    // wait until the size stops changing (the photo is still being copied in)
    if (photoWatch.sizes.get(item.name) !== item.st.size) {
      photoWatch.sizes.set(item.name, item.st.size);
      return;
    }
    if (photoWatch.sender && !photoWatch.sender.isDestroyed()) {
      try {
        const data = fs.readFileSync(item.full);
        photoWatch.seen.add(item.name);   // only after a successful read; a half-copied file is tried again
        photoWatch.sender.send('photo-watch-new', {
          name: item.name,
          type: PHOTO_MIME[path.extname(item.name).slice(1).toLowerCase()] || 'image/jpeg',
          mtime: item.st.mtimeMs,
          data: new Uint8Array(data)
        });
      } catch { /* still being copied: try next tick */ }
    }
  } catch (e) {
    console.warn('EvenUCan: photo watch error', e);
  } finally {
    photoWatch.busy = false;
  }
}

function stopPhotoWatch() {
  if (photoWatch.timer) clearInterval(photoWatch.timer);
  photoWatch.timer = null;
  photoWatch.sender = null;
  return { ok: true };
}

ipcMain.handle('photo-watch-start', async (event, dirArg) => {
  if (!fromApp(event)) return { ok: false, dir: '', err: 'Not allowed.' };
  try {
    const s = readSettings();
    let dir = String(dirArg || '');
    if (!dir) dir = isDir(s.photoDir) ? s.photoDir : guessPhotoFolder();
    if (!dir) {
      const r = await dialog.showOpenDialog(getWindow() || undefined, {
        title: 'Choose the folder your phone photos go to',
        message: 'Pick the folder where new phone photos appear, for example OneDrive > Pictures > Camera Roll.',
        buttonLabel: 'Watch this folder',
        defaultPath: os.homedir(),
        properties: ['openDirectory']
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false, dir: '', err: 'cancelled' };
      dir = r.filePaths[0];
    }
    if (!isDir(dir)) return { ok: false, dir, err: 'That folder was not found.' };
    writeSettings({ photoDir: dir });

    stopPhotoWatch();
    photoWatch.dir = dir;
    photoWatch.startTime = Date.now();
    photoWatch.sizes = new Map();
    // photos already in the folder are not sent; only photos that appear after this
    photoWatch.seen = new Set(listPhotoNames(dir));
    photoWatch.sender = event.sender;
    photoWatch.timer = setInterval(photoWatchTick, 1000);
    return { ok: true, dir, err: '' };
  } catch (e) {
    console.error('EvenUCan: photo watch start failed', e);
    return { ok: false, dir: '', err: String((e && e.message) || e) };
  }
});

ipcMain.handle('photo-watch-stop', (event) => (fromApp(event) ? stopPhotoWatch() : { ok: false }));

// Save a file into the EvenUCan Projects folder (the one in your Documents) and open Explorer with it selected.
ipcMain.handle('save-app-file', async (event, nameArg, textArg) => {
  if (!fromApp(event)) return { ok: false, file: '', err: 'Not allowed.' };
  try {
    const dir = defaultDir('projects');
    fs.mkdirSync(dir, { recursive: true });
    const name = String(nameArg || 'file.txt').replace(/[^a-zA-Z0-9._-]/g, '_');
    const file = path.join(dir, name);
    fs.writeFileSync(file, String(textArg || ''), 'utf8');
    shell.showItemInFolder(file);
    return { ok: true, file, err: '' };
  } catch (e) {
    return { ok: false, file: '', err: String((e && e.message) || e) };
  }
});

}

module.exports = { register };
