# EvenUCan source layout

Plain HTML + JS + CSS. No build step, no Electron, no bundler. Run it with `start.bat` (starts `server.py`,
opens http://localhost:8080/EvenUCan.html) or any static web server.

## Folders

| Path | What it is |
|---|---|
| `EvenUCan.html` | The page. Loads every script in order (see below). |
| `css/` | `app.css` (main app), `enclosure-wizard.css` (wizard, parts library, guide windows), `cookbook.css`, `dark-theme.css` (whole-app dark mode), `ai-specialist.css`. Loaded in that order: later rules override earlier ones |
| `js/cad/` | The 3D drawing app, split into 18 ordered files (table below) |
| `js/wizard/` | **The Enclosure Wizard, split by wizard step** (see table) |
| `js/data/curated-parts.js` | Generated parts data from `parts-curated.json` (regenerate with `node tools/build-curated.js`; add `--check` to compare only) |
| `js/ai/` | AI helpers and "The Surgery", split into 9 ordered files (table below) |
| `js/cookbook-and-backup.js`, `js/camera-snap-qr.js` | Cookbook and backups; phone/camera photo capture |
| `js/vendor/` | Third-party code, not ours: Manifold 3D engine (`manifold-loader.js` + `manifold-wasm.b64.js`, kept as a script so the app also works opened from a file), Anthropic SDK bundle |
| `Modelfile` | Recipe for the EvenUCan assistant model (`evenucan-expert`, built on qwen2.5-coder:1.5b). Rebuild with `ollama create evenucan-expert -f Modelfile` |
| `js/app-window.js` | Small script that maximises the app window when opened as an installed app (was stuck at the top of the Anthropic SDK file) |
| `yaml-doctor.bundle.js`, `ino-doctor.js` | Code checkers for ESPHome YAML / Arduino sketches |
| `server.py`, `start.bat` | Local companion server (flashing, firmware library, AI proxy) |
| `parts-library.json`, `parts-curated.json` | Parts data |
| `docs/` | This file, the Electron removal log, the photo gantry project guide |

## `js/wizard/` : one file per part of the wizard

The files are plain scripts that **share one global scope**: a name declared in any file can be used in any
other file. The number is the load order; **do not reorder** (a file may use earlier files at load time).

| File | Wizard step | Contents |
|---|---|---|
| `01-core` | all | helpers, platforms (ESPHome / Arduino / Pi), the `_int` bridge, public stubs |
| `02-geometry-engine` | Box | Manifold 3D engine + background worker |
| `03-catalogue-and-storage` | Parts | part types, built-in parts, pins, saved parts library |
| `04-settings-and-strip` | all | wizard settings, "has the user chosen parts", workflow strip |
| `05-box-layout` | Box | automatic placement of parts |
| `06-box-solid-model` | Box | builds the box and lid, text debossing, plugs |
| `07-box-window` | Box | the Box Designer window |
| `08-parts-library` | Parts | Parts Library window and editor |
| `09-parts-picture` | Parts | part picture with features drawn on it |
| `10-parts-photo-measure` | Parts | straighten a photo, measure heights |
| `11-parts-ai-and-keys` | Parts | read a drawing with AI, AI providers, key dialogs |
| `12-wiring-diagram-and-doctor` | Wiring | wiring diagram, YAML/wiring doctor, wiring plan |
| `13-code-esphome-yaml` | Code | writes the ESPHome device file |
| `14-wiring-window` | Wiring | the Wiring window and its tabs |
| `15-code-ai-and-requirements` | Code | AI timer helpers, requirements check |
| `16-open-in-ide` | Open in IDE | save and hand the code to ESPHome / Arduino IDE / Thonny |
| `17-code-starter-and-ask-ai` | Code | starter program without AI, "what should it do", Ask AI chat |
| `18-flash-and-firmware` | Flash | build progress, board watcher, firmware library, flasher |
| `19-code-ino-doctor` | Code | INO Doctor and compiling a sketch |
| `20-parts-import-and-browser` | Parts | Fritzing import, parts browser, where parts come from |
| `21-guide-and-exports` | Guide | the step-by-step guide and the public `WFEnclosure` API |

### Rules for editing these files
1. Declare helpers as `const name = function(){...}` or `const name = (...)=>...` or `function name(){}` inside
   another function. **Do not add top-level `function name(){}`**: in a plain script that creates a property on
   `window` and can overwrite another script's `window.name`. (They were all converted to `const` when split.)
2. Top-level names must be unique across ALL wizard files (and not clash with `js/camera-snap-qr.js`, which
   is also not wrapped). A duplicate shows up as `SyntaxError: Identifier 'x' has already been declared`.
3. A line that runs at load time may only use things from files above it. Code inside functions can use anything.
4. Adding a file: create `js/wizard/NN-name.js`, add its `<script>` tag to `EvenUCan.html` in order, and add it
   to the list in `sw.js` (and bump `CACHE` there) so the offline copy updates.

## How the split was verified (2026-11-18)
Pre-split and post-split versions were loaded in headless Edge and compared: public API shape, 152 internal
members, the generated 3D box (809 faces, identical geometry hash), every Wiring tab, the generated ESPHome
file, YAML Doctor result, Parts Library and editor. All identical.

## `js/cad/` : the 3D drawing app
Same rules as `js/wizard/`: plain scripts, one shared scope, number = load order. The photo gantry and plate
generators are files 10 to 13.

| File | Contents |
|---|---|
| `01-core-math-model` | changelog, math, triangulation, model, electronics side of a project |
| `02-storage-and-warnings` | autosave, storage warnings, undo state |
| `03-groups-units-camera-picking` | groups, units, camera, picking |
| `04-webgl-renderer` | WebGL drawing (throws if the browser has no WebGL) |
| `05-ui-helpers-and-dimensions` | UI helpers, on-shape dimensions |
| `06-tools-drawing` | line, rectangle, circle and other drawing tools |
| `07-tools-solids` | 3D shapes, fillet, offset, follow me, slice |
| `08-toolbar-mouse-keyboard` | toolbar, copy/paste, mouse, right-click menu, keyboard |
| `09-files-and-export` | open/save, 3MF/STL export |
| `14-print-check-help-updates` | print check, help, menu wiring, version, update check |
| `15-solid-ops-text-shell` | Manifold solid operations, 3D text, shell |
| `16-holes-standoffs-lid` | holes, stand-offs, board mount, make lid |
| `17-menus-and-palette` | menu bar, add-on API, command palette |
| `18-history-viewcube-start` | history, view cube, start-up |

Six helper names in these files carry a `Cad` suffix (`$cad`, `escCad`, `cloneCad`, `markDirtyCad`,
`setHintCad`, `toolNameCad`) because the wizard files declare the same names.

## `js/ai/` : AI helpers and The Surgery
Same rules as the other two folders. These files load after the wizard because they read its `_int` object.
About 100 of their top-level names carry an `Ai` suffix (for example `$Ai`, `WFAi`, `customAi`): they are this
module's own copies of wizard values, kept separate so they cannot clash with the wizard's names.

| File | Contents |
|---|---|
| `01-core-and-imports` | takes the wizard's helpers from `_int` |
| `02-ai-chat` | the offline AI chat window |
| `03-intent-wizard` | the "describe your idea" wizard |
| `04-ai-parts-prompts` | the parts-selection rules and compliance-audit prompts |
| `05-missing-parts-ai` | asking the AI for parts it does not know |
| `06-surgery-and-doctors` | Brief Doctor, Parts Doctor, Electric Doctor, Specialist, learned rulebook |
| `07-training-suite` | the 10 beginner inputs test suite |
| `08-part-database-search` | search of the Fritzing / Eagle / KiCad part data |
| `09-welcome-and-setup` | welcome screen and first-run setup |

### CSS split check
`css/enclosure-wizard.css` was cut at its section boundaries into `enclosure-wizard.css`, `cookbook.css` and
`dark-theme.css`; joined together they are byte-identical to the original. The computed style of every element
(3,266 of them) in the wizard, main screen and Parts Library, in light and dark mode, matched before and after.

### Split verification (all three big files)
Every split was checked against the pre-split code in a real browser (public API, 3D box, photo jig/plate/gantry
generators, print check, Brief Doctor, training suite, every window's text and computed styles): all identical.
Largest file now: about 63 KB.
