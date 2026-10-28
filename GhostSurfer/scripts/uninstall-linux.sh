#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$HOME/.local/opt/ghost-surfer}"
EXPECTED_DIR="$HOME/.local/opt/ghost-surfer"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"

if [[ "$APP_DIR" != "$EXPECTED_DIR" || ! -f "$APP_DIR/.ghost-surfer-install" ]]; then
  echo "Refusing to remove an unrecognized Ghost Surfer installation: $APP_DIR" >&2
  exit 1
fi

for proc in /proc/[0-9]*; do
  [[ -r "$proc/exe" ]] || continue
  running_exe="$(readlink "$proc/exe" 2>/dev/null || true)"
  if [[ "$running_exe" == "$APP_DIR/ghost-surfer" ]]; then
    echo "Close Ghost Surfer before uninstalling it." >&2
    exit 1
  fi
done

rm -rf "$APP_DIR"
rm -f "$DATA_HOME/applications/ghost-surfer.desktop" "$DATA_HOME/icons/hicolor/scalable/apps/ghost-surfer.svg" "$BIN_DIR/ghost-surfer-manager"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DATA_HOME/applications" >/dev/null 2>&1 || true
fi
echo "Ghost Surfer was removed. Browser profile data and settings were preserved."
