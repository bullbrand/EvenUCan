// EvenUCan - 19-build-plates.js
// Build plates: up to 5 plates, all the same size (your printer's bed). Each plate holds its own parts.
// The highlighted plate is the live `model`; the others are kept in plateStore until you switch to them.
// Tools, export and the print check always work on the highlighted plate.
'use strict';

const MAX_PLATES = 5;
let plateList = [{ name: '' }];   // name '' shows as "Plate N"; a name shows as "N · name"
let plateIdx = 0;                 // the highlighted plate
let plateStore = [null];          // parts of the plates that are not highlighted: {faces, edges, guides}

const plateLabel = function plateLabel(i) {
  const n = plateList[i].name;
  return n ? (i + 1) + ' · ' + n : 'Plate ' + (i + 1);
};

// Everything about every plate, for the autosave and the project file
const platesSave = function platesSave() {
  const list = plateList.map((p, i) => {
    const m = i === plateIdx ? model : (plateStore[i] || { faces: [], edges: [], guides: [] });
    return { name: p.name, faces: m.faces || [], edges: m.edges || [], guides: m.guides || [] };
  });
  return { active: plateIdx, list };
};

// Put the plates back from a saved project (no data = one plate)
const platesLoad = function platesLoad(d) {
  if (!d || !Array.isArray(d.list) || !d.list.length) { platesReset(); return; }
  plateList = d.list.map(p => ({ name: String(p.name || '').slice(0, 30) }));
  plateStore = d.list.map(p => ({ faces: p.faces || [], edges: p.edges || [], guides: p.guides || [] }));
  plateIdx = Math.min(Math.max(0, parseInt(d.active, 10) || 0), plateList.length - 1);
  model = { faces: plateStore[plateIdx].faces, edges: plateStore[plateIdx].edges, guides: plateStore[plateIdx].guides };
  plateStore[plateIdx] = null;
  fixIds(); lastShape = null; selection.clear(); clearHistory();
  plateBarRender();
};

// A new drawing: one plate
const platesReset = function platesReset() {
  plateList = [{ name: '' }];
  plateIdx = 0;
  plateStore = [null];
  plateBarRender();
};

const switchPlate = function switchPlate(i) {
  if (i === plateIdx || i < 0 || i >= plateList.length) return;
  if (tool && tool.cancel) tool.cancel();
  plateStore[plateIdx] = { faces: model.faces, edges: model.edges, guides: model.guides };
  const t = plateStore[i];
  model = { faces: t.faces, edges: t.edges, guides: t.guides };
  plateStore[i] = null;
  plateIdx = i;
  fixIds(); lastShape = null; selection.clear(); clearHistory();
  plateBarRender();
  commitChange();
  flash('Now on ' + plateLabel(plateIdx) + '.', 2500);
};

const addPlate = function addPlate() {
  if (plateList.length >= MAX_PLATES) { flash('Up to ' + MAX_PLATES + ' build plates.', 3500); return; }
  plateList.push({ name: '' });
  plateStore.push({ faces: [], edges: [], guides: [] });
  switchPlate(plateList.length - 1);
};

const removePlate = function removePlate(i) {
  if (plateList.length <= 1) { flash('Keep at least one build plate.', 3500); return; }
  const parts = i === plateIdx ? model.faces.length : ((plateStore[i] || { faces: [] }).faces || []).length;
  if (parts && !confirm('Remove ' + plateLabel(i) + ' and the parts on it?')) return;
  if (i === plateIdx) switchPlate(i > 0 ? i - 1 : 1);   // move off it first
  plateList.splice(i, 1);
  plateStore.splice(i, 1);
  if (plateIdx > i) plateIdx--;
  plateBarRender();
  commitChange();
  flash(plateLabel(plateIdx) + ' is now highlighted. The plates were renumbered.', 3500);
};

