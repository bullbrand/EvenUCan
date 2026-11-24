"""EvenUCan's own mini local AI server.

It does not use Ollama. It:
  1. finds GGUF model files in EvenUCan's models folder,
  2. starts the bundled llama-server.exe (engine\\) with one model,
  3. gives the app a small HTTP API:
       GET  /status            -> engine found, running, loaded model
       GET  /models            -> model files available
       POST /load   {"name"}   -> start the engine with that model
       POST /chat   {"messages": [...], "max_tokens": n}  -> {"reply": "..."}
       POST /stop              -> stop the engine

Run on its own for testing:  python ai_mini.py
Listens on 127.0.0.1 only.
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("EVENUCAN_DATA_DIR") or ROOT_DIR
ENGINE_PORT = 11500                       # same port the main server uses
ENGINE_URL = f"http://127.0.0.1:{ENGINE_PORT}"
API_PORT = int(os.environ.get("EVENUCAN_AI_PORT", "11510"))

_lock = threading.Lock()
_state = {"proc": None, "model": None}


def models_dir():
    d = os.environ.get("EVENUCAN_MODELS_DIR") or os.path.join(DATA_DIR, "models")
    os.makedirs(d, exist_ok=True)
    return d


def engine_path():
    """Bundled llama-server: EVENUCAN_ENGINE_EXE, then engine\\ beside this file."""
    exe = "llama-server.exe" if os.name == "nt" else "llama-server"
    for c in (os.environ.get("EVENUCAN_ENGINE_EXE") or "", os.path.join(ROOT_DIR, "engine", exe)):
        if c and os.path.isfile(c):
            return c
    return ""


def list_models():
    """Names of the .gguf files in the models folder (the name is the file name without .gguf)."""
    d = models_dir()
    return sorted(f[:-5] for f in os.listdir(d) if f.lower().endswith(".gguf"))


def _model_file(name):
    path = os.path.join(models_dir(), name + ".gguf")
    return path if os.path.isfile(path) else None


def _healthy():
    try:
        with urllib.request.urlopen(ENGINE_URL + "/health", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _kill():
    p = _state["proc"]
    _state["proc"], _state["model"] = None, None
    if p and p.poll() is None:
        try:
            p.terminate()
            p.wait(timeout=10)
        except Exception:
            p.kill()


def stop():
    with _lock:
        _kill()


def healthy():
    return _healthy()


def running_model():
    """Name of the loaded model if the engine is up, else None."""
    p = _state["proc"]
    if p and p.poll() is None and _healthy():
        return _state["model"]
    return None


def load(name, exe=None, model_file=None):
    """Start llama-server with this model and wait until it answers. Returns (ok, reason).
    exe and model_file may be given by the caller (e.g. server.py, which also finds models in other folders)."""
    exe = exe or engine_path()
    if not exe:
        return False, "engine-missing"
    model = model_file or _model_file(name)
    if not model:
        return False, "model-missing"
    with _lock:
        p = _state["proc"]
        if p and p.poll() is None and _state["model"] == name and _healthy():
            return True, ""
        _kill()
        log_path = os.path.join(DATA_DIR, "ai_mini_engine.log")
        with open(log_path, "ab") as log:
            p = subprocess.Popen(
                [exe, "-m", model, "--host", "127.0.0.1", "--port", str(ENGINE_PORT), "-c", "8192"],
                cwd=os.path.dirname(exe), stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                creationflags=0x08000000 if os.name == "nt" else 0)
        _state["proc"], _state["model"] = p, name
        deadline = time.time() + 180      # big models can take a while to load
        while time.time() < deadline:
            if p.poll() is not None:
                break
            if _healthy():
                return True, ""
            time.sleep(0.5)
        _kill()
        return False, "engine-failed"


def chat(messages, max_tokens=512):
    """One chat turn through the running engine. Returns the reply text."""
    if not (_state["proc"] and _state["proc"].poll() is None and _healthy()):
        raise RuntimeError("engine-not-running")
    body = {"messages": messages, "max_tokens": int(max_tokens), "stream": False}
    req = urllib.request.Request(ENGINE_URL + "/v1/chat/completions",
                                 data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def status():
    p = _state["proc"]
    return {"engine_found": bool(engine_path()),
            "running": bool(p and p.poll() is None and _healthy()),
            "loaded_model": _state["model"],
            "models": list_models()}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            return None

    def do_GET(self):
        if self.path == "/status":
            return self._send(200, status())
        if self.path == "/models":
            return self._send(200, {"models": list_models()})
        self._send(404, {"error": "not-found"})

    def do_POST(self):
        body = self._body()
        if body is None:
            return self._send(400, {"error": "bad-json"})
        if self.path == "/load":
            ok, reason = load(str(body.get("name") or ""))
            return self._send(200 if ok else 500, {"ok": ok, "reason": reason})
        if self.path == "/chat":
            try:
                reply = chat(body.get("messages") or [], body.get("max_tokens") or 512)
                return self._send(200, {"reply": reply})
            except Exception as e:
                return self._send(500, {"error": str(e)})
        if self.path == "/stop":
            stop()
            return self._send(200, {"ok": True})
        self._send(404, {"error": "not-found"})

    def log_message(self, fmt, *args):
        pass   # keep the console quiet


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", API_PORT), Handler)
    print(f"EvenUCan mini AI on http://127.0.0.1:{API_PORT}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop()


if __name__ == "__main__":
    sys.exit(main())
