#!/bin/bash
# EvenUCan - Start Here (Linux / Mac)
# Checks for everything needed, installs what's missing, then launches EvenUCan.

cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No colour

echo ""
echo " ========================================="
echo "  EvenUCan - Start Here"
echo " ========================================="
echo ""
echo " Checking your computer has everything needed..."
echo ""

INSTALLED_SOMETHING=0
PYTHON_EXE=""

# ============================================================
#  STEP 1 — Find Python
# ============================================================
echo " [1/4] Looking for Python..."

for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    VER=$("$cmd" --version 2>&1 | grep -oP '\d+' | head -1)
    if [ "$VER" -ge 3 ] 2>/dev/null; then
      PYTHON_EXE="$cmd"
      break
    fi
  fi
done

if [ -z "$PYTHON_EXE" ]; then
  echo -e " ${YELLOW} Python not found. Attempting to install...${NC}"
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y python3
  elif command -v brew &>/dev/null; then
    brew install python3
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y python3
  else
    echo -e " ${RED} Could not install Python automatically."
    echo "  Please install Python 3 from https://www.python.org then run this script again.${NC}"
    read -p " Press Enter to close..."
    exit 1
  fi
  PYTHON_EXE="python3"
  INSTALLED_SOMETHING=1
fi

echo -e "    ${GREEN}OK${NC} - Python found ($($PYTHON_EXE --version 2>&1))."

# ============================================================
#  STEP 2 — Check Ollama (optional but recommended)
# ============================================================
echo " [2/4] Looking for Ollama (local AI - optional)..."

OLLAMA_FOUND=0
command -v ollama &>/dev/null && OLLAMA_FOUND=1

if [ $OLLAMA_FOUND -eq 0 ]; then
  echo ""
  echo " Ollama is not installed."
  echo " Without it, EvenUCan still works with free cloud AI keys (Google Gemini etc)."
  echo " You can install Ollama later from https://ollama.com"
  echo ""
  read -p " Install Ollama now? (recommended, about 1 GB download) [y/N]: " yn
  case "$yn" in
    [Yy]*)
      echo " Downloading and installing Ollama..."
      curl -fsSL https://ollama.com/install.sh | sh
      if command -v ollama &>/dev/null; then
        OLLAMA_FOUND=1
        INSTALLED_SOMETHING=1
        echo -e "    ${GREEN}OK${NC} - Ollama installed."
      else
        echo -e " ${YELLOW}   Could not install Ollama. You can install it later from https://ollama.com${NC}"
      fi
      ;;
    *)
      echo "    Skipped. You can install Ollama later from https://ollama.com"
      ;;
  esac
else
  echo -e "    ${GREEN}OK${NC} - Ollama found. Local AI will be available."
fi

# ============================================================
#  STEP 3 — Start Ollama if installed
# ============================================================
echo " [3/4] Starting services..."

if [ $OLLAMA_FOUND -eq 1 ]; then
  if pgrep -x ollama &>/dev/null; then
    echo "    Ollama is already running."
  else
    echo "    Starting Ollama..."
    ollama serve &>/dev/null &
    sleep 2
    echo "    Ollama started."
  fi
fi

# ============================================================
#  STEP 4 — Start web server and open EvenUCan
# ============================================================
echo " [4/4] Starting EvenUCan web server..."

# Kill anything already on port 8080
fuser -k 8080/tcp &>/dev/null 2>&1 || lsof -ti:8080 | xargs kill -9 &>/dev/null 2>&1 || true
sleep 1

$PYTHON_EXE -m http.server 8080 &>/dev/null &
SERVER_PID=$!
sleep 1

echo "    Server started on http://localhost:8080"
echo ""

URL="http://localhost:8080/EvenUCan.html"
if command -v xdg-open &>/dev/null; then
  xdg-open "$URL" &>/dev/null &
elif command -v open &>/dev/null; then
  open "$URL"
else
  echo " Open this in your browser: $URL"
fi

echo " ========================================="
echo ""
if [ $INSTALLED_SOMETHING -eq 1 ]; then
  echo " Setup complete! EvenUCan is now opening in your browser."
else
  echo " EvenUCan is opening in your browser."
fi
echo ""
echo " IMPORTANT: Keep this window open while using EvenUCan."
echo " Closing it will stop the server."
echo ""
echo " To stop: close this window or press Ctrl+C"
echo " ========================================="
echo ""

trap "kill $SERVER_PID 2>/dev/null; echo ''; echo ' Server stopped.'" EXIT
wait $SERVER_PID
