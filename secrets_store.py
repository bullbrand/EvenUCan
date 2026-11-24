"""EvenUCan secrets: API keys and Wi-Fi details, kept in secrets.json in the DATA folder.

The file is never in the git repo (see .gitignore) and is never sent to another computer.
Only this computer can read or change it: the server refuses those actions from any other address.
"""
import json
import os
import threading

# Keys the app knows about. Browser names (geminiKey etc.) are kept so the existing code keeps working.
PROVIDER_KEYS = ["geminiKey", "groqKey", "openrouterKey", "claudeKey", "openaiKey", "grokKey", "deepseekKey"]
WIFI_FIELDS = ["wifi_ssid", "wifi_password"]
ALLOWED = PROVIDER_KEYS + WIFI_FIELDS

_lock = threading.Lock()


def _path(data_dir):
    return os.path.join(data_dir, "secrets.json")


def load(data_dir):
    """All saved secrets as {name: value}. A missing file is empty; a damaged file is an error (never overwritten)."""
    try:
        with open(_path(data_dir), encoding="utf-8") as f:
            raw = json.load(f)
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        raise ValueError("secrets.json is damaged. Move it out of the EvenUCan data folder and set the keys again.")
    if not isinstance(raw, dict):
        raise ValueError("secrets.json is damaged. Move it out of the EvenUCan data folder and set the keys again.")
    return {k: str(v) for k, v in raw.items() if k in ALLOWED and isinstance(v, str) and v}


def _save(data_dir, values):
    path = _path(data_dir)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(values, f, indent=2)
    os.replace(tmp, path)


def mask(value):
    """Show just enough to recognise a key: first 4 and last 3 characters."""
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return value[:4] + "…" + value[-3:]


def handle(data_dir, body, is_local):
    """Handle one request. Returns a dict for the browser. Raises ValueError with a plain message."""
    if not is_local:
        raise PermissionError("Keys and Wi-Fi can only be read or changed from the computer EvenUCan runs on.")
    action = body.get("action")
    with _lock:
        values = load(data_dir)
        if action == "list":
            return {"ok": True, "items": {k: {"set": bool(values.get(k)), "masked": mask(values.get(k, ""))} for k in ALLOWED}}
        if action == "full":
            return {"ok": True, "values": {k: v for k, v in values.items()}}
        name = body.get("name")
        if name not in ALLOWED:
            raise ValueError("Unknown key name.")
        if action == "set":
            value = (body.get("value") or "").strip()
            if not value:
                raise ValueError("Type the key first.")
            values[name] = value
            _save(data_dir, values)
            return {"ok": True, "name": name, "masked": mask(value)}
        if action == "remove":
            values.pop(name, None)
            _save(data_dir, values)
            return {"ok": True, "name": name}
    raise ValueError("Unknown action.")
