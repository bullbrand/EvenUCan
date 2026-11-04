// EvenUCan desktop wrapper (Electron main process).
//
// The web app is shown from a private address, app://local/, which maps onto the folder holding
// EvenUCan.html and its parts-library JSON files:
//   - while developing (npm start): <project>/app
//   - in an installed copy:         <resources>/webapp   (put there by "extraResources" in package.json)
// Because the page itself comes from app://local/, its relative fetch('parts-library.json') calls
// land in the same folder, and localStorage / IndexedDB saves get their own stable origin.

const { app, BrowserWindow, Menu, protocol, net, shell, dialog, ipcMain } = require('electron');
const netbridge = require('./netbridge');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const SCHEME = 'app';
const HOST = 'local';
const START_PAGE = 'EvenUCan.html';
const START_URL = `${SCHEME}://${HOST}/${START_PAGE}`;

const WEB_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'webapp')
  : path.join(__dirname, 'app');

// Must happen before the app is ready. "standard" + "secure" give the page a real origin, so
// localStorage, IndexedDB, fetch() and WebAssembly all behave as they do on an https:// site.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
]);

// The page only fetches the parts library itself when it is served over http(s); otherwise it asks
// the user to pick the file. Teach that one check about app:// as the page is served, so the
// installed app loads the library automatically. The file on disk is never changed, so a newer
// EvenUCan.html can be dropped into app/ as is; if the check is ever rewritten this simply does
// nothing and the app falls back to asking for the file.
function patchHtml(html) {
  return html.replace(
    'if(!/^https?:$/.test(location.protocol))return null;',
    'if(!/^(https?|app):$/.test(location.protocol))return null;'
  );
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response('Not found', { status: 404 });

    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/' + START_PAGE;
    const file = path.normalize(path.join(WEB_DIR, rel));
    // Never serve anything outside the web app folder.
    if (file !== WEB_DIR && !file.startsWith(WEB_DIR + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    if (ext === '.html') {
      const html = patchHtml(await fs.promises.readFile(file, 'utf8'));
      return new Response(html, { headers: { 'content-type': type } });
    }
    // Large files (the 28 MB parts library) are streamed straight from disk.
    const res = await net.fetch(pathToFileURL(file).toString());
    return new Response(res.body, { status: res.status, headers: { 'content-type': type } });
  });
}

function isAppUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === SCHEME + ':' && x.host === HOST;
  } catch {
    return false;
  }
}

function openOutside(u) {
  try {
    const x = new URL(u);
    if (['http:', 'https:', 'mailto:'].includes(x.protocol)) shell.openExternal(u);
  } catch { /* ignore malformed links */ }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    title: 'EvenUCan',
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Keep the app inside its window: links to web sites open in the normal browser instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openOutside(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: 'allow' };
    openOutside(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(START_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function openManual() {
  const pdf = path.join(WEB_DIR, 'EvenUCan User Manual.pdf');
  if (!fs.existsSync(pdf)) {
    dialog.showErrorBox('User Manual', 'The User Manual could not be found:\n' + pdf);
    return;
  }
  shell.openPath(pdf).then((err) => {
    if (err) dialog.showErrorBox('User Manual', 'The User Manual could not be opened:\n' + err);
  });
}

// The app:// address only exists inside this program, so the browser gets the HTML file itself.
// (Opened that way, the browser will ask once for parts-library.json, as the web version does.)
function openInBrowser() {
  shell.openExternal(pathToFileURL(path.join(WEB_DIR, START_PAGE)).toString());
}

function showAbout() {
  dialog.showMessageBox(mainWindow || undefined, {
    type: 'info',
    title: 'About EvenUCan',
    message: `EvenUCan ${app.getVersion()}`,
    detail:
      '3D enclosure designer for novice makers — ESPHome/Arduino/Pi code generator.\n\n' +
      '© David John Waugh. See LICENSE.txt for the licence.\n\n' +
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
    buttons: ['OK']
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { label: 'About EvenUCan', click: showAbout },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open User Manual', click: openManual },
        { label: 'Open in Browser', click: openInBrowser },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Quit' }
      ]
    },
    // Edit and View use Electron's built-in roles so copy/paste shortcuts work (needed on macOS).
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'User Manual', click: openManual },
        ...(isMac ? [] : [{ type: 'separator' }, { label: 'About EvenUCan', click: showAbout }])
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- board software (window.wfNative)
// checkTool(pf): is the free program a board needs installed? Further down: esphomeSend, esphomeCheck, openInIde
// and chooseFolder. Only the app's own page (app://local/) may ask.

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
    return isAppUrl(event.senderFrame ? event.senderFrame.url : '');
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

// ---------------------------------------------------------------- internet requests for the page (netbridge.js)
// NVIDIA's AI and most shop / datasheet sites refuse requests straight from a web page, so the main process makes
// them. Only from the app's own page; http(s) only, with time and size limits; AI requests only to known AI hosts.
const bridgeCall = (fn) => async (event, ...args) => {
  if (!fromApp(event)) throw new Error('Not allowed.');
  return fn(...args.map((a) => String(a == null ? '' : a)));
};
ipcMain.handle('ai-post', bridgeCall(netbridge.aiPost));
ipcMain.handle('fetch-page', bridgeCall(netbridge.fetchPage));
ipcMain.handle('fetch-image', bridgeCall(netbridge.fetchImage));
ipcMain.handle('fetch-pdf', bridgeCall(netbridge.fetchPdf));

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
  const r = await dialog.showOpenDialog(mainWindow || undefined, {
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

// One copy at a time: starting it again just brings the open window to the front.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    buildMenu();
    createWindow();

    // macOS: clicking the Dock icon with no windows open opens a new one.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // macOS apps stay running after the last window closes; elsewhere, closing the window quits.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
