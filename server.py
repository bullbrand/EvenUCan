#!/usr/bin/env python3
"""
EvenUCan Local Server & Phone-to-PC Photo Bridge
=================================================
Zero-dependency HTTP server built on Python standard library.
Serves static files like `python -m http.server 8080` and provides:
  • GET  /api/ip           - Returns PC local LAN IPv4 address as JSON
  • GET  /snap             - Mobile capture web interface
  • POST /api/upload       - Accepts photo upload and stores in memory
  • GET  /api/latest-photo - Returns latest photo ID and base64 data
"""

import sys
import os
import re
import json
import base64
import socket
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from email.parser import BytesFeedParser
from email.policy import default
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import urllib.error
import html
import io
from PIL import Image

PORT = 8080
HOST = "0.0.0.0"

# Where this program keeps what it makes (compile folders, saved firmware, secrets, crash log). Normally beside server.py;
# the desktop app sets EVENUCAN_DATA_DIR so an update or uninstall never touches it.
DATA_DIR = os.environ.get("EVENUCAN_DATA_DIR") or os.path.dirname(os.path.abspath(__file__))
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except OSError:
    pass

# In-memory photo state
photo_store = {
    "current_id": 0,
    "filename": "",
    "mime": "",
    "data_url": "",
    "timestamp": 0
}


# -------------------------------------------------------------
# ESP32 Flash & Compile Job Manager
# -------------------------------------------------------------
flash_jobs = {}

def clean_build_env():
    """Environment for compiler/flasher subprocesses. A user who starts EvenUCan from Git Bash / MSYS would otherwise pass MSYSTEM
    variables down, and ESP-IDF's installer then refuses with "MSys/Mingw is not supported", which a beginner cannot diagnose."""
    env = os.environ.copy()
    for k in [k for k in env if k.upper().startswith(("MSYSTEM", "MINGW_", "MSYS2_"))] + ["MSYS", "CHERE_INVOKING"]:
        env.pop(k, None)
    env["PYTHONUNBUFFERED"] = "1"
    return env
flash_job_lock = threading.Lock()

def get_serial_ports():
    try:
        import serial.tools.list_ports
        return [{"port": p.device, "desc": p.description} for p in serial.tools.list_ports.comports()]
    except Exception:
        return []

def check_missing_drivers():
    """Detect if an ESP32 USB-to-UART chip (CP210x, CH340, FTDI) is plugged in but missing a driver (instant registry query)."""
    try:
        import winreg
        known_vids = [
            (r"SYSTEM\CurrentControlSet\Enum\USB\VID_10C4&PID_EA60", "CP2102 USB to UART Bridge"),
            (r"SYSTEM\CurrentControlSet\Enum\USB\VID_10C4&PID_EA70", "CP2105 Dual USB to UART Bridge"),
            (r"SYSTEM\CurrentControlSet\Enum\USB\VID_1A86&PID_7523", "CH340 USB to Serial Converter"),
            (r"SYSTEM\CurrentControlSet\Enum\USB\VID_1A86&PID_55D4", "CH9102 USB to Serial Converter"),
            (r"SYSTEM\CurrentControlSet\Enum\USB\VID_0403&PID_6001", "FT232R USB to Serial Converter"),
        ]
        for subpath, name in known_vids:
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, subpath)
                for i in range(winreg.QueryInfoKey(key)[0]):
                    dev_key = winreg.OpenKey(key, winreg.EnumKey(key, i))
                    vals = {winreg.EnumValue(dev_key, j)[0]: winreg.EnumValue(dev_key, j)[1] for j in range(winreg.QueryInfoKey(dev_key)[1])}
                    if 'Service' not in vals or (vals.get('ConfigFlags', 0) & 64):
                        desc = vals.get('DeviceDesc', name)
                        if '@' in desc: desc = name
                        return desc
            except Exception:
                continue
    except Exception:
        pass
    return None

def find_component_photos_online(query, max_results=10):
    if not query or not query.strip():
        return []

    # Generate cleaner search variations (strip brackets/parentheses with secondary pin/port notes)
    no_parens = re.sub(r'\(.*?\)', '', query)
    no_parens = re.sub(r'\[.*?\]', '', no_parens)
    no_parens = re.sub(r'[^a-zA-Z0-9 _-]', ' ', no_parens).strip()
    no_parens = re.sub(r'\s+', ' ', no_parens)
    
    clean = re.sub(r'[^a-zA-Z0-9 _-]', ' ', query).strip()
    clean = re.sub(r'\s+', ' ', clean)

    search_queries = []
    if no_parens and len(no_parens) >= 3:
        search_queries.append(f"{no_parens} top view")
        search_queries.append(f"{no_parens}")
    if clean and clean != no_parens:
        search_queries.append(f"{clean} top view")
        search_queries.append(f"{clean}")

    if not search_queries:
        search_queries = [query.strip()]

    candidates = []
    seen = set()

    def add_url(u):
        if not u or u in seen:
            return
        clean_u = u.split('?')[0].strip()
        if any(clean_u.lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.webp')):
            seen.add(clean_u)
            candidates.append(u)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    # 1. Bing Image search async endpoint (fast, high quality top-down product photos)
    for sq in search_queries:
        if len(candidates) >= max_results:
            break
        try:
            url = f"https://www.bing.com/images/async?q={urllib.parse.quote(sq)}&first=1&count=20&mmasync=1"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode('utf-8', errors='ignore')
                unescaped = html.unescape(raw)
                murls = re.findall(r'murl&quot;:&quot;(https?://[^&"]+)&quot;', raw)
                if not murls:
                    murls = re.findall(r'"murl":"(https?://[^"]+)"', unescaped)
                for mu in murls:
                    if not any(bad in mu.lower() for bad in ('logo', 'icon', 'avatar', 'facebook', 'twitter', 'banner', 'vector', 'illustration', 'clipart', 'stock-vector', 'freepik', '/image-vector/')):
                        add_url(mu)
                    if len(candidates) >= max_results:
                        break
        except Exception:
            pass

    # 2. Wikipedia pageimages / search as fallback (requesting thumbnail of reasonable size 800px)
    if len(candidates) < 3:
        for sq in (no_parens, clean):
            if not sq:
                continue
            try:
                wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(sq)}&gsrlimit=3&prop=pageimages&pithumbsize=800&format=json"
                req = urllib.request.Request(wiki_url, headers={'User-Agent': 'EvenUCan/1.9 (educational electronic tool)'})
                with urllib.request.urlopen(req, timeout=4) as r:
                    data = json.loads(r.read().decode('utf-8'))
                    pages = data.get('query', {}).get('pages', {})
                    for pid, p in pages.items():
                        thumb = p.get('thumbnail', {}).get('source')
                        if thumb:
                            add_url(thumb)
            except Exception:
                pass
            if len(candidates) >= 3:
                break

    return candidates

def find_component_photo_online(query):
    candidates = find_component_photos_online(query, max_results=1)
    return candidates[0] if candidates else None

def release_serial_port():
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/IM", "esphome-desktop.exe", "/T"], capture_output=True)
            subprocess.run(["taskkill", "/F", "/IM", "esphome_device_builder.exe", "/T"], capture_output=True)
    except Exception:
        pass

def clean_device_build(clean_name, build_dir):
    """Silently kill anything still working on this device and delete its leftover build files."""
    import shutil, stat
    if sys.platform == "win32":
        try:
            marker = build_dir.replace("'", "''")
            ps = ("Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne %d -and $_.CommandLine -and "
                  "($_.CommandLine -like '*%s*' -or $_.CommandLine -like '*esphome*run*%s.yaml*' -or "
                  "$_.CommandLine -like '*esphome*compile*%s.yaml*') } | ForEach-Object { taskkill /F /T /PID $_.ProcessId }"
                  ) % (os.getpid(), marker, clean_name, clean_name)
            subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, timeout=30)
        except Exception:
            pass
    with flash_job_lock:
        for j in flash_jobs.values():
            if j.get("name") == clean_name and j.get("status") == "running":
                j["status"] = "cancelled"
    time.sleep(1.5)
    target = os.path.join(build_dir, ".esphome", "build")

    def _onexc(func, path, exc):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass
    for _ in range(6):
        if not os.path.exists(target):
            break
        try:
            shutil.rmtree(target, onexc=_onexc)
        except TypeError:
            shutil.rmtree(target, onerror=lambda f, p, e: _onexc(f, p, e))
        except Exception:
            pass
        if os.path.exists(target):
            time.sleep(1.5)

