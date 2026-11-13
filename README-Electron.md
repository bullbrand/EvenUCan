# EvenUCan: desktop app for Windows, Mac and Linux

## 1. What this folder is

This folder turns the EvenUCan web page into a proper desktop program, with its own window, icon, Start menu / Dock entry and installer, so people don't need a web browser to use it. It uses **Electron**, which is the same approach used by programs like Visual Studio Code and Slack.

From this one folder you get:

| File | For |
|---|---|
| `EvenUCan-Setup-1.9.41.exe` | Windows installer |
| `EvenUCan-Portable-1.9.41.exe` | Windows, no install: runs straight from a folder or USB stick |
| `EvenUCan-1.9.41.dmg` | Mac (one file works on both Apple Silicon and older Intel Macs) |
| `EvenUCan-1.9.41.AppImage` | Linux: runs on Ubuntu, Fedora, Mint and most others, nothing to install |
| `EvenUCan-1.9.41.deb` | Linux: installer for Ubuntu, Debian and Mint |

### What's in the folder

```
package.json        the project settings: name, version, how each installer is built
main.js             the small program that opens the window and shows EvenUCan.html
preload.js          the few desktop-only helpers the page may use (saving files, opening ESPHome or the Arduino IDE...)
netbridge.js        the desktop app's internet helper for the AI and Fill in automatically (only known AI sites; time and size limits)
app/                the web app itself: HTML, parts-library JSON files, manual, licence
                    (app/EvenUCan.html is generated: don't edit it by hand, edit src/ instead)
src/                the source pieces that build app/EvenUCan.html
  index.html          the page layout; each "<!-- INJECT path -->" line is replaced by that file's contents
  styles.css          main stylesheet
  wizard.css          wizard stylesheet
  vendor/             embedded Anthropic SDK (anthropic.html) and Manifold WASM (manifold.html), minified
  js/                 all the scripts, loaded in this order:
    boot.js             start-up
    geometry.js         geometry helpers
    tools.js            drawing tools
    app-shell.js        the main app window and shell
    version.js          APP_VERSION
    solids.js           3D solids
    menus-start.js      menus and the start screen
    wizard-catalogue.js wizard parts catalogue
    wizard-engine.js    wizard logic
    wizard-window.js    wizard window
    parts-photo.js      identify parts from a photo
    wiring.js           wiring
    handoff-ai.js       AI hand-off
    parts-import.js     parts import
    intent-wizard.js    "what do you want to make?" wizard
    parts-search.js     parts search / Fill in automatically
    guide-cookbook.js   guides and cookbook
build.js            run "node build.js" after editing src/ to regenerate app/EvenUCan.html
bump-and-push.ps1   release script: bumps the version, runs build.js, commits and pushes
build/              the app icons (placeholders for now: see section 4)
.github/workflows/  the instructions GitHub follows to build the installers for you
```