let plateRenaming = null;   // the plate being named (its name box is shown in the bar), or null
const renamePlate = function renamePlate(i) {
  plateRenaming = i;
  plateBarRender();
  setTimeout(function () { const t = document.getElementById('plateNameIn'); if (t) { t.focus(); t.select(); } }, 0);
};
const finishRename = function finishRename(save) {
  if (plateRenaming === null) return;
  const i = plateRenaming;
  const t = document.getElementById('plateNameIn');
  plateRenaming = null;
  if (save && t && i < plateList.length) plateList[i].name = t.value.trim().slice(0, 30);
  plateBarRender();
  if (save) commitChange();
};
const choosePreset = function choosePreset(name) {
  if (plateRenaming === null) return;
  plateList[plateRenaming].name = name === 'clear' ? '' : name;
  plateRenaming = null;
  plateBarRender();
  commitChange();
};
const renameBox = function renameBox() {
  const cur = plateList[plateRenaming].name.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return '<span style="opacity:.7">Name for ' + (plateRenaming + 1) + ':</span>' +
    '<input id="plateNameIn" value="' + cur + '" maxlength="30" placeholder="photoplate, largegantry..." style="padding:4px 6px;border-radius:4px;border:1px solid var(--line,#555);background:var(--bg,#fff);color:var(--text,inherit);width:200px">' +
    '<div style="width:100%;display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' +
    ['photoplate', 'largegantry', 'smallgantry', 'printer bed'].map(n => '<button data-plate="preset:' + n + '" style="padding:4px 10px;border-radius:4px;border:1px solid var(--line,#555);background:transparent;color:var(--text,inherit);cursor:pointer">' + n + '</button>').join('') +
    '<button data-plate="preset:clear" style="padding:4px 10px;border-radius:4px;border:1px solid var(--line,#555);background:transparent;color:var(--text,inherit);cursor:pointer">No name (number only)</button></div>' +
    '<button data-plate="saveName" style="padding:4px 10px;border-radius:4px;border:1px solid var(--line,#555);background:var(--accent,#1e5af0);color:#fff;cursor:pointer">OK</button>' +
    '<button data-plate="cancelName" style="padding:4px 10px;border-radius:4px;border:1px solid var(--line,#555);background:transparent;color:var(--text,inherit);cursor:pointer">Cancel</button>';
};

// The plate bar, above the toolbar
const plateBarRender = function plateBarRender() {
  let bar = document.getElementById('plateBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'plateBar';
    bar.style.cssText = 'position:absolute;bottom:6px;left:6px;z-index:20;display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;border:1px solid var(--line,#444);background:var(--panel,#1a1e26);font:13px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);white-space:nowrap';
    // Float it over the drawing area: the page is a fixed grid, so no new row can be added to it
    const view = document.getElementById('view');
    if (view) view.appendChild(bar); else document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      const b = e.target.closest('button[data-plate]');
      if (!b) return;
      const act = b.dataset.plate;
      if (act.indexOf('preset:') === 0) { choosePreset(act.slice(7)); return; }
      if (act === 'rename') renamePlate(plateIdx);
      else if (act === 'saveName') finishRename(true);
      else if (act === 'cancelName') finishRename(false);
      else if (act === 'add') addPlate();
      else if (act === 'remove') removePlate(plateIdx);
      else switchPlate(parseInt(act, 10));
    });
    bar.addEventListener('keydown', function (e) {
      if (plateRenaming === null) return;
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finishRename(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finishRename(false); }
    });
    bar.addEventListener('dblclick', function (e) {
      const b = e.target.closest('button[data-plate]');
      if (b && /^\d+$/.test(b.dataset.plate)) renamePlate(parseInt(b.dataset.plate, 10));
    });
  }
  const btn = (label, attrs, on, title) =>
    '<button ' + attrs + ' title="' + title + '" style="padding:4px 10px;border-radius:4px;border:1px solid var(--line,#555);cursor:pointer;' +
    (on ? 'background:var(--accent,#1e5af0);color:#fff;font-weight:600' : 'background:transparent;color:var(--text,inherit)') + '">' + label + '</button>';
  const tabs = plateList.map((p, i) => btn(plateLabel(i), 'data-plate="' + i + '"', i === plateIdx,
    'Click to work on this plate. Double-click to name it.')).join('');
  if (plateRenaming !== null) { bar.innerHTML = renameBox(); return; }
  bar.innerHTML =
    '<span style="opacity:.7;margin-right:4px">Build plate:</span>' + tabs +
    btn('✎ Name', 'data-plate="rename"', false, 'Name the highlighted plate (for example photoplate or largegantry)') +
    btn('+', 'data-plate="add"', false, 'Add a build plate (up to ' + MAX_PLATES + ')') +
    btn('−', 'data-plate="remove"', false, 'Remove the highlighted plate (its parts go with it)') +
    '<span style="opacity:.6;margin-left:6px">' + plateList.length + ' of ' + MAX_PLATES + '</span>';
};

// Start: the plates saved in the autosave come back when the app opens
try {
  const a = JSON.parse(store.get('autosave') || 'null');
  if (a && a.plates) platesLoad(a.plates);
  else plateBarRender();
} catch (e) {
  console.warn('EvenUCan: could not restore the build plates', e);
  plateBarRender();
}
