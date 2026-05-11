#!/usr/bin/env bash
# Convenience runner for planner-svc.
# Creates a venv on first run, syncs deps every run.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[planner] creating venv..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Always make sure deps match requirements.txt — fast no-op if already installed.
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

exec uvicorn planner.main:app --reload --host 0.0.0.0 --port 7001
