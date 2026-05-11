#!/usr/bin/env bash
# Convenience runner for voice-svc.
# Creates a venv on first run, syncs deps every run, then downloads
# Piper voice models lazily on first /tts call (or on warm-up).

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[voice] creating venv (Python 3.11 or 3.12)..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Always sync deps with requirements.txt — fast no-op if already installed.
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

exec uvicorn voice.main:app --reload --host 0.0.0.0 --port 7002
