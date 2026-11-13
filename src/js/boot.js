(function(){
'use strict';
const $=id=>document.getElementById(id);
// Perf-r1: debounce autosave/check/stats, triangulation cache
// ================================================================ maintenance changelog
// 1.9.25-r1 (2 Nov 2026) – reliability pass on top of 1.9.25. Surgical changes only:
//  1. Complete project save: saved .3mf files are now version 2. Besides the drawing, Metadata/opensketch.json
//     carries "electronics": the Enclosure Wizard settings, the ESPHome answers and the user's own parts the
//     wizard uses (see elecState / restoreElec). Version 1 files still open exactly as before (drawing only).
//     The autosave also keeps the wizard + ESPHome answers, and puts them back on startup if they went missing.
//  2. Autosave failure warning: if the browser's storage is full the autosave no longer fails silently; a red
//     bar says so (once, until autosave works again). A startup check warns if storage is nearly full.
//  3. Parts library: the web parts library is still only read when "Browse parts…" is first used, now with a
//     "Loading parts…" indicator; its search list is built once and reused; when the page is served over
//     http(s) the JSON files next to it are fetched instead of asking for them (file:// keeps the file picker).
//  4. Errors that matter (autosave restore, broken saved parts/wizard settings, geometry operations, opening
//     files, reading the parts library) are now logged to the console and, where the user is affected, shown.
//     Catches that deliberately ignore harmless failures are marked "// intentional".
// 1.9.25-r2 (2 Nov 2026) – Project Intent Wizard ("💡 What do I want to build?" in the Enclosure Wizard):
//  1. The user describes the gadget in plain words; their AI (the AI menu's provider) returns the kinds of parts
//     needed as JSON. Each is found among the built-in parts, the user's own parts, a few common modules
//     (SSD1306 OLED, BME280, PIR, buttons, LEDs…) and then the parts library; the Enclosure Wizard is filled in,
//     the wiring worked out and the ESPHome file written (intentWizard section in the Enclosure script).
//  2. Anything the code needs (an OpenWeatherMap key, a town, an ntfy.sh topic) is asked for and kept in
//     'intent_inputs.<key>'. A weather project gets a ready-made ESPHome weather block: OpenWeatherMap fetch,
//     the forecast on an SSD1306 OLED and a daily message to the phone by ntfy.sh (weatherYaml), without the AI.
//     The idea and answers also go to "Make it with AI" (esphWithAI) so it writes the rest of the behaviour.
//  3. Version 2 project files (and the autosave) carry the idea and the answers as electronics.intent.
//  4. Fix: with two or more I2C parts only the first reached the ESPHome file (planWiring listed only it).
//  5. Fix: the ESPHome LED strip option is rgb_order (channel_colors made ESPHome reject the file).
// 1.9.25-r3 (2 Nov 2026) – the Project Intent Wizard works for any project, on three platforms:
//  1. INTENT_PROMPT is general (any gadget) and the AI also suggests a platform: ESP32 + ESPHome, Arduino (Nano)
//     or Raspberry Pi (4), with platform_reason, code_description, code_libraries and a why for each part.
//  2. Platform buttons under the answer (the AI's pick preselected). Another choice swaps the board (PLATFORMS,
//     CTRL_PARTS: Nano / Pi 4 with pin data) and drops Wi-Fi parts and internet questions on the Arduino, with a
//     note, without asking the AI again (pfMatches). planWiring uses a board's own I2C pins (part.i2c).
//  3. A part not found gets "⚠ Not found in library" and "🔍 Look this up" (lookupPart): after a blocking
//     permission dialog the AI gives the typical size, pins, holes and sockets from its own knowledge (not the
//     internet); the result is shown first and, if accepted, added to the user's parts as approximate (AI lookup).
//  4. Arduino sketches (generateArduinoCode) and Raspberry Pi Python programs (generatePiCode), written by the
//     user's AI (callAI) from the idea, the parts and the wiring's pins, only when asked; Copy and Download. The
//     Wiring window's tab is "ESPHome YAML" for an ESP32 and "Code" otherwise.
//  5. Example ideas under the description box (Weather station, RV level checker, Plant watering reminder,
//     Motion alarm, Pet feeder timer).
//  6. Version 2 files carry intent_platform, intent_platform_override and intent_missing_parts_added; opening a
//     file (or the autosave) puts the looked-up parts back into the user's own parts.
// 1.9.25-r4 (2 Nov 2026) – Welcome window (openWelcome, in the intent wizard's window):
//  1. Shown on a fresh, empty start and after New: "💡 I have an idea for a gadget" or "✏️ I want to draw something
//     myself". "Don't show this when I open a new file" is kept as welcome_seen. "💡 Start a project" in the
//     menu bar always opens it; the Enclosure Wizard's "What do I want to build?" stays as a second way in.
//  2. The idea in three steps: the words (with example chips that also tick Step 2), what it should do, and the
//     board the user has (or "not sure"). Steps 2 and 3 are optional; together they make the description sent
//     to the wizard's own AI call (intentAnalyse), and a board the user has is preselected over the AI's pick.
//     Then the wizard's thinking and results steps, and "Looks good" opens the Enclosure Wizard.
//  3. Keyboard: Tab stays inside the window, Enter on a button, Ctrl+Enter for Next in the idea box, Esc closes.
// 1.9.90 (9 Nov 2026):
//  1. "What problem would you like to solve?" screen now shows on fresh start (openWelcome opens the
//     ask step, not the welcome step, so the conversational screen is always the first thing seen).
//  2. Battery sleep is now MANDATORY in every battery build: the AI prompt requires deep_sleep in
//     every ESPHome config and always chooses low-power components.
//  3. "Make it with AI" button in the ESPHome section moved above the "What should it do?" label
//     and textarea, so it is easier to find.
//  4. 💾 Projects button added to the main menubar so projects are always one click away.
// 1.9.37 (4 Nov 2026):
//  1. Desktop bridge: preload.js/main.js now provide aiPost, fetchPage, fetchImage and fetchPdf (netbridge.js:
//     http(s) only, aiPost only to the known AI hosts, time and size limits), so NVIDIA works in the desktop app.
//  2. Welcome: "About the AI helper" (what it does, free keys, what is sent, set up / test a key), "Carry on
//     without AI" (example projects or ticked parts -> the same box/wiring/code flow), the "needs a key" dead ends
//     replaced by a choice, and a no-AI starter sketch/program on the Code tab with the pins filled in.
//  3. Wiring picture: controller in the middle, labels only on used pins outside the boards (leader lines, no
//     overlaps), wires coloured by job with a key, focus on a wire/part/list row with a big label, one wire at a
//     time, wheel/pinch zoom, drag to pan, Fit; Save picture draws the whole view.