def start_flash_job(name, yaml_text, port=None, action="run", clean=False):
    import uuid
    job_id = str(uuid.uuid4())[:8]
    clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip()) or "my_device"
    build_dir = os.path.join(DATA_DIR, "builds", clean_name)
    os.makedirs(build_dir, exist_ok=True)

    if clean:
        clean_device_build(clean_name, build_dir)

    # Never let two jobs build the same device at once: the second one wipes the build
    # folder out from under the first (WinError 32 / 145). Stop any earlier job first.
    with flash_job_lock:
        old_jobs = [j for j in flash_jobs.values()
                    if j.get("name") == clean_name and j.get("status") == "running"]
    for oj in old_jobs:
        p = oj.get("proc")
        if p and p.poll() is None:
            try:
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
                p.wait(timeout=10)
            except Exception:
                pass
        with flash_job_lock:
            oj["status"] = "cancelled"
            oj["logs"].append("CANCELLED: superseded by a newer run of the same device.")

    # Auto-release port and auto-heal YAML board if physical board is standard ESP32 vs ESP32-S3
    if port and port.strip():
        release_serial_port()
        try:
            probe = subprocess.run([sys.executable, "-m", "esptool", "--port", port.strip(), "--baud", "115200", "flash-id"], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=8)
            out = probe.stdout + probe.stderr
            # Classic ESP32 only: "ESP32-S3"/"ESP32-C3"/"ESP32-S2" must NOT match (they also start with "ESP32")
            if "ESP32-D0WD" in out or re.search(r"Detecting chip type\.\.\. ESP32(?![-\w])", out):
                if "esp32-s3-devkitc-1" in yaml_text:
                    yaml_text = yaml_text.replace("board: esp32-s3-devkitc-1", "board: esp32dev")
                    # Remove whole lines (indent included), or the next line is left over-indented and the YAML breaks.
                    yaml_text = re.sub(r'^[ \t]*flash_size:[ \t]*16MB[ \t]*\r?\n', '', yaml_text, flags=re.M)
                    yaml_text = re.sub(r'^psram:[ \t]*\r?\n(?:[ \t]+\S.*\r?\n?)*', '', yaml_text, flags=re.M)
                    if "pin: GPIO38" in yaml_text:
                        yaml_text = re.sub(r'(\s*-\s*platform:\s*esp32_rmt_led_strip\s*\n\s*id:\s*status_led\s*\n\s*name:\s*"Status light"\s*\n\s*pin:\s*GPIO38\s*\n\s*num_leds:\s*1\s*\n\s*rgb_order:\s*GRB\s*\n\s*chipset:\s*ws2812\n?)', '', yaml_text)
                        if "status_led:" not in yaml_text:
                            yaml_text += "\nstatus_led:\n  pin:\n    number: GPIO2\n"
                    # GPIO6/7 are flash pins on a classic ESP32 (both "pin: GPIO6" and "number: GPIO6" forms).
                    yaml_text = re.sub(r'\b(pin|number):(\s*)GPIO6\b', r'\1:\2GPIO18', yaml_text)
                    yaml_text = re.sub(r'\b(pin|number):(\s*)GPIO7\b', r'\1:\2GPIO19', yaml_text)
        except Exception:
            pass

    yaml_path = os.path.join(build_dir, f"{clean_name}.yaml")
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_text)

    # Ensure valid secrets.yaml exists in the build folder so ESPHome doesn't fail on !secret
    secrets_path = os.path.join(build_dir, "secrets.yaml")
    default_secrets = 'wifi_ssid: "MyHomeWiFi"\nwifi_password: "MyPassword"\nap_password: "EvenUCanPassword"\nota_password: "EvenUCanOtaPassword"\n'
    s_content = default_secrets
    if os.path.exists(secrets_path):
        try:
            with open(secrets_path, "r", encoding="utf-8") as rf:
                existing = rf.read()
            if "\\n" in existing:
                s_content = existing.replace("\\n", "\n")
            elif existing.strip():
                s_content = existing
        except Exception:
            s_content = default_secrets
    else:
        ref_secrets = os.path.join(DATA_DIR, "software", "secrets.yaml")
        if os.path.exists(ref_secrets):
            try:
                with open(ref_secrets, "r", encoding="utf-8") as rf:
                    s_content = rf.read().replace("\\n", "\n")
            except Exception:
                s_content = default_secrets
    with open(secrets_path, "w", encoding="utf-8") as sf:
        sf.write(s_content)

    cmd = [sys.executable, "-m", "esphome"]
    if action == "compile":
        cmd.extend(["compile", f"{clean_name}.yaml"])
    else:
        cmd.extend(["run", f"{clean_name}.yaml"])
        if port and port.strip():
            cmd.extend(["--device", port.strip(), "--upload_speed", "115200", "--no-logs"])
        else:
            cmd.append("--no-logs")

    job_state = {
        "id": job_id,
        "name": clean_name,
        "action": action,
        "port": port,
        "status": "running",
        "logs": [f"Starting ESPHome {action} for '{clean_name}'..."],
        "log_base": 0,  # number of lines already trimmed off the front of "logs"
        "exit_code": None,
        "proc": None,
        "start_time": time.time()
    }
    with flash_job_lock:
        flash_jobs[job_id] = job_state

    full_log = []

    def save_failure_log(reason):
        # Keep a history of failed runs for troubleshooting: builds/<device>/failures.log
        try:
            path = os.path.join(build_dir, "failures.log")
            header = "\n" + "=" * 70 + "\n" + time.strftime("%Y-%m-%d %H:%M:%S") + \
                f"  job={job_id} action={action} port={port or '-'}  {reason}\n" + "=" * 70 + "\n"
            old = ""
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8", errors="replace") as rf:
                    old = rf.read()[-300000:]
            with open(path, "w", encoding="utf-8") as wf:
                wf.write(old + header + "\n".join(full_log) + "\n")
        except Exception:
            pass

    def run_worker():
        try:
            env = clean_build_env()
            env["PYTHONUNBUFFERED"] = "1"
            proc = subprocess.Popen(
                cmd,
                cwd=build_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
                bufsize=1,
                env=env
            )
            job_state["proc"] = proc
            ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            for raw_line in iter(proc.stdout.readline, ''):
                clean = ansi_escape.sub('', raw_line)
                for part in clean.split('\r'):
                    clean_line = part.strip()
                    if clean_line:
                        if len(full_log) < 5000:
                            full_log.append(clean_line)
                        with flash_job_lock:
                            if len(job_state["logs"]) > 500:
                                dropped = len(job_state["logs"]) - 300
                                job_state["logs"] = job_state["logs"][-300:]
                                job_state["log_base"] += dropped
                            job_state["logs"].append(clean_line)
            proc.stdout.close()
            proc.wait()
            saved_fw = None
            if proc.returncode == 0:
                try:
                    saved_fw = fw_store_esphome_build(build_dir, clean_name)   # keep the full image for flashing more boards later
                except Exception:
                    saved_fw = None
            with flash_job_lock:
                job_state["exit_code"] = proc.returncode
                if proc.returncode == 0:
                    if saved_fw:
                        job_state["logs"].append(f"Saved a copy of the firmware to your library: {saved_fw['id']}.bin ({saved_fw['size']:,} bytes) so you can flash more boards without compiling again.")
                    job_state["logs"].append("SUCCESS: Process finished with exit code 0.")
                else:
                    job_state["logs"].append(f"FAILED: Process finished with exit code {proc.returncode}.")
                # Set status only after the final log line is in place
                job_state["status"] = "success" if proc.returncode == 0 else "error"
            if proc.returncode != 0 and job_state["status"] != "cancelled":
                full_log.append(f"FAILED: exit code {proc.returncode}")
                save_failure_log(f"FAILED exit code {proc.returncode}")
        except Exception as ex:
            with flash_job_lock:
                job_state["logs"].append(f"Execution error: {str(ex)}")
                full_log.append(f"Execution error: {str(ex)}")
                save_failure_log("EXECUTION ERROR")
                job_state["status"] = "error"
                job_state["exit_code"] = -1

    t = threading.Thread(target=run_worker, daemon=True)
    t.start()
    return job_id

TEST_BLINK_YAML = """esphome:
  name: evenucan-compiler-test

esp32:
  board: {board}
  framework:
    type: esp-idf

logger:

output:
  - platform: gpio
    pin: GPIO2
    id: blink_out

interval:
  - interval: 1s
    then:
      - output.turn_on: blink_out
      - delay: 500ms
      - output.turn_off: blink_out
"""

TEST_BLINK_INO = """// EvenUCan compiler self-test: plain Blink sketch
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
"""

# ESP32-S3 DevKitC-1: the onboard LED is an RGB (WS2812-style) LED on GPIO 48 (board v1.0) or GPIO 38 (v1.1),
# not a plain LED, so digitalWrite(LED_BUILTIN) lights nothing. rgbLedWrite is in the Arduino-ESP32 3.x core.
TEST_BLINK_S3_INO = """// EvenUCan compiler self-test: Blink for the ESP32-S3 RGB LED
#ifndef RGB_BUILTIN
#define RGB_BUILTIN 48
#endif

void setup() {
}

void loop() {
  rgbLedWrite(RGB_BUILTIN, 255, 0, 0);
  delay(500);
  rgbLedWrite(RGB_BUILTIN, 0, 0, 0);
  delay(500);
}
"""

# ESP32-S3 DevKitC-1 ESPHome test: the onboard LED is an addressable RGB LED on GPIO 48 (v1.0) / GPIO 38 (v1.1)
TEST_BLINK_S3_YAML = """esphome:
  name: evenucan-compiler-test

esp32:
  board: {board}
  framework:
    type: esp-idf

logger:

light:
  - platform: esp32_rmt_led_strip
    id: status_led
    name: "Status light"
    pin: GPIO48
    num_leds: 1
    rgb_order: GRB
    chipset: ws2812

interval:
  - interval: 3s
    then:
      - light.turn_on:
          id: status_led
          red: 100%
          green: 0%
          blue: 0%
      - delay: 1500ms
      - light.turn_off: status_led
"""

def start_test_compile_job(platform, board=None, sketch=None, name=None, port=None, upload=False, libs=None, clean=False):
    """Compile a tiny known-good Blink project to prove the whole toolchain works end to end.

    platform: 'esphome' (ESP32 + ESPHome YAML), 'esp32ide' (ESP32 .ino) or 'arduino' (Arduino Nano .ino).
    With sketch=<.ino text> (esp32ide/arduino only) it compiles THAT sketch instead of Blink, installs `libs`
    (PlatformIO library names) and, if upload=True, uploads to `port`. Without sketch nothing is uploaded; the job only succeeds if the compiler exits 0 AND a fresh firmware file exists.
    """
    import uuid, shutil
    platform = (platform or "esphome").strip()
    board = (board or "").strip()
    if platform not in ("esphome", "esp32ide", "arduino"):
        raise ValueError("Compiler test supports ESPHome, ESP32 (Arduino) and Arduino Nano boards only.")
    if platform == "arduino":
        board = "nanoatmega328"
    elif not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', board):
        board = "esp32-s3-devkitc-1"

    # With a board attached, make sure the Blink image matches the chip that is really plugged in
    if upload and port and port.strip() and platform != "arduino":
        try:
            release_serial_port()
            probe = subprocess.run([sys.executable, "-m", "esptool", "--port", port.strip(), "--baud", "115200", "flash-id"],
                                   capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20)
            out = probe.stdout + probe.stderr
            if "ESP32-S3" in out:
                if "s3" not in board.lower():
                    board = "esp32-s3-devkitc-1"
            elif "ESP32-D0WD" in out or re.search(r"ESP32(?![-\w])", out):
                board = "esp32dev"
        except Exception:
            pass

    if sketch is not None and platform == "esphome":
        raise ValueError("Sketch compile is for Arduino (.ino) projects only.")
    job_id = str(uuid.uuid4())[:8]
    if sketch is not None:
        clean_name = "ino_" + (re.sub(r'[^a-zA-Z0-9_-]', '_', (name or "sketch").strip()) or "sketch")
    else:
        clean_name = "_compiler_test_" + re.sub(r'[^a-zA-Z0-9_]', '_', platform + "_" + board)
    build_dir = os.path.join(DATA_DIR, "builds", clean_name)
    os.makedirs(build_dir, exist_ok=True)
    if clean:
        shutil.rmtree(os.path.join(build_dir, ".pio"), ignore_errors=True)

    with flash_job_lock:
        busy = [j for j in flash_jobs.values() if j.get("name") == clean_name and j.get("status") == "running"]
    if busy:
        return busy[0]["id"]  # same test already running: just watch it

    if platform == "esphome":
        with open(os.path.join(build_dir, f"{clean_name}.yaml"), "w", encoding="utf-8") as f:
            is_s3 = "s3" in board.lower() and "xiao" not in board.lower()
            f.write((TEST_BLINK_S3_YAML if is_s3 else TEST_BLINK_YAML).format(board=board))
        with open(os.path.join(build_dir, "secrets.yaml"), "w", encoding="utf-8") as f:
            f.write('wifi_ssid: "x"\nwifi_password: "x"\n')
        if upload:
            cmd = [sys.executable, "-m", "esphome", "run", f"{clean_name}.yaml"]
            if port and port.strip():
                release_serial_port()
                cmd += ["--device", port.strip(), "--upload_speed", "115200"]
            cmd.append("--no-logs")
        else:
            cmd = [sys.executable, "-m", "esphome", "compile", f"{clean_name}.yaml"]
        label = f"ESPHome blink YAML for {board}"
    else:
        src_dir = os.path.join(build_dir, "src")
        os.makedirs(src_dir, exist_ok=True)
        with open(os.path.join(src_dir, "main.ino"), "w", encoding="utf-8") as f:
            if sketch is not None:
                blink_src = sketch
            elif "s3" in board.lower() and "xiao" not in board.lower():  # XIAO S3 has a plain LED on another pin
                blink_src = TEST_BLINK_S3_INO
            else:
                blink_src = TEST_BLINK_INO
            f.write(blink_src)
        pio_platform = "atmelavr" if platform == "arduino" else "espressif32"
        ini = f"[env:test]\nplatform = {pio_platform}\nboard = {board}\nframework = arduino\n"
        if sketch is not None:
            ini += "monitor_speed = 115200\n"
            good_libs = [l.strip() for l in (libs or []) if isinstance(l, str) and re.fullmatch(r"[A-Za-z0-9_ ./@^~<>=,-]{1,80}", l.strip())]
            # Libraries the Arduino IDE ships built in, but PlatformIO needs listed
            ide_bundled = {"Servo.h": "ESP32Servo" if platform != "arduino" else "Servo",
                           "Stepper.h": "Stepper", "LiquidCrystal.h": "LiquidCrystal"}
            for inc in re.findall(r'^\s*#\s*include\s*[<"]([^>"]+)[>"]', sketch, flags=re.M):
                lib = ide_bundled.get(inc.strip())
                if lib and lib not in good_libs:
                    good_libs.append(lib)
            if good_libs:
                ini += "lib_deps =\n" + "".join(f"    {l}\n" for l in good_libs)
        with open(os.path.join(build_dir, "platformio.ini"), "w", encoding="utf-8") as f:
            f.write(ini)
        cmd = [sys.executable, "-m", "platformio", "run", "-d", build_dir]
        label = (f"your sketch ({clean_name[4:]}) for {board}" if sketch is not None else f"Arduino blink sketch (.ino) for {board}")
        if upload:
            if port and port.strip():
                release_serial_port()
                cmd += ["-t", "upload", "--upload-port", port.strip()]
            else:
                cmd += ["-t", "upload"]  # PlatformIO auto-detects the board's port

    # Remove firmware from earlier runs so a pass can only come from THIS compile
    for r, _d, fs in os.walk(build_dir):
        for fn in fs:
            if fn.startswith("firmware.") and fn.endswith((".bin", ".hex", ".elf")):
                try: os.remove(os.path.join(r, fn))
                except OSError: pass

    start_time = time.time()
    job_state = {
        "id": job_id, "name": clean_name, "action": ("sketch" if sketch is not None else "test"), "port": port,
        "status": "running",
        "logs": [(f"Compiling {label}" if sketch is not None else f"Compiler self-test: {label}") + ". First run downloads the toolchain and can take several minutes."],
        "log_base": 0, "exit_code": None, "proc": None, "start_time": start_time
    }
    with flash_job_lock:
        flash_jobs[job_id] = job_state

    def add_log(line):
        with flash_job_lock:
            if len(job_state["logs"]) > 500:
                dropped = len(job_state["logs"]) - 300
                job_state["logs"] = job_state["logs"][-300:]
                job_state["log_base"] += dropped
            job_state["logs"].append(line)

    def finish(ok, code, msg):
        with flash_job_lock:
            job_state["exit_code"] = code
            job_state["logs"].append(msg)
            if job_state["status"] != "cancelled":
                job_state["status"] = "success" if ok else "error"

    def worker():
        try:
            env = clean_build_env()
            env["PYTHONUNBUFFERED"] = "1"
            proc = subprocess.Popen(cmd, cwd=build_dir, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, encoding='utf-8', errors='replace', bufsize=1, env=env)
            job_state["proc"] = proc
            ansi = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            for raw in iter(proc.stdout.readline, ''):
                for part in ansi.sub('', raw).split('\r'):
                    if part.strip():
                        add_log(part.strip())
            proc.stdout.close()
            proc.wait()
            if proc.returncode != 0:
                finish(False, proc.returncode, f"FAILED: compiler exited with code {proc.returncode}.")
                return
            # os.walk (not glob): glob's ** skips hidden folders such as .pio and .esphome
            fresh = [os.path.join(r, fn) for r, _d, fs in os.walk(build_dir) for fn in fs if fn.startswith("firmware.") and fn.endswith((".bin", ".hex", ".elf"))]
            if not fresh:
                finish(False, 0, "FAILED: the compiler said OK but no new firmware file was produced.")
                return
            fresh.sort(key=lambda p: p.endswith('.elf'))  # name the flashable file first
            size = os.path.getsize(fresh[0])
            finish(True, 0, f"SUCCESS: compiled to the end{' and uploaded to your board' if upload else ''}. Firmware file: {os.path.basename(fresh[0])} ({size:,} bytes).")
        except Exception as ex:
            finish(False, -1, f"Execution error: {ex}")

    threading.Thread(target=worker, daemon=True).start()
    return job_id

