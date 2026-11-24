// Runs before the page, with access to Electron. The page itself gets NO Node access.
// This is the ONE place the desktop bridge (window.wfNative) is defined; the app checks for it and falls back to
// plain browser behaviour when it is missing. Methods are added here one feature at a time.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const str = (v) => String(v == null ? '' : v);

const bridge = {
  // the app's version (shown in About)
  version: () => ipcRenderer.invoke('app-version'),
  // is the program a board needs installed? pf: 'arduino' | 'esphome' | 'pi' -> {found, path, version}
  checkTool: (pf) => ipcRenderer.invoke('check-tool', str(pf)),
  // is Local AI running right now, and what models does it have? -> {running, models:[{name,vision}]}
  // start Local AI (if it's installed but not running) -> {ok, err}
  // save the sketch / program where the Arduino IDE / Thonny finds it and start that program with it
  //   -> {ok, file, dir, launched: 'ide' | 'default' | '', err}
  openInIde: (pf, code, filename) => ipcRenderer.invoke('open-in-ide', str(pf), str(code), str(filename)),
  // put the device file in the ESPHome folder and open (or start) ESPHome
  //   -> {ok, found, exists, dir, file, opened: 'dashboard' | 'started' | 'app' | '', secretsOk, err}
  esphomeSend: (yaml, slug, overwrite) => ipcRenderer.invoke('esphome-send', str(yaml), str(slug), !!overwrite),
  // is ESPHome here and running? With a file, also check it like ESPHome's Validate -> {cli, dashboard, found, ok, out}
  esphomeCheck: (yaml, slug) => ipcRenderer.invoke('esphome-check', yaml == null ? '' : str(yaml), str(slug)),
  // let the user pick the ESPHome folder / Arduino sketchbook / Pi folder again -> {ok, dir}
  chooseFolder: (kind) => ipcRenderer.invoke('choose-folder', str(kind)),
  // watch a phone photo folder for new photos -> start(dir?) {ok, dir, err}; stop(); onNew(cb) gets {name, type, mtime, data}
  // save a file into the EvenUCan Projects folder and open Explorer at it -> {ok, file, err}
  saveAppFile: (name, text) => ipcRenderer.invoke('save-app-file', str(name), str(text)),
  photoWatch: {
    start: (dir) => ipcRenderer.invoke('photo-watch-start', str(dir || '')),
    stop: () => ipcRenderer.invoke('photo-watch-stop'),
    onNew: (cb) => { ipcRenderer.removeAllListeners('photo-watch-new'); ipcRenderer.on('photo-watch-new', (e, p) => cb(p)); }
  }
};

contextBridge.exposeInMainWorld('wfNative', bridge);