The app works exactly like the web version. Saved work is kept inside the app, and the parts library loads by itself, so users are never asked to find `parts-library.json`. The menu has **File → Open User Manual**, **File → Open in Browser** (opens the same page in your normal browser, in case it's ever needed) and **Help → About**.

The drawing, box design, wiring and ESPHome code all work offline. The wizard's AI helper (turning your idea into a parts list, and writing Arduino sketches) uses the internet with an AI key of your choice — or you can carry on without AI. Free options (no card needed): Google Gemini, Groq, OpenRouter, NVIDIA. Paid options: Anthropic Claude, ChatGPT / OpenAI, DeepSeek, Grok / xAI. NVIDIA's free AI works only in the desktop app: NVIDIA doesn't accept requests straight from a web page, so the desktop app sends them through `netbridge.js`, which only talks to the known AI sites.

## 2. Building it on your own computer (optional)

You don't have to do this, because GitHub can build everything for you (section 3). If you'd like to try it:

1. Install **Node.js** (the "LTS" version) from <https://nodejs.org>.
2. Open a terminal / command prompt in this folder.
3. Run `npm install` once. It downloads Electron (a few hundred MB) into a `node_modules` folder.
4. Run `npm start` to open the app straight away and try it.
5. Run `npm run dist` to make the installer for the computer you're on. The result appears in the `dist` folder.

Each computer can only build its own kind of installer properly: a Windows PC makes the `.exe`, a Mac makes the `.dmg`, and Linux makes the `.AppImage` and `.deb`. That's why GitHub's build service is the easy way to get all of them.

## 3. Letting GitHub build all the installers

1. Create a new repository on GitHub (for example `evenucan-desktop`).
2. Upload the contents of this folder to it. GitHub Desktop is the simplest way, or drag the files onto the repository page. Make sure the hidden `.github` folder goes too.
3. Every time you push to the `main` branch, GitHub builds all the installers automatically. It takes about 10–15 minutes.
4. To download them, open the repository, click **Actions**, click the latest run, then scroll down to **Artifacts**. There are three downloads: Windows, macOS and Linux.

### Making a proper Release (a public download page)

Add a **tag** that starts with `v`, for example `v1.9.41`:

- **GitHub Desktop:** History → right-click the latest commit → *Create Tag…* → `v1.9.41` → then *Push origin*.
- **On the GitHub website:** Releases → *Draft a new release* → *Choose a tag* → type `v1.9.41` → *Create new tag* → *Publish*.
- **Command line:** `git tag v1.9.41` then `git push origin v1.9.41`.

GitHub then builds everything and puts all the installers on a Release page that anyone can download from.

You can also start a build at any time without changing anything: **Actions → Build desktop apps → Run workflow**.

## 4. Replacing the placeholder icons

The icons in `build/` are temporary: a dark blue square with "W3D" on it. To use your own:

1. Make your icon as a **1024 × 1024 PNG**, square, ideally with a transparent background.
2. Create the three files:
   - `icon.png`: your PNG (512 × 512 or larger)
   - `icon.ico`: Windows format
   - `icon.icns`: Mac format
3. Free ways to convert the PNG: an online converter (search "png to ico" and "png to icns", e.g. cloudconvert.com or icoconvert.com), or **GIMP** (free from <https://www.gimp.org>), which can export `.ico` with *File → Export As*.
4. Put the three files in `build/`, replacing the old ones, and push to GitHub.

## 5. Releasing a new version of EvenUCan

1. Copy the new files into the `app/` folder, replacing the old ones: `EvenUCan.html`, the three `.json` files, and the manual / readme / licence if they've changed. Keep the same file names.
2. Open `package.json` and change the `"version"` line, e.g. `"version": "1.9.41",`. This number goes into the installer names and the About box.
3. Push to GitHub, then add a tag such as `v1.9.41` for a Release (section 3).

You don't need to change anything in your HTML for the desktop app. The small adjustment it needs, so that the parts library loads automatically, is made by `main.js` as the page opens. Your file on disk is never altered.

## 6. Mac: the "unidentified developer" warning

The Mac version isn't signed with an Apple Developer certificate (that costs $99 a year), so the first time it's opened macOS shows a warning. To open it:

1. Open the `.dmg` and drag **EvenUCan** into **Applications**.
2. In Applications, **right-click** (or Control-click) **EvenUCan** and choose **Open**, then click **Open** again in the warning box.
3. On newer macOS versions (Sequoia and later), if there's no Open button: open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to EvenUCan.

This is only needed the first time.

If a Mac ever says the app "is damaged and can't be opened", that's the same warning in a stricter form. Open **Terminal** and run:

```
xattr -cr "/Applications/EvenUCan.app"
```

Then open the app as normal.

## 7. Linux

**AppImage** (works on almost any Linux):

1. Download `EvenUCan-1.9.41.AppImage`.
2. Make it runnable, either by right-clicking it → *Properties* → *Permissions* → tick *Allow executing file as program*, or in a terminal:
   ```
   chmod +x EvenUCan-1.9.41.AppImage
   ```
3. Double-click it, or run `./EvenUCan-1.9.41.AppImage`.

On some newer Ubuntu versions an AppImage won't start until FUSE is installed: `sudo apt install libfuse2` (or `libfuse2t64` on Ubuntu 24.04).

**.deb** (Ubuntu / Debian / Mint): double-click it to install with the Software app, or run `sudo apt install ./EvenUCan-1.9.41.deb`. EvenUCan then appears in the applications menu.

## Notes

- `package.json` has a placeholder contact address in the `"maintainer"` line (`noreply@evenucan.invalid`). Linux `.deb` packages must have one, so it's there to let the build work. You can change it to your real email if you like.
- Users' saved work lives inside the desktop app and is separate from anything saved in a web browser. They can move designs across using the app's own save/open file features.
- No automatic updates are included. Users download the new installer when you publish a new version.
