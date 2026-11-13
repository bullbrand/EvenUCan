# EvenUCan

## Source layout
`app/EvenUCan.html` is a **generated** single file (2.3 MB, ~12,900 lines). Electron and web.zip ship it as-is.
Edit the pieces in `src/` and run `node build.js` to regenerate it.

- `src/index.html` – HTML; each `<!-- INJECT path -->` line is replaced by that file's exact bytes
- `src/styles.css`, `src/wizard.css` – the two stylesheets
- `src/js/*.js` – all scripts, in load order as listed in `src/index.html`; `version.js` holds `APP_VERSION`
- `src/vendor/*` – embedded Anthropic SDK and Manifold WASM (minified, huge lines)

## Rules
- **Never read `app/EvenUCan.html` or `src/vendor/*` directly.** Use Grep with line numbers on `src/` instead.
- Never edit `app/EvenUCan.html` by hand; the next build overwrites it.
- After editing `src/`, run `node build.js`.
- Releases: `bump-and-push.ps1` bumps `package.json` + `src/js/version.js`, runs `node build.js`, then commits and pushes.
- `app/xEvenUCan.html` is an old backup; ignore it.
