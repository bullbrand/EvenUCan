# Built-in local AI engine

EvenUCan's Local AI runs on `llama-server.exe` from llama.cpp (MIT licence). The installer ships it
from this folder, so users do not need to install Ollama.

To build the installer with the engine:

1. Download the Windows x64 CPU build of llama.cpp (`llama-bXXXX-bin-win-cpu-x64.zip`) from its GitHub releases page.
2. Copy `llama-server.exe` and the `.dll` files that come with it into this folder.
3. Copy the llama.cpp `LICENSE` into `THIRD-PARTY-NOTICES.txt`.
4. Run `npm run dist`.

Models are not stored here. EvenUCan downloads the ones listed in `ai-models.json` into the user's
Documents\EvenUCan\models folder the first time they choose them.

For development, `EVENUCAN_ENGINE_EXE` can point at any `llama-server` executable.
