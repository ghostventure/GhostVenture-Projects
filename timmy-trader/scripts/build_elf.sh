#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source .venv/bin/activate
python3 -m pip install -e ".[dev]"

pyinstaller \
  --clean \
  --noconfirm \
  --name Timmy \
  --collect-data webull \
  trend_trader/desktop.py

file dist/Timmy/Timmy
