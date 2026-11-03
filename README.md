# EvenUCan

### You bought the gear. Now what?

EvenUCan is a free program that takes you from a box of electronic bits to a finished, working gadget:

- **Tell it your idea** in your own words, for example "beep and message my phone when someone opens the shed".
- **It picks the parts** and checks they can really do the job.
- **It designs a 3D-printable box** that fits them, with holes for the sockets and buttons. Download it as 3MF or STL for your slicer.
- **It shows you how to wire it up**, wire by wire, with a tick-list.
- **It writes the code** for ESPHome, the Arduino IDE or a Raspberry Pi, opens it in the right program, and walks you through putting it on your board.

Everything runs on your own computer. Only the optional AI helper uses the internet.

## Download

Go to the **[Releases page](https://github.com/bullbrand/EvenUCan/releases/latest)** and pick one:

| You have | Download | How to start it |
|---|---|---|
| Any computer with Chrome or Edge | `EvenUCan_1.9.32_Web.zip` | Unzip it (right-click → **Extract All**), open the folder and double-click **EvenUCan.html**. Nothing to install. |
| Windows, and you want it installed | `EvenUCan-Setup-1.9.32.exe` | Double-click it. It installs in a few seconds and puts EvenUCan in the Start menu and on the desktop. |
| Windows, without installing | `EvenUCan-Portable-1.9.32.exe` | Double-click it. It runs straight away, from any folder or a USB stick. |
| Mac | `EvenUCan-1.9.32.dmg` | Open it and drag EvenUCan into Applications. The first time, if the Mac says it can't be opened, go to **System Settings → Privacy & Security** and click **Open Anyway**. |
| Linux | `EvenUCan-1.9.32.AppImage` or `.deb` | AppImage: right-click → Properties → allow running as a program, then double-click it. `.deb`: double-click to install (Ubuntu, Debian, Mint). |

### "Windows protected your PC"

The programs aren't signed by a big company, so the first time you run one, Windows SmartScreen may show a blue box. Click **More info**, then **Run anyway**. You only need to do this once.

### Checking a download is genuine

The Release also has **SHA256-checksums.txt**, a list of fingerprints. On Windows, open the folder holding the download, type `powershell` in the address bar and press Enter, then type `Get-FileHash "EvenUCan-Setup-1.9.32.exe"` (or the name of the file you downloaded). The code it shows must match the one in the list.

## Help

The **EvenUCan User Manual** (a PDF) comes with every download, and is under **File → Open User Manual** in the desktop app.

## For developers

The web app is a single file, `app/EvenUCan.html`. The desktop app wraps it with Electron (`main.js`, `preload.js`). See [README-Electron.md](README-Electron.md) to build it yourself. Pushing a tag such as `v1.9.32` makes GitHub Actions build the Windows, Mac and Linux versions and publish them on a Release.

## Licence

© 2026 David John Waugh. Free software under the GNU GPL v3 or later: see [app/LICENSE.txt](app/LICENSE.txt).
