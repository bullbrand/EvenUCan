// EvenUCan desktop shell (Electron).
// Starts the local companion server (server.py), waits until it answers, then shows the app in its own window.
// The app itself is plain HTML / JS / CSS and also runs without this shell (start.bat). Anything the browser
// cannot do on its own goes through electron/preload.js -> window.wfNative (see docs/electron-hooks-removed.md).
'use strict';
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// the web app's folder: next to electron/ while developing, <resources>/webapp in an installed copy (see package.json "build")
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'webapp') : path.join(__dirname, '..');
const PORT = 8080;
const URL_APP = `http://localhost:${PORT}/EvenUCan.html`;
let server = null;      // the python child we started (null when a server was already running)
let win = null;

const ping = () => new Promise(res => {
  const r = http.get({ host: '127.0.0.1', port: PORT, path: '/EvenUCan.html', timeout: 1500 }, x => { x.resume(); res(x.statusCode === 200); });
  r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); });
});
const wait = ms => new Promise(r => setTimeout(r, ms));

// An installed copy must never keep your work inside its own install folder (an update or uninstall wipes that folder, and
// the compile folders there are too deep for the uninstaller). Saved firmware goes in Documents\EvenUCan\firmware where you
// can see and back it up; the big compile cache goes in the local app-data folder. Run from the source folder (npm start)
// nothing changes: the server keeps them beside server.py as before.
const serverEnv = () => {
  if (!app.isPackaged) return process.env;
  const local = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'EvenUCan');
  return { ...process.env, EVENUCAN_DATA_DIR: path.join(local, 'data'), EVENUCAN_FIRMWARE_DIR: path.join(app.getPath('documents'), 'EvenUCan', 'firmware'), EVENUCAN_MODELS_DIR: path.join(app.getPath('documents'), 'EvenUCan', 'models'), EVENUCAN_PROJECTS_DIR: path.join(app.getPath('documents'), 'EvenUCan', 'Projects') };
};

const startServer = async () => {
  if (await ping()) return true;                                  // already running (e.g. from start.bat): reuse it
  for (const exe of ['python', 'python3', 'py']) {
    let failed = false;
    const p = spawn(exe, ['server.py'], { cwd: ROOT, windowsHide: true, stdio: 'ignore', env: serverEnv() });
    p.on('error', () => { failed = true; });
    for (let i = 0; i < 40 && !failed; i++) {
      await wait(250);
      if (await ping()) { server = p; return true; }
      if (p.exitCode !== null) break;
    }
    try { p.kill(); } catch (e) {}
  }
  return false;
};
// stop the helper server AND anything it started (compilers, flashing tools); on Windows that needs the whole process tree
const stopServer = () => {
  if (!server) return;
  const p = server; server = null;
  try { if (process.platform === 'win32' && p.pid) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true }); else p.kill(); } catch (e) {}
};

const makeWindow = () => {
  win = new BrowserWindow({
    width: 1400, height: 900, show: false, backgroundColor: '#ffffff', title: 'EvenUCan',
    icon: path.join(ROOT, 'icons', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(true);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // links to other sites open in the normal browser, not inside the app window
  win.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(`http://localhost:${PORT}/`)) shell.openExternal(url); return { action: url.startsWith(`http://localhost:${PORT}/`) ? 'allow' : 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`http://localhost:${PORT}/`)) { e.preventDefault(); shell.openExternal(url); } });
  // The page asks "don't close, there is unsaved work" (a normal browser shows its own Leave/Stay box; Electron shows nothing
  // and the X button would simply do nothing). Ask here instead: Leave closes the window, Stay keeps it open.
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', title: 'EvenUCan', buttons: ['Leave', 'Stay'], defaultId: 1, cancelId: 1, noLink: true,
      message: 'Close EvenUCan?',
      detail: 'Your project has changes that are not saved to a file. EvenUCan keeps an automatic copy of your last model, but use Save first if you want a file.'
    });
    if (choice === 0) event.preventDefault();   // preventDefault here means: ignore the page's objection and close
  });
  win.loadURL(URL_APP);
  win.on('closed', () => { win = null; });
};

const openManual = () => {
  const pdf = path.join(ROOT, 'EvenUCan User Manual.pdf');
  if (!fs.existsSync(pdf)) { dialog.showErrorBox('User Manual', 'The User Manual could not be found:\n' + pdf); return; }
  shell.openPath(pdf).then(err => { if (err) dialog.showErrorBox('User Manual', 'The User Manual could not be opened:\n' + err); });
};
const showAbout = () => dialog.showMessageBox(win || undefined, {
  type: 'info', title: 'About EvenUCan', message: `EvenUCan ${app.getVersion()}`, buttons: ['OK'],
  detail: '3D enclosure designer for novice makers: ESPHome / Arduino / Pi code generator.\n\n© David John Waugh. See LICENSE.txt for the licence.\n\n' +
    `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`
});
const buildMenu = () => Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [
    { label: 'Open User Manual', click: openManual },
    { label: 'Open in Browser', click: () => shell.openExternal(URL_APP) },
    { type: 'separator' }, { role: 'quit', label: 'Quit' } ] },
  { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  { label: 'Help', submenu: [{ label: 'User Manual', click: openManual }, { type: 'separator' }, { label: 'About EvenUCan', click: showAbout }] }
]));

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    if (!(await startServer())) {
      dialog.showErrorBox('EvenUCan could not start', 'EvenUCan needs Python to run its local helper, and could not start it.\n\nInstall Python 3 from python.org (tick "Add Python to PATH"), then open EvenUCan again.');
      app.quit(); return;
    }
    require('./native').register({ origin: `http://localhost:${PORT}`, getWindow: () => win });
    buildMenu();
    makeWindow();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', stopServer);
  process.on('exit', stopServer);
}
