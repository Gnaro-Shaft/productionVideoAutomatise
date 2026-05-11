#!/usr/bin/env bash
# Convenience runner for music-svc (MusicGen via Transformers).
# First run downloads the model (~5.4GB for medium) — be patient.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[music] creating venv..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Always sync deps with requirements.txt.
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

# Note: NOT using --reload because warm-up loads a 5GB model — reload would restart it.
exec uvicorn music.main:app --host 0.0.0.0 --port 7003
