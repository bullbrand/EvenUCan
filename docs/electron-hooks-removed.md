# Electron / desktop-bridge hooks removed

The release this project was copied from ran inside Electron. Electron injected one object,
`window.wfNative`, and the app code branched on it. All of that is removed so the app is plain
HTML / JS / CSS. This is the checklist for putting Electron back **cleanly**.

The untouched code is git commit `ff02e64` ("Untouched copy..."). To see any removed code:
`git show ff02e64:js/enclosure-wizard.js`

## The bridge: `window.wfNative` methods the app expected

| Method | What it did | Where it was used |
|---|---|---|
| `checkTool(id)` | Is ESPHome / Arduino IDE / Thonny installed on this computer? Returned `{found, path}` | Welcome wizard step 4 (`ai-and-surgery.js`), Wiring "get the software" link (`enclosure-wizard.js`) |
| `esphomeCheck(yaml, slug)` | Ran ESPHome's own config check on the generated YAML | "Check with ESPHome" button; the AI code loop re-asked the AI with ESPHome's errors (up to 3 tries) |
| `esphomeSend(text, base, overwrite)` | Saved the device YAML into the ESPHome folder, opened the dashboard | `openInIde()` handoff |
| `openInIde(kind, text, name)` | Saved a sketch/program and opened Arduino IDE / Thonny | `openInIde()` handoff |
| `chooseFolder(kind)` | Native folder picker | "Choose a different folder" |
| `fritzingList()` / `fritzingLoad(id)` | Read Fritzing parts installed on the computer | Parts browser (`partsSource()`) |
| `fetchPage(url)` / `fetchImage(url)` / `fetchPdf(url)` | Downloaded web pages, pictures and PDFs without browser CORS limits | Product-photo finder (removed whole) |
| `aiPost(url, key, body)` | Sent AI requests the browser can't (NVIDIA blocks web pages) | `oaChat()`; NVIDIA provider (removed whole) |
| `checkOllama()` / `launchOllama()` | Detected / started the local Ollama program | Ollama status box, "Start Ollama" button |
| `version()` | Real app version for the About box | `cad-engine.js` |

Preload/main files (`preload.js`, `main.js`, `netbridge.js`) were never in this folder.

## What was removed, by file

**`js/ai-and-surgery.js`**: bridge branch in the tool check (`wcCheckTool`), the `desk` flags and their
"installed and ready / we'll send your code" wording, the NVIDIA button and its note and click handlers.

**`js/cad-engine.js`**: `window.wfNative=undefined;` line, comments about the bridge, "desktop app" help text.
The `beforeunload` unsaved-changes prompt stays (normal web behaviour).

**`js/enclosure-wizard.js`**:
- Product-photo finder, removed whole: `picsHtml`, `showPics`, `photosFromPage`, `drawingScore`,
  `downloadPic`, `findMedia`, `readFoundDrawing`, `usePic`, `aiPics`, and the click handlers. Kept:
  `loadImg`, `toDataURL` (shared with other features) and `photoFrom` (credit text).
- NVIDIA provider, removed whole: `PROVIDERS.nvidia`, `KEY_HELP.nvidia`, `OA.nvidia`, `NV_TEXT`, `NV_VISION`,
  `nvChat`, `nvidia()`, the "desktop only" warnings. (`nvSmall` kept: it shrinks pictures for Groq/OpenRouter too.)
- `oaChat()`: the `post`/`aiPost` branch; all providers now fetch directly.
- Ollama: `checkOllama` bridge line, "Start Ollama" button handler.
- ESPHome: "Check with ESPHome" button + handler, the ESPHome-check step inside the AI code loop.
  **Note:** that loop (`for(;tries<3;tries++)`, `errs`, the "fix what ESPHome found" prompt) now always
  exits on the first pass. The scaffolding was left so re-adding `esphomeCheck` is a small change.
- Open-in-IDE: the `esphomeSend` / `openInIde` / `chooseFolder` branches; the browser folder-picker path remains.
- Tool check (`toolLinkHtml`): always shows the download link now.
- Fritzing local list: `ensureLibraryReady()` is now an empty function; `partsSource()` uses the web library only.

**`measure-part.html`**: NVIDIA key / URL / model entries.

**`js/camera-snap-qr.js`, `js/cookbook-and-backup.js`**: comments / help text only.

## Left alone on purpose
- OpenRouter model ids containing `nvidia/...` (they are OpenRouter-hosted models).
- ESPHome's own "Desktop App" installer instructions (that's ESPHome's app, not ours).
- `start.bat` opens Edge/Chrome in `--app=` window mode: not Electron, no hooks.
- `server.py` routes (`/api/flash/*`, `/api/firmware/*`, `/api/find-photo`, `/api/proxy-image`, `/api/ai/chat`):
  local companion server, not Electron. `/api/find-photo` and `/api/proxy-image` exist but nothing in the app calls them now.
- Orphaned CSS for the removed photo strip (`.plPics`) remains in `css/app.css` and `css/enclosure-wizard.css` (harmless; tidy later).

## Suggested way back in
Add ONE adapter file (e.g. `js/native-bridge.js`) that defines `window.wfNative` and loads before
`cad-engine.js`, then re-add the feature branches from commit `ff02e64` one feature at a time.

## Status: what is back (desktop window, `start-desktop.bat`)
Electron lives in `electron/` (`main.js` opens the window and starts `server.py`; `preload.js` defines `window.wfNative`;
`native.js` does the work on the computer). The page has no Node access; only this app's own page may call the bridge.
The plain browser version (`start.bat`) is unchanged: every desktop branch checks `window.wfNative` first.

| Bridge method | State | Where the app uses it |
|---|---|---|
| `checkTool` | back | welcome wizard step 4 (`js/ai/09`), Wiring "get the software" link (`js/wizard/15`) |
| `checkOllama` / `launchOllama` | back | AI key dialog status + "Start Ollama" (`js/wizard/11`) |
| `openInIde` / `esphomeSend` / `chooseFolder` | back | "Open in ..." button and "Choose a different folder" (`js/wizard/16`) |
| `esphomeCheck` | back | "Check with ESPHome" button (`js/wizard/14`, `19`) and the AI code loop (`js/wizard/17`) |
| `version` | exposed, not used | the old build never read it either; the About box shows `APP_VERSION` |
| `aiPost` / `fetchPage` / `fetchImage` / `fetchPdf` | NOT back | needed only by the NVIDIA provider and the product-photo finder, both removed whole |
| `fritzingList` / `fritzingLoad` | NOT back | the old preload never exposed them either; the built-in library is used |
