/* INO Doctor: vets Arduino sketches (.ino) before they reach the compiler, like YAML Doctor does for ESPHome.
 * No dependencies. window.InoDoctor.diagnose(text, {pf:'arduino'|'esp32ide', board:'esp32-s3-devkitc-1'})
 *   -> { extracted, fixedText, changed, fixes:[str], flags:[{level:'warn'|'info', msg}], syntaxFailed:bool, note }
 * Safe problems are repaired automatically (fixes). Only things that can never compile set syntaxFailed.
 * The real compiler remains the final judge: this just catches the common AI mistakes early and cheaply.
 */
(function () {
  'use strict';

  // Take the sketch out of a ```cpp fence if the AI wrapped it in chat text.
  function extract(text) {
    const src = String(text || '');
    const re = /```[ \t]*([a-zA-Z+#]*)[ \t]*\r?\n([\s\S]*?)```/g;
    let m, best = null, found = 0;
    while ((m = re.exec(src))) {
      found++;
      const lang = (m[1] || '').toLowerCase();
      if (lang && !/^(c|cpp|c\+\+|ino|arduino|h)$/.test(lang)) continue;
      const body = m[2];
      const score = (/void\s+setup\s*\(/.test(body) ? 2 : 0) + (/void\s+loop\s*\(/.test(body) ? 2 : 0) + body.length / 100000;
      if (!best || score > best.score) best = { body, score };
    }
    if (best) return { text: best.body.replace(/\s+$/, '') + '\n', fromFence: true, blocks: found };
    return { text: src, fromFence: false, blocks: 0 };
  }

  // Blank out comments and string/char literals (keeping length and newlines) so structure checks ignore them.
  function mask(s) {
    let out = '', i = 0;
    const n = s.length;
    while (i < n) {
      const c = s[i], d = s[i + 1];
      if (c === '/' && d === '/') { while (i < n && s[i] !== '\n') { out += ' '; i++; } }
      else if (c === '/' && d === '*') {
        out += '  '; i += 2;
        while (i < n && !(s[i] === '*' && s[i + 1] === '/')) { out += s[i] === '\n' ? '\n' : ' '; i++; }
        if (i < n) { out += '  '; i += 2; }
      } else if (c === '"' || c === "'") {
        const q = c; out += q; i++;
        while (i < n && s[i] !== q && s[i] !== '\n') { if (s[i] === '\\') { out += ' '; i++; } out += ' '; i++; }
        if (i < n && s[i] === q) { out += q; i++; }
      } else { out += c; i++; }
    }
    return out;
  }

  function balance(masked) {
    const pairs = { ')': '(', ']': '[', '}': '{' }, stack = [];
    let line = 1;
    for (let i = 0; i < masked.length; i++) {
      const c = masked[i];
      if (c === '\n') line++;
      else if (c === '(' || c === '[' || c === '{') stack.push([c, line]);
      else if (pairs[c]) {
        const top = stack.pop();
        if (!top || top[0] !== pairs[c]) return `Unmatched "${c}" on line ${line}.`;
      }
    }
    if (stack.length) { const t = stack[stack.length - 1]; return `"${t[0]}" opened on line ${t[1]} is never closed.`; }
    return '';
  }

  const ESP_ONLY = /#include\s*<(WiFi|WiFiClient|WiFiClientSecure|WiFiMulti|HTTPClient|WebServer|ESPmDNS|Preferences|SPIFFS|LittleFS|BluetoothSerial|BLEDevice|esp_[\w]+|driver\/[\w]+|freertos\/[\w]+)\.h>/g;

  function diagnose(text, opts) {
    opts = opts || {};
    const isAvr = opts.pf === 'arduino';
    const fixes = [], flags = [];
    const ex = extract(text);
    let code = ex.text;
    const original = code;

    // ---- automatic repairs (safe, never change behaviour) ----
    const clean = code.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/ /g, ' ').replace(/\r\n/g, '\n');
    if (clean !== code) { code = clean; fixes.push('Replaced curly quotes / odd spaces copied from chat with plain ones.'); }
    if (ex.fromFence) fixes.push('Took the code out of the answer text' + (ex.blocks > 1 ? ' (picked the main one of ' + ex.blocks + ' code blocks)' : '') + '.');

    let m = mask(code);
    if (!/#include\s*<Arduino\.h>/.test(code)) {
      code = '#include <Arduino.h>\n' + code; fixes.push('Added #include <Arduino.h>.'); m = mask(code);
    }
    // #define names must be valid C names: letters, digits and _, never starting with a digit (e.g. "#define 5__ANODE_ 2" cannot compile)
    {
      const bad = [...new Set([...code.matchAll(/^[ \t]*#[ \t]*define[ \t]+([^\s(]+)/gm)].map(x => x[1]).filter(n => !/^[A-Za-z_]\w*$/.test(n)))];
      for (const n of bad) {
        let nn = n.replace(/[^A-Za-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (!nn || /^\d/.test(nn)) nn = 'PIN_' + nn;
        let cand = nn, k = 1;
        while (new RegExp('(?<![A-Za-z0-9_])' + cand + '(?![A-Za-z0-9_])').test(code)) cand = nn + '_' + (++k);
        const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        code = code.replace(new RegExp('(?<![A-Za-z0-9_])' + esc + '(?![A-Za-z0-9_])', 'g'), cand);
        fixes.push('Renamed "' + n + '" to "' + cand + '" (a name cannot start with a digit or contain symbols).');
      }
      if (bad.length) m = mask(code);
    }
    if (!/void\s+setup\s*\(/.test(m)) { code += '\nvoid setup() {\n}\n'; fixes.push('Added the missing setup() function (empty).'); m = mask(code); }
    if (!/void\s+loop\s*\(/.test(m)) { code += '\nvoid loop() {\n}\n'; fixes.push('Added the missing loop() function (empty).'); m = mask(code); }
    if (/Serial\s*\.\s*(print|println|printf|write)\s*\(/.test(m) && !/Serial\s*\.\s*begin\s*\(/.test(m)) {
      code = code.replace(/(void\s+setup\s*\(\s*\)\s*\{)/, '$1\n  Serial.begin(115200);');
      fixes.push('Added Serial.begin(115200) because the sketch prints to Serial.'); m = mask(code);
    }

    // ---- problems that can never compile ----
    let syntaxFailed = false;
    const bal = balance(m);
    if (bal) { syntaxFailed = true; flags.push({ level: 'warn', msg: 'Brackets do not match: ' + bal }); }
    if (/^\s*(Here'?s|Here is|Sure|Certainly|This sketch|I've|Below)\b/im.test(code.split('\n').slice(0, 3).join('\n'))) {
      syntaxFailed = true; flags.push({ level: 'warn', msg: 'The code starts with chat text instead of code.' });
    }

    // ---- board checks (warnings: the compiler decides) ----
    if (isAvr) {
      let h; ESP_ONLY.lastIndex = 0;
      const bad = new Set();
      while ((h = ESP_ONLY.exec(code))) bad.add(h[1] + '.h');
      if (bad.size) flags.push({ level: 'warn', msg: 'An Arduino Nano cannot use ' + [...bad].join(', ') + ' (ESP32-only, the Nano has no Wi-Fi). Switch to an ESP32 or remove this part of the code.' });
      if (/\b(ledcSetup|ledcAttach|ledcAttachPin|ledcWrite|touchRead|dacWrite|analogWriteResolution|xTaskCreate|esp_\w+)\s*\(/.test(m)) flags.push({ level: 'warn', msg: 'Uses ESP32-only functions that do not exist on an Arduino Nano.' });
    } else {
      if (/#include\s*<avr\/\w+\.h>/.test(code) || /\b(PORT[B-D]|DDR[B-D]|PIN[B-D]|TCCR\dA|OCR\d[AB])\b/.test(m)) flags.push({ level: 'warn', msg: 'Uses AVR (Arduino Nano) registers or avr/ headers, which do not exist on an ESP32.' });
      if (/\b(ledcSetup|ledcAttachPin)\s*\(/.test(m) && /\bledcAttach\s*\(/.test(m)) flags.push({ level: 'warn', msg: 'Mixes the old (ledcSetup) and new (ledcAttach) PWM functions: the ESP32 board package supports one style or the other.' });
      else if (/\b(ledcSetup|ledcAttachPin)\s*\(/.test(m)) flags.push({ level: 'info', msg: 'Uses ledcSetup/ledcAttachPin: fine on ESP32 board package 2.x, but removed in 3.x.' });
      else if (/\bledcAttach\s*\(/.test(m)) flags.push({ level: 'info', msg: 'Uses ledcAttach: fine on ESP32 board package 3.x, but missing in 2.x.' });
    }

    // ---- pins ----
    const defs = {};
    code.replace(/^[ \t]*#define[ \t]+([A-Za-z_]\w*)[ \t]+(\d+)[ \t]*(?:\/\/.*)?$/gm, (_, k, v) => { defs[k] = +v; return ''; });
    const resolve = a => { a = a.trim(); return /^\d+$/.test(a) ? +a : (a in defs ? defs[a] : null); };
    const outputs = new Set(), written = new Set(), configured = new Set();
    let r; const reMode = /pinMode\s*\(\s*([A-Za-z_]\w*|\d+)\s*,\s*([A-Z_]+)/g;
    while ((r = reMode.exec(m))) { const p = resolve(r[1]); if (p !== null) { configured.add(p); if (r[2] === 'OUTPUT') outputs.add(p); } }
    const reW = /(digitalWrite|analogWrite)\s*\(\s*([A-Za-z_]\w*|\d+)\s*,/g;
    while ((r = reW.exec(m))) { const p = resolve(r[2]); if (p !== null) written.add(p); }
    for (const p of written) if (!configured.has(p) && !/ledc/.test(m)) flags.push({ level: 'info', msg: 'Pin ' + p + ' is written to but never set with pinMode(...,OUTPUT).' });
    if (!isAvr) {
      const s3 = /s3/i.test(opts.board || '');
      const flash = s3 ? [26, 27, 28, 29, 30, 31, 32] : [6, 7, 8, 9, 10, 11];
      for (const p of new Set([...configured, ...written])) {
        if (flash.includes(p)) flags.push({ level: 'warn', msg: 'GPIO' + p + ' is connected to the ESP32\'s flash memory: using it will crash the board. Pick a different pin.' });
        if (!s3 && p >= 34 && p <= 39 && (outputs.has(p) || written.has(p))) flags.push({ level: 'warn', msg: 'GPIO' + p + ' is input-only on the ESP32: it cannot drive an output.' });
      }
    } else {
      for (const p of new Set([...configured, ...written])) if (p > 21) flags.push({ level: 'warn', msg: 'Pin ' + p + ' does not exist on an Arduino Nano (pins are 0-13 and A0-A7 = 14-21).' });
      if (/Wire\s*\.\s*begin/.test(m) && [...configured, ...written].some(p => p === 18 || p === 19)) flags.push({ level: 'warn', msg: 'Pins A4/A5 (18/19) are the I2C bus: they cannot also be used as normal pins while Wire is in use.' });
    }
    if (Array.isArray(opts.pins) && opts.pins.length) {
      for (const p of new Set([...configured, ...written])) if (!opts.pins.includes(p)) flags.push({ level: 'warn', msg: 'Pin ' + p + ' is not in your wiring plan.' });
    }

    // ---- libraries (the compiler needs these installed) ----
    const hdrLibs = /LIBRARIES_NEEDED/.test(code);
    if (!hdrLibs && /#include\s*<(?!Arduino\.h|Wire\.h|SPI\.h|EEPROM\.h|Servo\.h|SoftwareSerial\.h|WiFi|HTTP|WebServer|ESP|Preferences|FS\.h|SPIFFS|LittleFS|SD\.h|Update\.h|esp_|driver\/|avr\/|freertos\/|math|string|stdlib|time)/.test(code))
      flags.push({ level: 'info', msg: 'Uses extra libraries but has no "// LIBRARIES_NEEDED:" list at the top, so it is not obvious what to install.' });

    // ---- behaviour ----
    const big = /delay\s*\(\s*(\d{5,})\s*\)/.exec(m);
    if (big) flags.push({ level: 'info', msg: 'delay(' + big[1] + ') freezes the whole sketch for a long time: consider millis() timing.' });

    const changed = code !== original;
    return {
      extracted: ex.text, fixedText: code, changed, fixes, flags, syntaxFailed,
      note: syntaxFailed ? 'INO Doctor found a problem it cannot fix by itself.' : (fixes.length ? 'INO Doctor repaired ' + fixes.length + ' small thing(s).' : 'INO Doctor found nothing to repair.')
    };
  }

  window.InoDoctor = { diagnose, extract };
})();