# -------------------------------------------------------------
# Firmware library: compiled images kept so they can be flashed to more boards later (e.g. one per room)
# -------------------------------------------------------------
FIRMWARE_DIR = os.environ.get("EVENUCAN_FIRMWARE_DIR") or os.path.join(DATA_DIR, "firmware")
FW_ID_RE = re.compile(r'^[A-Za-z0-9_.-]{1,120}$')

def _fw_analyse(path):
    """Look inside a .bin: which chip it is for and whether it is a FULL image (safe on any board) or update-only.
    Returns {ok, chip, kind: 'full'|'update-only', message}."""
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            head = f.read(1)
            f.seek(0x8000)
            ptable = f.read(2)
        if head != b"\xe9" and size > 0x8000 and ptable != b"\xaa\x50":
            return {"ok": False, "message": "This does not look like ESP32 firmware."}
        # A full image is written at flash offset 0, so on some chips (classic ESP32, S2, C5, P4) it begins with empty 0xFF padding
        # and the bootloader starts further in. esptool can only read an image that starts at the bootloader, so skip the padding.
        probe_path, tmp_slice = path, None
        with open(path, "rb") as f:
            lead = f.read(0x3000)
        first = next((i for i, b in enumerate(lead) if b != 0xFF), 0)
        if first > 0 and first < len(lead) and lead[first] == 0xE9:
            tmp_slice = path + ".slice.tmp"
            with open(path, "rb") as f:
                f.seek(first)
                data_tail = f.read()
            with open(tmp_slice, "wb") as f:
                f.write(data_tail)
            probe_path = tmp_slice
        try:
            p = subprocess.run([sys.executable, "-m", "esptool", "image-info", probe_path], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
        finally:
            if tmp_slice:
                try: os.remove(tmp_slice)
                except OSError: pass
        out = (p.stdout or "") + (p.stderr or "")
        m = re.search(r"Detected image type:\s*(ESP32[\w-]*)", out) or re.search(r"Chip ID:\s*\d+\s*\((ESP32[\w-]*)\)", out)
        if not m:
            return {"ok": False, "message": "This does not look like ESP32 firmware."}
        sub = re.match(r"ESP32-(S2|S3|C2|C3|C5|C6|H2|P4)", m.group(1))
        chip = "ESP32-" + sub.group(1) if sub else "ESP32"
        full = size > 0x9000 and ptable == b"\xaa\x50"
        fm = re.search(r"Flash size:\s*(\d+)\s*MB", out)
        flash_mb = int(fm.group(1)) if fm else None
        if not full:
            return {"ok": True, "chip": chip, "kind": "update-only", "flash_mb": flash_mb,
                    "message": "This is an update-only file. A new or blank board cannot start from it. Use the full-image file (it ends in .factory.bin)."}
        return {"ok": True, "chip": chip, "kind": "full", "flash_mb": flash_mb, "message": ""}
    except Exception as ex:
        return {"ok": False, "message": f"Could not read this file: {ex}"}

def _fw_save(src, name, platform, source, extra=None):
    """Copy a compiled full image into the library with a label file. Returns the label or None."""
    import hashlib, shutil as _sh
    a = _fw_analyse(src)
    if not a.get("ok") or a.get("kind") != "full":
        return None
    os.makedirs(FIRMWARE_DIR, exist_ok=True)
    # Friendly name: <Device>_<Chip>_<Flash>MB_<Date>  (the chip is also read from inside the file; the name is for people)
    base = re.sub(r'[^A-Za-z0-9-]+', '-', name or "firmware").strip('-')[:40] or "firmware"
    fid0 = f"{base}_{a['chip']}_{str(a['flash_mb']) + 'MB_' if a.get('flash_mb') else ''}{time.strftime('%Y-%m-%d')}"
    fid, n = fid0, 1
    while os.path.exists(os.path.join(FIRMWARE_DIR, fid + ".bin")):
        n += 1
        fid = f"{fid0}_{n}"
    dst = os.path.join(FIRMWARE_DIR, fid + ".bin")
    _sh.copyfile(src, dst)
    with open(dst, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    meta = {"id": fid, "name": name, "title": name, "platform": platform, "chip": a["chip"], "flash_mb": a.get("flash_mb"), "kind": "full", "size": os.path.getsize(dst),
            "sha256": digest, "created": time.strftime("%Y-%m-%d %H:%M:%S"), "source": source}
    if extra:
        meta.update(extra)
    with open(os.path.join(FIRMWARE_DIR, fid + ".json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    return meta

def fw_store_esphome_build(build_dir, name):
    """After a successful ESPHome compile: keep its full image (the .factory.bin) in the library."""
    best = None
    for r, _d, fs in os.walk(build_dir):
        for fn in fs:
            if fn == "firmware.factory.bin":
                p = os.path.join(r, fn)
                if best is None or os.path.getmtime(p) > os.path.getmtime(best):
                    best = p
    if not best:
        return None
    unique = False   # does this build give every board its own name? (name_add_mac_suffix)
    try:
        with open(os.path.join(build_dir, f"{name}.yaml"), "r", encoding="utf-8") as f:
            unique = bool(re.search(r"^\s*name_add_mac_suffix:\s*true", f.read(), re.M))
    except OSError:
        pass
    return _fw_save(best, name, "esphome", "compile", {"unique_names": unique})

FW_TRASH_DAYS = 14

def _fw_paths(fid):
    if not FW_ID_RE.match(str(fid or "")):
        raise ValueError("Unknown firmware.")
    return os.path.join(FIRMWARE_DIR, fid + ".bin"), os.path.join(FIRMWARE_DIR, fid + ".json")

def fw_delete(fid):
    """Move to a hidden trash folder (not erased) so a mistaken delete can be undone."""
    b, j = _fw_paths(fid)
    if not os.path.exists(b):
        raise ValueError("That firmware is already gone.")
    trash = os.path.join(FIRMWARE_DIR, ".trash")
    os.makedirs(trash, exist_ok=True)
    os.replace(b, os.path.join(trash, fid + ".bin"))
    if os.path.exists(j):
        os.replace(j, os.path.join(trash, fid + ".json"))
    return {"ok": True}

def fw_open_folder():
    """Show the saved-firmware folder in the computer's file manager (the server runs on the user's own computer)."""
    os.makedirs(FIRMWARE_DIR, exist_ok=True)
    if sys.platform.startswith("win"):
        os.startfile(FIRMWARE_DIR)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", FIRMWARE_DIR])
    else:
        subprocess.Popen(["xdg-open", FIRMWARE_DIR])
    return {"status": "ok", "ok": True, "dir": FIRMWARE_DIR}

def fw_restore(fid):
    b, j = _fw_paths(fid)
    trash = os.path.join(FIRMWARE_DIR, ".trash")
    tb, tj = os.path.join(trash, fid + ".bin"), os.path.join(trash, fid + ".json")
    if not os.path.exists(tb):
        raise ValueError("That firmware can no longer be restored.")
    if os.path.exists(b):
        raise ValueError("A firmware with that name already exists.")
    os.replace(tb, b)
    if os.path.exists(tj):
        os.replace(tj, j)
    return {"ok": True}

def fw_rename(fid, title):
    """Changes only the display name; the file name (and chip check) are untouched."""
    _b, j = _fw_paths(fid)
    title = re.sub(r'[\x00-\x1f<>]', '', str(title or '')).strip()[:60]
    if not title:
        raise ValueError("Type a name first.")
    with open(j, "r", encoding="utf-8") as f:
        m = json.load(f)
    m["title"] = title
    with open(j, "w", encoding="utf-8") as f:
        json.dump(m, f, indent=1)
    return {"ok": True, "title": title}

def fw_purge_trash():
    trash = os.path.join(FIRMWARE_DIR, ".trash")
    if not os.path.isdir(trash):
        return
    cutoff = time.time() - FW_TRASH_DAYS * 86400
    for fn in os.listdir(trash):
        p = os.path.join(trash, fn)
        try:
            if os.path.getmtime(p) < cutoff:
                os.remove(p)
        except OSError:
            pass

def fw_list():
    fw_purge_trash()
    items = []
    if os.path.isdir(FIRMWARE_DIR):
        for fn in os.listdir(FIRMWARE_DIR):
            if fn.endswith(".json"):
                try:
                    with open(os.path.join(FIRMWARE_DIR, fn), "r", encoding="utf-8") as f:
                        m = json.load(f)
                    if os.path.exists(os.path.join(FIRMWARE_DIR, m["id"] + ".bin")):
                        items.append(m)
                except Exception:
                    pass
    items.sort(key=lambda m: m.get("created", ""), reverse=True)
    return items

def fw_import(filename, data):
    """A file picked by the user (uploaded by the browser). Validated, then added to the library."""
    if len(data) < 4096 or len(data) > 32 * 1024 * 1024:
        return {"ok": False, "message": "That file is the wrong size for ESP32 firmware."}
    if not str(filename).lower().endswith(".bin"):
        return {"ok": False, "message": "Pick a .bin firmware file (for example one ending in .factory.bin)."}
    os.makedirs(FIRMWARE_DIR, exist_ok=True)
    tmp = os.path.join(FIRMWARE_DIR, "_import.tmp.bin")
    with open(tmp, "wb") as f:
        f.write(data)
    try:
        a = _fw_analyse(tmp)
        if not a.get("ok") or a.get("kind") != "full":
            return {"ok": False, "message": a.get("message") or "This is not a full firmware image."}
        name = re.sub(r'(\.factory)?\.bin$', '', os.path.basename(str(filename)), flags=re.I)
        meta = _fw_save(tmp, name, "imported", "picked file")
        return {"ok": True, "firmware": meta} if meta else {"ok": False, "message": "Could not add this file."}
    finally:
        try: os.remove(tmp)
        except OSError: pass

def start_firmware_flash(fw_id, port):
    """Flash a stored full image to the board on `port` after checking it is the right chip and fits."""
    import uuid
    if not FW_ID_RE.match(str(fw_id or "")):
        raise ValueError("Unknown firmware.")
    bin_path = os.path.join(FIRMWARE_DIR, fw_id + ".bin"); meta_path = os.path.join(FIRMWARE_DIR, fw_id + ".json")
    if not (os.path.exists(bin_path) and os.path.exists(meta_path)):
        raise ValueError("That firmware is no longer in the library.")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    port = (port or "").strip()
    if not port:
        raise ValueError("Plug in a board and pick its port first.")
    board = identify_board(port)
    if not board.get("ok"):
        raise ValueError(board.get("message") or "The board could not be checked.")
    if board["family"] != meta["chip"]:
        raise ValueError(f"This firmware is for an {meta['chip']} but the board plugged in is an {board['family']}. Flashing it would not work, so nothing was sent.")
    if board.get("flash_mb") and meta["size"] > board["flash_mb"] * 1024 * 1024:
        raise ValueError("This firmware is bigger than the memory on this board.")
    job_id = str(uuid.uuid4())[:8]
    cmd = [sys.executable, "-m", "esptool", "--port", port, "--baud", "115200", "write-flash", "0x0", bin_path]
    job_state = {"id": job_id, "name": "fw_" + fw_id, "action": "run", "port": port, "status": "running",
                 "logs": [f"Flashing '{meta['name']}' ({meta['chip']}, {meta['size']:,} bytes) to {port}..."],
                 "log_base": 0, "exit_code": None, "proc": None, "start_time": time.time()}
    with flash_job_lock:
        flash_jobs[job_id] = job_state

    def worker():
        try:
            release_serial_port()
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', bufsize=1)
            job_state["proc"] = proc
            ansi = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            for raw in iter(proc.stdout.readline, ''):
                for part in ansi.sub('', raw).split('\r'):
                    if part.strip():
                        with flash_job_lock:
                            if len(job_state["logs"]) > 500:
                                dropped = len(job_state["logs"]) - 300
                                job_state["logs"] = job_state["logs"][-300:]
                                job_state["log_base"] += dropped
                            job_state["logs"].append(part.strip())
            proc.stdout.close(); proc.wait()
            ok = proc.returncode == 0
            with flash_job_lock:
                job_state["exit_code"] = proc.returncode
                job_state["logs"].append("SUCCESS: firmware written to the board." if ok else f"FAILED: flashing stopped (code {proc.returncode}). Hold the BOOT button while plugging the board in and try again.")
                if job_state["status"] != "cancelled":
                    job_state["status"] = "success" if ok else "error"
        except Exception as ex:
            with flash_job_lock:
                job_state["logs"].append(f"Execution error: {ex}"); job_state["status"] = "error"; job_state["exit_code"] = -1
    threading.Thread(target=worker, daemon=True).start()
    return job_id

identify_lock = threading.Lock()

# USB ID -> (board name, architecture). Only boards whose ID we are sure of; a bridge chip alone (CH340, CP210x, FTDI)
# says nothing about the board, so those are not listed. arch: 'avr328' = ATmega328P (Nano/Uno R3: the same code runs on both).
USB_BOARDS = {
    (0x2341, 0x0069): ("Arduino UNO R4 Minima", "renesas"),
    (0x2341, 0x1002): ("Arduino UNO R4 WiFi", "renesas"),
    (0x2341, 0x0043): ("Arduino UNO R3", "avr328"), (0x2341, 0x0001): ("Arduino UNO R3", "avr328"), (0x2341, 0x0243): ("Arduino UNO R3", "avr328"),
    (0x2341, 0x0042): ("Arduino Mega 2560", "avr-other"), (0x2341, 0x0010): ("Arduino Mega 2560", "avr-other"), (0x2341, 0x0242): ("Arduino Mega 2560", "avr-other"),
    (0x2341, 0x8036): ("Arduino Leonardo", "avr-other"), (0x2341, 0x8037): ("Arduino Micro", "avr-other"),
    (0x2341, 0x0058): ("Arduino Nano Every", "avr-other"),
}
USB_VENDORS = {0x2341: "Arduino board", 0x303A: "Espressif board (native USB)", 0x2E8A: "Raspberry Pi Pico board", 0x2A03: "Arduino board"}
# CH340 is a USB bridge chip, not a board: it is on many Arduino Nano clones and ESP boards. Named so a card says what it is.
USB_BRIDGES = {0x1A86: "CH340 USB-serial board (often an Arduino Nano clone or an ESP board)"}

def usb_board_hint(port):
    """What the USB ID alone tells us about the device on `port`: {board, arch} or {}."""
    try:
        import serial.tools.list_ports as _lp
        for p in _lp.comports():
            if p.device.upper() == port.upper() and p.vid:
                known = USB_BOARDS.get((p.vid, p.pid))
                if known:
                    return {"usb_board": known[0], "arch": known[1], "usb_id": f"{p.vid:04x}:{p.pid:04x}"}
                if p.vid in USB_VENDORS:
                    return {"usb_board": USB_VENDORS[p.vid], "arch": "", "usb_id": f"{p.vid:04x}:{p.pid:04x}"}
                if p.vid in USB_BRIDGES:
                    return {"usb_board": USB_BRIDGES[p.vid], "arch": "", "usb_id": f"{p.vid:04x}:{p.pid:04x}"}
                return {"usb_id": f"{p.vid:04x}:{p.pid:04x}"}
    except Exception:
        pass
    return {}

def identify_board(port):
    """identify_board_core plus what the USB ID reveals. For a board that is not an ESP32 the message names it when we can."""
    hint = usb_board_hint((port or "").strip())
    if hint.get("arch") in ("avr328", "avr-other", "renesas"):
        # The USB ID already says this is an Arduino-family board: no need to poke it with ESP tools (instant answer)
        n = hint["usb_board"]
        return {"ok": False, "reason": "unsupported", "message": f"This is an {n}, not an ESP32 board.", **hint}
    res = _identify_board_core(port)
    res.update(hint)
    if not res.get("ok") and res.get("reason") in ("unsupported", "no_response") and hint.get("usb_board"):
        if hint.get("arch") in ("avr328", "avr-other", "renesas") or "Arduino" in hint["usb_board"] or "Pico" in hint["usb_board"]:
            res["reason"] = "unsupported"
            res["message"] = f"This is an {hint['usb_board']}, not an ESP32 board." if hint["usb_board"][0] in "AEIOU" else f"This is a {hint['usb_board']}, not an ESP32 board."
    return res

def _identify_board_core(port):
    """Ask an attached ESP32-family board what it really is (read-only; the board reboots afterwards).

    Returns {ok, family, chip, revision, flash_mb, psram_mb, wifi, bluetooth, mac} on success, else
    {ok: False, reason: 'busy'|'no_response'|'unsupported'|'error', message: plain English}.
    Never runs while a compile/upload job is using the machine's serial port.
    """
    port = (port or "").strip()
    if not re.fullmatch(r'(COM\d{1,3}|/dev/[A-Za-z0-9_./-]{1,60}|tty[A-Za-z0-9_.-]{1,40})', port):
        return {"ok": False, "reason": "error", "message": "That is not a valid port name."}
    with flash_job_lock:
        busy = any(j.get("status") == "running" and (j.get("port") or j.get("action") in ("run", "sketch", "test")) for j in flash_jobs.values())
    if busy:
        return {"ok": False, "reason": "busy", "message": "A compile or upload is running, so the board is not being checked right now."}
    if not identify_lock.acquire(blocking=False):
        return {"ok": False, "reason": "busy", "message": "Already checking the board."}
    try:
        release_serial_port()
        out = ""
        for attempt in (1, 2, 3):
            # A board that just rebooted (e.g. after an earlier check) often misses the first attempt: retry quietly
            try:
                p = subprocess.run([sys.executable, "-m", "esptool", "--port", port, "--baud", "115200", "flash-id"],
                                   capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=25)
                out = (p.stdout or "") + (p.stderr or "")
            except subprocess.TimeoutExpired:
                out = "Timed out"
            if re.search(r"Chip type:|Chip is ", out) or not re.search(r"Wrong boot mode|Failed to connect|No serial data|Timed out", out, re.I):
                break
            time.sleep(2)
        m = re.search(r"Chip type:\s+(ESP(?:8266|32)[\w-]*)\s*(?:\(([^)]*)\))?", out) or re.search(r"Chip is (ESP(?:8266|32)[\w-]*)\s*(?:\(([^)]*)\))?", out)
        if not m:
            if re.search(r"FileNotFoundError|could not find|The system cannot find", out, re.I) and not re.search(r"PermissionError|Access is denied", out, re.I):
                return {"ok": False, "reason": "no_port", "message": "That port is no longer there. The board may have been unplugged."}
            if re.search(r"could not open port|PermissionError|Access is denied|busy", out, re.I):
                return {"ok": False, "reason": "busy", "message": "Another program is using this port. Close the Arduino IDE (its Serial Monitor too) or any other flashing tool, then plug the board in again."}
            if re.search(r"Wrong boot mode|Failed to connect|No serial data|Timed out", out, re.I):
                return {"ok": False, "reason": "no_response", "message": "Could not talk to the board. Use a data USB cable (some only charge), and hold the BOOT button while plugging it in."}
            return {"ok": False, "reason": "unsupported", "message": "This does not look like an ESP32 family board (it may be an Arduino or another device)."}
        chip = m.group(1)
        sub = re.match(r"ESP32-(S2|S3|C2|C3|C5|C6|H2|P4)\b", chip)
        if chip.startswith("ESP8266"):
            family = "ESP8266"
        else:
            family = "ESP32-" + sub.group(1) if sub else "ESP32"   # D0WD/D0WDQ6/PICO etc. are all the classic ESP32
        rev = re.search(r"revision\s+(v?[\d.]+)", out)   # e.g. "(revision v0.2)", which may be a second bracket after the package name
        feat = (re.search(r"Features:\s*(.*)", out) or [None, ""])[1]
        flash = re.search(r"Detected flash size:\s*(\d+)\s*MB", out)
        psram = re.search(r"PSRAM\s*(\d+)\s*MB", feat) or re.search(r"Embedded PSRAM\s*(\d+)", feat)
        mac = re.search(r"MAC:\s*([0-9a-fA-F:]{17})", out)
        return {
            "ok": True, "family": family, "chip": chip, "revision": rev.group(1) if rev else "",
            "flash_mb": int(flash.group(1)) if flash else None,
            "psram_mb": int(psram.group(1)) if psram else (0 if feat else None),
            "wifi": "Wi-Fi" in feat, "bluetooth": ("BT" in feat) or ("BLE" in feat),
            "mac": mac.group(1).lower() if mac else "",
        }
    except Exception as ex:
        return {"ok": False, "reason": "error", "message": f"Could not check the board: {ex}"}
    finally:
        identify_lock.release()

def get_lan_ip():
    """Detect the local LAN IPv4 address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to non-routable address to discover outward routing interface
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = '127.0.0.1'
    finally:
        s.close()
    return ip

SNAP_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
<title>EvenUCan Photo Snap</title>
<style>
  :root {
    --bg: #121417;
    --card: #1c2026;
    --line: #2e3540;
    --text: #e6edf3;
    --muted: #8b949e;
    --primary: #2563eb;
    --primary-hover: #1d4ed8;
    --success: #16a34a;
    --success-bg: rgba(22, 163, 74, 0.15);
    --border-radius: 14px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    text-align: center;
  }
  .container {
    width: 100%;
    max-width: 440px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--border-radius);
    padding: 28px 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  .app-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  h1 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }
  p.desc {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 24px;
  }
  .instructions {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 13px;
    color: var(--muted);
    text-align: left;
    margin-bottom: 24px;
    line-height: 1.5;
  }
  .instructions b { color: var(--text); }
  .instructions ul { padding-left: 18px; margin-top: 6px; }
  .instructions li { margin-bottom: 4px; }

  .snap-btn-wrap {
    position: relative;
    margin: 16px 0;
  }
  .snap-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    background: var(--primary);
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    padding: 18px 24px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    transition: all 0.2s ease;
  }
  .snap-btn:active {
    transform: scale(0.98);
    background: var(--primary-hover);
  }
  .snap-btn.uploading {
    opacity: 0.7;
    pointer-events: none;
  }
  input[type=file] {
    display: none;
  }
  .status-card {
    display: none;
    margin-top: 20px;
    padding: 14px 16px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    align-items: center;
    justify-content: center;
    gap: 8px;
    animation: fadeIn 0.3s ease;
  }
  .status-card.success {
    display: flex;
    background: var(--success-bg);
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.3);
  }
  .status-card.error {
    display: flex;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .preview-wrap {
    display: none;
    margin-top: 18px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--line);
    max-height: 220px;
  }
  .preview-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .counter-badge {
    margin-top: 14px;
    font-size: 12px;
    color: var(--muted);
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
</head>
<body>
<div class="container">
  <div class="app-icon">📏</div>
  <h1>EvenUCan Camera Snap</h1>
  <p class="desc">Take a photo of your part with a steel ruler. It will transfer instantly to EvenUCan on your PC.</p>
  
  <div class="instructions">
    <b>💡 Tips for accuracy:</b>
    <ul>
      <li>Hold camera 40–50 cm away and <b>zoom in 2×</b>.</li>
      <li>Lay a <b>steel ruler</b> directly beside the part.</li>
      <li>First photo: <b>straight down</b>. Second: <b>side view</b>.</li>
    </ul>
  </div>

  <div class="snap-btn-wrap">
    <label for="cameraInput" class="snap-btn" id="snapBtn">
      <span>📷</span>
      <span id="btnText">Take Photo of Part</span>
    </label>
    <input type="file" id="cameraInput" accept="image/*" capture="environment">
  </div>

  <div id="statusBox" class="status-card"></div>
  <div id="previewBox" class="preview-wrap">
    <img id="previewImg" alt="Captured preview">
  </div>
  <div id="counterBadge" class="counter-badge"></div>
</div>

<script>
  const cameraInput = document.getElementById('cameraInput');
  const snapBtn = document.getElementById('snapBtn');
  const btnText = document.getElementById('btnText');
  const statusBox = document.getElementById('statusBox');
  const previewBox = document.getElementById('previewBox');
  const previewImg = document.getElementById('previewImg');
  const counterBadge = document.getElementById('counterBadge');
  let sentCount = 0;

  function showStatus(msg, isSuccess) {
    statusBox.className = 'status-card ' + (isSuccess ? 'success' : 'error');
    statusBox.innerHTML = (isSuccess ? '✓ ' : '⚠ ') + msg;
  }

  cameraInput.addEventListener('change', async function() {
    const file = cameraInput.files && cameraInput.files[0];
    if (!file) return;

    // Show preview
    try {
      previewImg.src = URL.createObjectURL(file);
      previewBox.style.display = 'block';
    } catch(e) {}

    // Disable button during upload
    snapBtn.classList.add('uploading');
    btnText.textContent = 'Sending to PC…';
    statusBox.className = 'status-card';
    statusBox.style.display = 'none';

    try {
      const formData = new FormData();
      formData.append('photo', file, file.name || 'photo.jpg');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Server returned HTTP ' + response.status);
      }

      const result = await response.json();
      sentCount++;
      showStatus('Sent to EvenUCan! (Photo #' + result.id + ')', true);
      btnText.textContent = 'Take Another Photo';
      counterBadge.textContent = 'Total photos sent this session: ' + sentCount;
    } catch (err) {
      console.error(err);
      showStatus('Upload failed: ' + err.message, false);
      btnText.textContent = 'Try Again';
    } finally {
      snapBtn.classList.remove('uploading');
      cameraInput.value = '';
    }
  });
</script>
</body>
</html>
"""

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
try:
    os.chdir(ROOT_DIR)
except Exception:
    pass

class EvenUCanServerHandler(SimpleHTTPRequestHandler):
    """
    HTTP handler serving directory files and EvenUCan bridge APIs.
    Always serves from ROOT_DIR regardless of invocation directory.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def do_GET(self):
        # 1. API: LAN IP
        if self.path == '/api/ip' or self.path.startswith('/api/ip?'):
            ip = get_lan_ip()
            payload = json.dumps({"ip": ip, "port": PORT}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 2. Endpoint: Mobile Snap Page
        if self.path == '/snap' or self.path.startswith('/snap?') or self.path == '/snap/':
            payload = SNAP_HTML.encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 3. API: Latest Photo
        if self.path == '/api/latest-photo' or self.path.startswith('/api/latest-photo?'):
            payload = json.dumps({
                "id": photo_store["current_id"],
                "filename": photo_store["filename"],
                "mime": photo_store["mime"],
                "data_url": photo_store["data_url"],
                "timestamp": photo_store["timestamp"]
            }).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

                # 4. API: List Serial COM Ports
        if self.path == '/api/flash/ports' or self.path.startswith('/api/flash/ports?'):
            ports = get_serial_ports()
            # ?quick=1 is for the background board watcher: just the port list, no slow driver scan
            missing = None if 'quick=1' in self.path else check_missing_drivers()
            payload = json.dumps({"ports": ports, "has_esphome": True, "missing_driver": missing}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 4d. API: download a stored firmware (the "Save a copy" button)
        if self.path.startswith('/api/firmware/download'):
            try:
                fid = (urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("id") or [""])[0]
                b, _j = _fw_paths(fid)
                with open(b, "rb") as f:
                    blob = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", f'attachment; filename="{fid}.bin"')
                self.send_header("Content-Length", str(len(blob)))
                self.end_headers()
                self.wfile.write(blob)
            except Exception:
                self.send_error(404, "Firmware not found")
            return

        # 4c. API: firmware library list
        if self.path.startswith('/api/firmware/list'):
            payload = json.dumps({"items": fw_list(), "dir": FIRMWARE_DIR}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 4a. API: identify the board on a port (read-only chip/flash/PSRAM/MAC check)
        if self.path.startswith('/api/flash/identify'):
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            res = identify_board((qs.get("port") or [""])[0])
            payload = json.dumps(res).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 4a. API: projects saved on this computer
        if self.path.startswith('/api/projects'):
            try:
                q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                if self.path.startswith('/api/projects/load'):
                    ai_send_json(self, proj_load(q.get("name", [""])[0]))
                else:
                    ai_send_json(self, proj_overview())
            except Exception as e:
                ai_send_json(self, {"ok": False, "message": str(e)}, 400)
            return
        # 4b. API: built-in local AI (engine status, installed and catalog models, download progress)
        if self.path.startswith('/api/ai/engine/status'):
            ai_send_json(self, ai_engine_status())
            return
        if self.path.startswith('/api/ai/models/pull/status'):
            name = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("name", [""])[0]
            ai_send_json(self, ai_pull_status(name))
            return
        if self.path == '/api/ai/models' or self.path.startswith('/api/ai/models?'):
            try:
                ai_send_json(self, ai_models_overview())
            except Exception as e:
                ai_send_json(self, {"status": "error", "models": [], "message": str(e)})
            return

        # 4c. API: Proxy External Image (bypasses browser CORS)
        if self.path.startswith('/api/proxy-image'):
            try:
                parsed = urllib.parse.urlparse(self.path)
                qs = urllib.parse.parse_qs(parsed.query)
                target_url = qs.get("url", [None])[0]
                if not target_url:
                    self.send_error(400, "Missing url parameter")
                    return
                req = urllib.request.Request(
                    target_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
                    }
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    img_bytes = resp.read()
                    content_type = resp.headers.get('Content-Type', 'image/jpeg')
                    if ';' in content_type:
                        content_type = content_type.split(';')[0].strip()
                    try:
                        im = Image.open(io.BytesIO(img_bytes))
                        im.thumbnail((400, 300), Image.Resampling.LANCZOS)
                        out_buf = io.BytesIO()
                        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
                            im.save(out_buf, format='PNG', optimize=True)
                            content_type = 'image/png'
                        else:
                            im = im.convert('RGB')
                            im.save(out_buf, format='JPEG', quality=82, optimize=True)
                            content_type = 'image/jpeg'
                        img_bytes = out_buf.getvalue()
                    except Exception:
                        pass
                    b64_str = base64.b64encode(img_bytes).decode('ascii')
                    data_url = f"data:{content_type};base64,{b64_str}"
                    print(f"[proxy-image] Fetched {target_url[:65]!r} -> {len(img_bytes)} bytes", flush=True)
                    payload = json.dumps({"status": "ok", "data_url": data_url, "mime": content_type}).encode('utf-8')
            except Exception as e:
                print(f"[proxy-image] Error fetching {target_url[:65]!r}: {e}", flush=True)
                payload = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 4d. API: Find Component Photo Online
        if self.path.startswith('/api/find-photo'):
            try:
                parsed = urllib.parse.urlparse(self.path)
                qs = urllib.parse.parse_qs(parsed.query)
                q = qs.get("q", [None])[0]
                candidates = find_component_photos_online(q, max_results=10) if q else []
                img_url = candidates[0] if candidates else None
                print(f"[find-photo] Query: {q!r} -> Found {len(candidates)} candidate photos", flush=True)
                payload = json.dumps({"status": "ok" if img_url else "not_found", "image": img_url, "candidates": candidates}).encode('utf-8')
            except Exception as e:
                print(f"[find-photo] Query: {q!r} -> ERROR: {e}", flush=True)
                payload = json.dumps({"status": "error", "image": None, "candidates": [], "message": str(e)}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 5. API: Flash Job Status
        if self.path.startswith('/api/flash/status'):
            try:
                parsed = urllib.parse.urlparse(self.path)
                qs = urllib.parse.parse_qs(parsed.query)
                job_id = qs.get("id", [None])[0]
                try:
                    since = int(qs.get("since", ["0"])[0])
                except ValueError:
                    since = 0
                with flash_job_lock:
                    job = flash_jobs.get(job_id)
                    if job:
                        base = job.get("log_base", 0)
                        all_logs = job["logs"]
                        start = max(0, since - base)
                        payload = json.dumps({
                            "id": job["id"],
                            "name": job["name"],
                            "status": job["status"],
                            "action": job["action"],
                            "exit_code": job["exit_code"],
                            "logs": list(all_logs[start:]),
                            "total": base + len(all_logs)
                        }, ensure_ascii=False).encode('utf-8')
                    else:
                        payload = json.dumps({"status": "not_found"}).encode('utf-8')
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            except Exception as e:
                err_resp = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(err_resp)))
                self.end_headers()
                self.wfile.write(err_resp)
                return

        # Fallback to standard static file server
        super().do_GET()

    def do_POST(self):
        # 2w. API: warm up the local AI in the background (load the selected model, then one short "hello"),
        # so the first real question does not wait for the model to load into memory.
        if self.path.startswith('/api/ai/warm'):
            def _warm():
                try:
                    name = ai_selected_model()
                    if not name:
                        return
                    ok, _ = ai_engine_ensure(name)
                    if ok:
                        body = {"messages": [{"role": "user", "content": "hello"}], "max_tokens": 1, "stream": False}
                        req = urllib.request.Request(AI_ENGINE_URL + "/v1/chat/completions",
                                                     data=json.dumps(body).encode("utf-8"),
                                                     headers={"Content-Type": "application/json"})
                        urllib.request.urlopen(req, timeout=300).read()
                except Exception:
                    pass   # warming is a convenience; a failure changes nothing for the user
            threading.Thread(target=_warm, daemon=True).start()
            ai_send_json(self, {"ok": True, "started": True})
            return
        # 2p. API: projects saved on this computer (save, delete, choose the folder)
        if self.path.startswith('/api/projects'):
            try:
                n = int(self.headers.get('Content-Length', 0) or 0)
                data = json.loads(self.rfile.read(n).decode('utf-8') or '{}') if n else {}
                if self.path.startswith('/api/projects/save'):
                    ai_send_json(self, proj_save(data))
                elif self.path.startswith('/api/projects/delete'):
                    ai_send_json(self, proj_delete(str(data.get('name') or '')))
                elif self.path.startswith('/api/projects/dir'):
                    ai_send_json(self, proj_set_dir(data.get('dir')))
                else:
                    ai_send_json(self, {"ok": False, "message": "Unknown request."}, 404)
            except Exception as e:
                ai_send_json(self, {"ok": False, "message": str(e)}, 400)
            return
        # 3a. API: built-in local AI: start a model download, pick the model to use, or delete one
        if self.path.startswith('/api/ai/models/'):
            try:
                n = int(self.headers.get('Content-Length', 0) or 0)
                data = json.loads(self.rfile.read(n).decode('utf-8') or '{}') if n else {}
                name = str(data.get('name') or '').strip()
                if self.path.startswith('/api/ai/models/pull'):
                    ai_send_json(self, ai_pull_start(name))
                elif self.path.startswith('/api/ai/models/select'):
                    ai_select_model(name)
                    ai_send_json(self, ai_models_overview())
                elif self.path.startswith('/api/ai/models/delete'):
                    ai_delete_model(name)
                    ai_send_json(self, ai_models_overview())
                else:
                    ai_send_json(self, {"status": "error", "message": "Unknown request."}, 404)
            except Exception as e:
                ai_send_json(self, {"status": "error", "message": str(e)}, 400)
            return

        # 4. API: Upload Photo
        if self.path == '/api/upload' or self.path.startswith('/api/upload?'):
            try:
                content_type = self.headers.get('Content-Type', '')
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length <= 0:
                    self.send_error(400, "Missing or invalid Content-Length")
                    return

                body = self.rfile.read(content_length)

                # Parse multipart using email.parser
                headers_block = (
                    f"Content-Type: {content_type}\r\n"
                    f"Content-Length: {content_length}\r\n\r\n"
                ).encode('utf-8')

                parser = BytesFeedParser(policy=default)
                parser.feed(headers_block + body)
                msg = parser.close()

                uploaded_bytes = None
                uploaded_filename = "photo.jpg"
                uploaded_mime = "image/jpeg"

                if msg.is_multipart():
                    for part in msg.iter_parts():
                        fn = part.get_filename()
                        if fn or part.get_param('name', header='content-disposition') == 'photo':
                            uploaded_bytes = part.get_payload(decode=True)
                            if fn:
                                uploaded_filename = fn
                            part_type = part.get_content_type()
                            if part_type:
                                uploaded_mime = part_type
                            break
                else:
                    # Raw body fallback
                    uploaded_bytes = body
                    if content_type and '/' in content_type:
                        uploaded_mime = content_type.split(';')[0].strip()

                if not uploaded_bytes:
                    self.send_error(400, "No image found in upload")
                    return

                # Update in-memory store
                photo_store["current_id"] += 1
                photo_store["filename"] = uploaded_filename
                photo_store["mime"] = uploaded_mime
                b64_str = base64.b64encode(uploaded_bytes).decode('ascii')
                photo_store["data_url"] = f"data:{uploaded_mime};base64,{b64_str}"
                import time
                photo_store["timestamp"] = int(time.time() * 1000)

                resp = json.dumps({
                    "status": "ok",
                    "id": photo_store["current_id"],
                    "filename": uploaded_filename,
                    "size": len(uploaded_bytes)
                }).encode('utf-8')

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return

            except Exception as e:
                err_msg = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(err_msg)))
                self.end_headers()
                self.wfile.write(err_msg)
                return

        # 5. API: Start Flash/Compile Job
        if self.path == '/api/flash/start' or self.path.startswith('/api/flash/start?'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))
                yaml_text = data.get("yaml", "")
                name = data.get("name", "my_device")
                port = data.get("port", None)
                action = data.get("action", "run")
                if not yaml_text.strip():
                    self.send_error(400, "Missing YAML content")
                    return
                job_id = start_flash_job(name, yaml_text, port=port, action=action, clean=bool(data.get("clean")))
                resp = json.dumps({"status": "started", "id": job_id}).encode('utf-8')
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return
            except Exception as e:
                err_msg = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(err_msg)))
                self.end_headers()
                self.wfile.write(err_msg)
                return

        # 5e. API: secrets (AI keys, Wi-Fi). Only this computer may use it (see secrets_store.py).
        if self.path == '/api/secrets':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body_data = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
                is_local = self.client_address[0] in ('127.0.0.1', '::1')
                res = secrets_store.handle(DATA_DIR, body_data, is_local)
                code = 200
            except PermissionError as e:
                res = {"ok": False, "message": str(e)}
                code = 403
            except Exception as e:
                res = {"ok": False, "message": str(e)}
                code = 400
            payload = json.dumps(res).encode('utf-8')
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 5d. API: firmware library (import a picked file / flash a stored image)
        if self.path in ('/api/firmware/import', '/api/firmware/flash', '/api/firmware/delete', '/api/firmware/restore', '/api/firmware/rename', '/api/firmware/open-folder'):
            try:
                length = int(self.headers.get('Content-Length', 0))
                if length > 33 * 1024 * 1024:
                    raise ValueError("That file is too big to be ESP32 firmware.")
                body = self.rfile.read(length)
                if self.path == '/api/firmware/import':
                    fname = urllib.parse.unquote(self.headers.get('X-Filename', 'firmware.bin'))
                    res = fw_import(fname, body)
                else:
                    data = json.loads(body.decode('utf-8') or '{}')
                    if self.path == '/api/firmware/open-folder':
                        res = fw_open_folder()
                    elif self.path == '/api/firmware/delete':
                        res = fw_delete(data.get("id"))
                    elif self.path == '/api/firmware/restore':
                        res = fw_restore(data.get("id"))
                    elif self.path == '/api/firmware/rename':
                        res = fw_rename(data.get("id"), data.get("title"))
                    else:
                        res = {"status": "started", "id": start_firmware_flash(data.get("id"), data.get("port"))}
                code = 200
            except Exception as e:
                res = {"status": "error", "ok": False, "message": str(e)}
                code = 200   # the message is meant for the user: deliver it normally
            payload = json.dumps(res).encode('utf-8')
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 5c. API: compile / upload the user's own Arduino sketch (.ino)
        if self.path == '/api/flash/sketch' or self.path.startswith('/api/flash/sketch?'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(content_length).decode('utf-8') or '{}')
                sk = data.get("sketch", "")
                if not isinstance(sk, str) or not sk.strip():
                    raise ValueError("Missing sketch code")
                job_id = start_test_compile_job(data.get("platform"), data.get("board"), sketch=sk, name=data.get("name"),
                                                port=data.get("port"), upload=(data.get("action") == "run"),
                                                libs=data.get("libs"), clean=bool(data.get("clean")))
                resp = json.dumps({"status": "started", "id": job_id}).encode('utf-8')
                code = 200
            except Exception as e:
                resp = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
                code = 500
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        # 5b. API: Compiler self-test (blink)
        if self.path == '/api/flash/test' or self.path.startswith('/api/flash/test?'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(content_length).decode('utf-8') or '{}')
                job_id = start_test_compile_job(data.get("platform"), data.get("board"),
                                                port=data.get("port"), upload=(data.get("action") == "run"))
                resp = json.dumps({"status": "started", "id": job_id}).encode('utf-8')
                code = 200
            except Exception as e:
                resp = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
                code = 500
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        # 6. API: Cancel Flash Job
        if self.path == '/api/flash/cancel' or self.path.startswith('/api/flash/cancel?'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))
                job_id = data.get("id")
                with flash_job_lock:
                    job = flash_jobs.get(job_id)
                    if job and job.get("proc"):
                        try:
                            job["proc"].terminate()
                            job["status"] = "cancelled"
                            job["logs"].append("CANCELLED by user.")
                        except Exception:
                            pass
                resp = json.dumps({"status": "cancelled"}).encode('utf-8')
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return
            except Exception as e:
                err_msg = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(err_msg)))
                self.end_headers()
                self.wfile.write(err_msg)
                return

        # 6b. API: Install USB Driver (CP210x)
        if self.path == '/api/flash/install-driver' or self.path.startswith('/api/flash/install-driver?'):
            installer = os.path.join(ROOT_DIR, "drivers", "CP210x", "pololu-cp2102-setup-x64.exe")
            if os.path.exists(installer):
                try:
                    os.startfile(installer)
                    resp = json.dumps({"status": "launched"}).encode('utf-8')
                except Exception as e:
                    resp = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
            else:
                resp = json.dumps({"status": "not_found"}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        # 6b. API: the app writes its pin reference (ai-reference\pin-codes.md) from its own tables. Only that file.
        if self.path == '/api/ai/reference':
            n = int(self.headers.get('Content-Length', 0) or 0)
            body = self.rfile.read(min(n, 65536)) if n > 0 else b""
            try:
                text = body.decode("utf-8")
                if not text.startswith("# EvenUCan pin reference") or len(text) > 65536:
                    raise ValueError("not the pin reference")
                folder = os.path.join(ROOT_DIR, "ai-reference")
                os.makedirs(folder, exist_ok=True)
                dest = os.path.join(folder, "pin-codes.md")
                tmp = dest + ".tmp"
                with open(tmp, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)
                os.replace(tmp, dest)
                code, resp = 200, {"status": "ok"}
            except Exception as e:
                code, resp = 400, {"error": {"message": f"Reference not saved ({e})."}}
            payload = json.dumps(resp).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 7. API: local AI chat through EvenUCan's own engine (llama-server). Only the built-in engine answers.
        if self.path == '/api/ai/chat' or self.path.startswith('/api/ai/chat?'):
            n = int(self.headers.get('Content-Length', 0) or 0)
            body = self.rfile.read(n)
            try:
                code, resp_data = ai_chat_builtin(body)
            except Exception as e:
                print(f"Local AI could not answer: {e}")
                code, resp_data = 503, json.dumps({"error": {"message": f"Local AI could not answer ({e})."}}).encode('utf-8')
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(resp_data)))
            self.end_headers()
            self.wfile.write(resp_data)
            return

        self.send_error(404, "Endpoint not found")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def end_headers(self):
        # Enable CORS for local cross-origin if needed
        self.send_header('Access-Control-Allow-Origin', '*')
        if hasattr(self, 'path') and (self.path.endswith('.html') or self.path == '/' or self.path.endswith('.js') or self.path.endswith('.css')):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def handle_error(self, request, client_address):
        # Ignore broken pipe / connection reset errors from abrupt client disconnects
        import sys
        ex = sys.exc_info()[1]
        if isinstance(ex, (ConnectionResetError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)

# -------------------------------------------------------------
# Built-in local AI: EvenUCan runs its own llama.cpp server (llama-server) and manages its
# models itself, so the user never installs Local AI. Models are GGUF files in the models folder;
# the catalog of downloadable models is ai-models.json beside this file.
# -------------------------------------------------------------
import hashlib
AI_ENGINE_PORT = 11500          # not 11434, so another local AI program can run beside it
AI_ENGINE_URL = f"http://127.0.0.1:{AI_ENGINE_PORT}"
import ai_mini                     # starts/stops the engine process and waits for it (ai_mini.py beside this file)
import secrets_store               # API keys and Wi-Fi in secrets.json (data folder, never in git)
ai_mini.DATA_DIR = DATA_DIR        # the engine log goes in the data folder, never the install folder
ai_start_lock = threading.Lock()   # one start/stop of the engine at a time
ai_pull_jobs = {}                  # model name -> progress dict
ai_pull_lock = threading.Lock()

def ai_models_dir():
    d = os.environ.get("EVENUCAN_MODELS_DIR") or os.path.join(DATA_DIR, "models")
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        pass
    return d

def ai_engine_path():
    """The bundled llama-server. Looked up: EVENUCAN_ENGINE_EXE, then engine\\ beside the web app, then the data folder."""
    exe_name = "llama-server.exe" if os.name == "nt" else "llama-server"
    cands = [os.environ.get("EVENUCAN_ENGINE_EXE") or "",
             os.path.join(ROOT_DIR, "engine", exe_name),
             os.path.join(os.path.dirname(ROOT_DIR), "engine", exe_name),
             os.path.join(DATA_DIR, "engine", exe_name)]
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return ""

def ai_catalog():
    """Models EvenUCan offers to download (ai-models.json). Each: name, title, file, url, size_mb, sha256, vision, note."""
    try:
        with open(os.path.join(ROOT_DIR, "ai-models.json"), encoding="utf-8") as f:
            items = json.load(f).get("models", [])
        return [m for m in items if isinstance(m, dict) and m.get("name") and m.get("file") and m.get("url")]
    except Exception:
        return []

def ai_model_store_dir():
    """Where the model store keeps its models (models already there are reused, nothing is copied)."""
    return os.environ.get("EVENUCAN_MODEL_DIR") or os.path.join(os.path.expanduser("~"), ".ollama", "models")

def ai_model_store_models():
    """Models in the model store: {'name:tag': path of the GGUF blob}. Read straight from Local AI's
    manifests and blobs; nothing is copied, so the same bytes are used by both."""
    base = ai_model_store_dir()
    found = {}
    # The store keeps registry models in manifests\ and models you created yourself (e.g. evenucan-expert) in manifests-v2\
    roots = [os.path.join(base, "manifests", "registry.ollama.ai", "library"),
             os.path.join(base, "manifests-v2", "ollama.com", "library")]
    for root in roots:
        try:
            for model in os.listdir(root):
                for tag in os.listdir(os.path.join(root, model)):
                    try:
                        with open(os.path.join(root, model, tag), encoding="utf-8") as f:
                            manifest = json.load(f)
                        layer = next((l for l in manifest.get("layers", []) if l.get("mediaType") == "application/vnd.ollama.image.model"), None)
                        if not layer:
                            continue
                        blob = os.path.join(base, "blobs", layer["digest"].replace(":", "-"))
                        if os.path.isfile(blob):
                            found.setdefault(f"{model}:{tag}", blob)
                    except Exception:
                        continue
        except OSError:
            pass
    return found

def ai_installed_models():
    """Models EvenUCan can use: its own downloads, plus models already in the model store (used in place)."""
    d = ai_models_dir()
    catalog = ai_catalog()
    out = []
    try:
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(".gguf") or fn.endswith(".part"):
                continue
            entry = next((m for m in catalog if m["file"] == fn), None)
            out.append({"name": entry["name"] if entry else fn[:-5], "file": fn, "source": "evenucan",
                        "size_mb": round(os.path.getsize(os.path.join(d, fn)) / 1048576)})
    except OSError:
        pass
    have = {m["name"] for m in out}
    for name, blob in ai_model_store_models().items():
        if name not in have:
            out.append({"name": name, "file": blob, "source": "store",
                        "size_mb": round(os.path.getsize(blob) / 1048576)})
    return out

def ai_find_model_file(name):
    entry = next((m for m in ai_catalog() if m["name"] == name), None)
    if entry:
        p = os.path.join(ai_models_dir(), os.path.basename(entry["file"]))
        if os.path.isfile(p):
            return p
    blob = ai_model_store_models().get(name)
    if blob:
        return blob
    return None

def ai_settings_path():
    return os.path.join(DATA_DIR, "ai_settings.json")

def ai_selected_model():
    """The model the user picked. Falls back to the first installed model if none was picked."""
    try:
        with open(ai_settings_path(), encoding="utf-8") as f:
            sel = json.load(f).get("model") or ""
    except Exception:
        sel = ""
    if sel and ai_find_model_file(sel):
        return sel
    installed = {m["name"] for m in ai_installed_models()}
    if "evenucan-expert:latest" in installed:  # EvenUCan's own specialist model, the recommended default
        return "evenucan-expert:latest"
    for m in ai_catalog():                     # then the catalog default when it is available
        if m["name"] in installed:
            return m["name"]
    return next(iter(sorted(installed)), "")

def ai_select_model(name):
    if not ai_find_model_file(name):
        raise ValueError("That model is not installed.")
    try:
        with open(ai_settings_path(), "w", encoding="utf-8") as f:
            json.dump({"model": name}, f)
    except OSError as e:
        raise ValueError(f"Could not save the choice: {e}")

def ai_pull_start(name):
    entry = next((m for m in ai_catalog() if m["name"] == name), None)
    if not entry:
        raise ValueError("That model is not in the EvenUCan catalog.")
    with ai_pull_lock:
        cur = ai_pull_jobs.get(name)
        if cur and cur.get("status") == "running":
            return cur
        job = {"name": name, "status": "running", "done": 0, "total": 0, "error": ""}
        ai_pull_jobs[name] = job
    threading.Thread(target=_ai_pull_run, args=(entry, job), daemon=True).start()
    return job

def _ai_pull_run(entry, job):
    """Download to <file>.part (resumes if interrupted), check SHA-256 when the catalog gives one, then rename."""
    dest = os.path.join(ai_models_dir(), os.path.basename(entry["file"]))
    part = dest + ".part"
    try:
        start = os.path.getsize(part) if os.path.exists(part) else 0
        req = urllib.request.Request(entry["url"], headers={"User-Agent": "EvenUCan"})
        if start:
            req.add_header("Range", f"bytes={start}-")
        with urllib.request.urlopen(req, timeout=60) as resp:
            if start and resp.status != 206:
                start = 0            # server ignored the Range request: start again
            job["total"] = (int(resp.headers.get("Content-Length", 0) or 0) + start) or int(entry.get("size_mb", 0)) * 1048576
            job["done"] = start
            h = hashlib.sha256()
            if start:
                with open(part, "rb") as f:
                    for chunk in iter(lambda: f.read(1 << 20), b""):
                        h.update(chunk)
            with open(part, "ab" if start else "wb") as f:
                while True:
                    chunk = resp.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
                    h.update(chunk)
                    job["done"] += len(chunk)
        want = (entry.get("sha256") or "").lower()
        if want and h.hexdigest() != want:
            os.remove(part)
            raise RuntimeError("The download did not match its checksum, so it was thrown away. Try again.")
        os.replace(part, dest)
        job["status"] = "done"
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)

def ai_pull_status(name):
    with ai_pull_lock:
        return dict(ai_pull_jobs.get(name) or {"name": name, "status": "none", "done": 0, "total": 0, "error": ""})

def ai_delete_model(name):
    path = ai_find_model_file(name)
    if not path:
        raise ValueError("That model is not installed.")
    with ai_start_lock:
        if ai_mini.running_model() == name:
            ai_mini.stop()
    os.remove(path)

def ai_engine_healthy():
    return ai_mini.healthy()

def ai_engine_stop():
    with ai_start_lock:
        ai_mini.stop()

def ai_engine_ensure(name):
    """Start the engine with this model (or keep it running). Returns (ok, reason).
    ai_mini.py does the process work; this only finds the engine and the model file (also in the model store)."""
    exe = ai_engine_path()
    if not exe:
        return False, "engine-missing"
    model_file = ai_find_model_file(name)
    if not model_file:
        return False, "model-missing"
    with ai_start_lock:
        return ai_mini.load(name, exe=exe, model_file=model_file)

def ai_engine_status():
    running_name = ai_mini.running_model()
    return {"status": "ok", "engine_found": bool(ai_engine_path()), "running": running_name is not None,
            "loaded_model": running_name, "port": AI_ENGINE_PORT,
            "selected": ai_selected_model(), "models_dir": ai_models_dir()}

def ai_models_overview():
    installed = ai_installed_models()
    have = {m["name"] for m in installed}
    catalog = [{"name": m["name"], "title": m.get("title", m["name"]), "size_mb": m.get("size_mb", 0),
                "vision": bool(m.get("vision")), "note": m.get("note", ""),
                "installed": m["name"] in have, "file": m["file"]} for m in ai_catalog()]
    return {"status": "ok", "models": [m["name"] for m in installed], "installed": installed,
            "catalog": catalog, "selected": ai_selected_model()}

def ai_send_json(handler, obj, code=200):
    payload = json.dumps(obj).encode('utf-8')
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)

AI_PARAM_KEYS = ("temperature", "top_p", "top_k", "repeat_penalty", "seed")
AI_REFERENCE_HEADER = ("# Reference files\nThese are the authoritative facts for this app. Check them before answering "
                       "from your own memory. When a reference answers the question, use its exact values. "
                       "Each section is labelled [file > heading]. If you used any, end your answer with a line "
                       "'Source: <file name>' naming those files.\n\n")
AI_REFERENCE_BUDGET_CHARS = 2400   # how much reference text one question may bring in (keeps answers quick on this PC)
AI_REFERENCE_TOP_SECTIONS = 4
AI_STOPWORDS = {"the", "and", "for", "with", "what", "which", "how", "can", "you", "use", "this", "that", "are",
                "is", "on", "an", "a", "to", "of", "in", "my", "i", "it", "do", "does", "should", "from", "about",
                "give", "me", "please", "some", "any", "tell", "need", "want", "make", "way"}

def ai_reference_sections():
    """Every section of every .md/.txt in ai-reference\\, as (file, heading, text). Read at each question,
    so an edit or a new document applies without a restart."""
    import re
    folder = os.path.join(ROOT_DIR, "ai-reference")
    out = []
    try:
        names = sorted(os.listdir(folder))
    except OSError:
        return out
    for fn in names:
        if not fn.lower().endswith((".md", ".txt")):
            continue
        try:
            with open(os.path.join(folder, fn), encoding="utf-8") as f:
                lines = f.read().splitlines()
        except OSError:
            continue
        head, cur = fn, []
        for line in lines:
            if re.match(r"^#{1,2} ", line):
                if "\n".join(cur).strip():
                    out.append((fn, head, "\n".join(cur).strip()))
                head, cur = line.lstrip("#").strip(), []
            else:
                cur.append(line)
        if "\n".join(cur).strip():
            out.append((fn, head, "\n".join(cur).strip()))
    return out

def ai_question_words(text):
    import re
    words = re.findall(r"[a-z0-9]+", str(text).lower())
    return {w for w in words if w not in AI_STOPWORDS and (len(w) >= 3 or w.isdigit())}

def ai_pick_reference(question):
    """The sections that best match the question's words, within the budget: [(file, heading, labelled text)]."""
    qw = ai_question_words(question)
    if not qw:
        return []
    scored = []
    for fn, head, body in ai_reference_sections():
        score = 2 * len(qw & ai_question_words(head)) + len(qw & ai_question_words(body))
        if score > 0:
            scored.append((score, fn, head, body))
    scored.sort(key=lambda t: -t[0])
    picked, used = [], 0
    for score, fn, head, body in scored[:AI_REFERENCE_TOP_SECTIONS]:
        chunk = f"[{fn} > {head}]\n{body}"
        if used + len(chunk) > AI_REFERENCE_BUDGET_CHARS:
            continue
        picked.append((fn, head, chunk))
        used += len(chunk)
    return picked

def ai_manifest_path(name):
    """The manifest file for 'model:tag' in the model store, or None."""
    base = ai_model_store_dir()
    model, _, tag = name.partition(":")
    tag = tag or "latest"
    for root in (os.path.join(base, "manifests-v2", "ollama.com", "library"),
                 os.path.join(base, "manifests", "registry.ollama.ai", "library")):
        p = os.path.join(root, model, tag)
        if os.path.isfile(p):
            return p
    return None

def ai_model_profile(name):
    """What the model was built with, read from its manifest: the system prompt and default parameters.
    Local AI stores these as layers; EvenUCan applies them itself, so the answers match the model's design."""
    profile = {"system": "", "params": {}}
    path = ai_manifest_path(name)
    if not path:
        return profile
    try:
        with open(path, encoding="utf-8") as f:
            manifest = json.load(f)
        base = ai_model_store_dir()
        for layer in manifest.get("layers", []):
            kind = layer.get("mediaType", "")
            blob = os.path.join(base, "blobs", layer.get("digest", "").replace(":", "-"))
            if not os.path.isfile(blob):
                continue
            if kind == "application/vnd.ollama.image.system":
                with open(blob, encoding="utf-8") as f:
                    profile["system"] = f.read().strip()
            elif kind == "application/vnd.ollama.image.params":
                with open(blob, encoding="utf-8") as f:
                    raw = json.load(f)
                profile["params"] = {k: raw[k] for k in AI_PARAM_KEYS if k in raw}
    except Exception:
        pass
    return profile

def ai_chat_builtin(body):
    """Send one chat request to the built-in engine. Raises RuntimeError with a short reason if it cannot.
    The selected model's own system prompt and default parameters are applied here; the app's own
    system message is kept and follows the model's prompt."""
    name = ai_selected_model()
    if not name:
        raise RuntimeError("no model is installed; choose one in Local AI settings")
    ok, reason = ai_engine_ensure(name)
    if not ok:
        raise RuntimeError(reason)
    try:
        req_obj = json.loads(body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise RuntimeError("the request was not valid JSON")
    profile = ai_model_profile(name)
    msgs = list(req_obj.get("messages") or [])
    # The model's own prompt, then the reference files (ai-reference\*.md) it must check before its own memory.
    system_text = profile["system"]
    question = next((str(m.get("content") or "") for m in reversed(msgs) if m.get("role") == "user"), "")
    picked = ai_pick_reference(question)
    if picked:
        ref = "\n\n".join(chunk for _, _, chunk in picked)
        system_text = (system_text + "\n\n" if system_text else "") + AI_REFERENCE_HEADER + ref
    if system_text:
        idx = next((i for i, m in enumerate(msgs) if m.get("role") == "system"), None)
        if idx is None:
            msgs.insert(0, {"role": "system", "content": system_text})
        else:
            app_text = str(msgs[idx].get("content") or "")
            msgs[idx] = {"role": "system", "content": system_text + "\n\n" + app_text}
    req_obj["messages"] = msgs
    for k, v in profile["params"].items():
        req_obj.setdefault(k, v)
    req_obj["stream"] = False
    req = urllib.request.Request(AI_ENGINE_URL + "/v1/chat/completions",
                                 data=json.dumps(req_obj).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        raw = resp.read()
        status = resp.status
    try:
        answer = json.loads(raw.decode("utf-8"))
        answer["reference_used"] = [{"file": fn, "section": head} for fn, head, _ in picked]
        raw = json.dumps(answer).encode("utf-8")
    except (ValueError, UnicodeDecodeError, TypeError):
        pass
    return status, raw

# -------------------------------------------------------------
# Projects on the computer: one file per project in the projects folder (the folder the user chose on first run,
# else Documents\EvenUCan\Projects). The desktop app passes EVENUCAN_PROJECTS_DIR.
# -------------------------------------------------------------
PROJ_EXT = ".evenucan.json"

def proj_dir():
    d = ""
    try:
        with open(os.path.join(DATA_DIR, "projects-dir.txt"), encoding="utf-8") as f:
            d = f.read().strip()
    except OSError:
        pass
    d = d or os.environ.get("EVENUCAN_PROJECTS_DIR") or os.path.join(os.path.expanduser("~"), "Documents", "EvenUCan", "Projects")
    os.makedirs(d, exist_ok=True)
    return d

def proj_chosen():
    return os.path.isfile(os.path.join(DATA_DIR, "projects-dir.txt"))

def proj_file(name):
    import re
    safe = re.sub(r'[\/:*?"<>|\x00-]', "_", str(name or "")).strip(" .")[:80] or "project"
    return os.path.join(proj_dir(), safe + PROJ_EXT)

def proj_list():
    d = proj_dir()
    out = []
    for f in sorted(os.listdir(d)):
        if not f.endswith(PROJ_EXT):
            continue
        try:
            with open(os.path.join(d, f), encoding="utf-8") as fh:
                p = json.load(fh)
        except (OSError, ValueError):
            continue
        out.append({"name": p.get("name") or f[:-len(PROJ_EXT)], "saved": p.get("saved", 0)})
    return out

def proj_save(data):
    name = str(data.get("name") or "").strip()
    if not name:
        raise ValueError("The project needs a name.")
    path = proj_file(name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh)
    os.replace(tmp, path)          # the old copy is only replaced once the new one is fully written
    return {"ok": True, "file": path}

def proj_load(name):
    with open(proj_file(name), encoding="utf-8") as fh:
        return json.load(fh)

def proj_delete(name):
    try:
        os.remove(proj_file(name))
    except FileNotFoundError:
        pass
    return {"ok": True}

def proj_set_dir(d):
    d = os.path.abspath(str(d or "").strip())
    if not d or not os.path.isabs(d):
        raise ValueError("Choose a folder.")
    os.makedirs(d, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(os.path.join(DATA_DIR, "projects-dir.txt"), "w", encoding="utf-8") as fh:
        fh.write(d)
    return {"ok": True, "dir": d}

def proj_overview():
    return {"dir": proj_dir(), "chosen": proj_chosen(), "projects": proj_list()}

def main():
    try:
        os.chdir(ROOT_DIR)
    except Exception:
        pass
    lan_ip = get_lan_ip()
    print("=" * 60)
    print(" EvenUCan Local Server & Photo Bridge")
    print(f" Serving directory : {ROOT_DIR}")
    print(f" PC Local Web URL  : http://localhost:{PORT}/EvenUCan.html")
    print(f" Mobile Snap URL   : http://{lan_ip}:{PORT}/snap")
    print("=" * 60)

    while True:
        server = None
        try:
            server = ThreadingHTTPServer((HOST, PORT), EvenUCanServerHandler)
            server.daemon_threads = True
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            if server:
                server.server_close()
            sys.exit(0)
        except Exception as e:
            if server:
                try:
                    server.server_close()
                except Exception:
                    pass
            time.sleep(1.0)

if __name__ == '__main__':
    try:
        main()
    except BaseException as e:
        import traceback
        with open(os.path.join(DATA_DIR, "server_crash.log"), "w", encoding="utf-8") as f:
            f.write(f"Server exited with BaseException: {type(e).__name__}: {str(e)}\n")
            traceback.print_exc(file=f)
        raise
