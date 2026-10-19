#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${APP_DIR}"
export TIMMY_HOME="${TIMMY_HOME:-${APP_DIR}}"
theme_line="$(grep -m1 '^TIMMY_THEME=' "$TIMMY_HOME/.env" 2>/dev/null || true)"
if [ -n "$theme_line" ]; then
  export TIMMY_THEME="${theme_line#TIMMY_THEME=}"
elif [ -z "${TIMMY_THEME:-}" ]; then
  export TIMMY_THEME=dark
fi

if [ -x .venv/bin/timmy-desktop ]; then
  exec .venv/bin/timmy-desktop
fi

if [ -x ./dist/Timmy/Timmy ]; then
  exec ./dist/Timmy/Timmy
fi

printf 'Timmy is not built. Run scripts/build_elf.sh from %s first.\n' "${APP_DIR}" >&2
exit 1
