// EvenUCan desktop: the small, safe bridge between the page and the main process (main.js).
// The page sees it as window.wfNative. Only these calls exist; the page gets no direct access to Node.
const { contextBridge, ipcRenderer } = require('electron');

const str = (v) => String(v == null ? '' : v);

contextBridge.exposeInMainWorld('wfNative', {
  // the app's version (shown bottom right and in About)
  version: () => ipcRenderer.invoke('app-version'),
  // is the program a board needs installed? pf: 'arduino' | 'esphome' | 'pi' -> {found, path, version}
  checkTool: (pf) => ipcRenderer.invoke('check-tool', str(pf)),
  // save the sketch / program where the Arduino IDE / Thonny finds it and start that program with it
  //   -> {ok, file, dir, launched: 'ide' | 'default' | '', err}
  openInIde: (pf, code, filename) => ipcRenderer.invoke('open-in-ide', str(pf), str(code), str(filename)),
  // put the device file in the ESPHome folder and open (or start) ESPHome
  //   -> {ok, found, exists, dir, file, opened: 'dashboard' | 'started' | 'app' | '', secretsOk, err}
  esphomeSend: (yaml, slug, overwrite) => ipcRenderer.invoke('esphome-send', str(yaml), str(slug), !!overwrite),
  // is ESPHome here and running? With a file, also check it like ESPHome's Validate -> {cli, dashboard, found, ok, out}
  esphomeCheck: (yaml, slug) => ipcRenderer.invoke('esphome-check', yaml == null ? '' : str(yaml), str(slug)),
  // let the user pick the ESPHome folder / Arduino sketchbook / Pi folder again -> {ok, dir}
  chooseFolder: (kind) => ipcRenderer.invoke('choose-folder', str(kind))
});
