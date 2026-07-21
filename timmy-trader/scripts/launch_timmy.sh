#!/usr/bin/env bash
set -euo pipefail

cd /home/sniper-lion-main/trading-bots/trend-trader
export TIMMY_HOME=/home/sniper-lion-main/trading-bots/trend-trader
theme_line="$(grep -m1 '^TIMMY_THEME=' "$TIMMY_HOME/.env" 2>/dev/null || true)"
if [ -n "$theme_line" ]; then
  export TIMMY_THEME="${theme_line#TIMMY_THEME=}"
else
  export TIMMY_THEME=dark
fi

exec ./dist/Timmy/Timmy
