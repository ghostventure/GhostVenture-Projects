#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$HOME/.local/opt/ghost-surfer"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"

if [[ ! -x "$ROOT/app/ghost-surfer" ]]; then
  echo "The app bundle is incomplete. Extract the complete Ghost Surfer archive first." >&2
  exit 1
fi

if [[ -L "$APP_DIR" || ( -e "$APP_DIR" && ! -f "$APP_DIR/.ghost-surfer-install" ) ]]; then
  echo "Refusing to replace an unmanaged directory: $APP_DIR" >&2
  exit 1
fi

for proc in /proc/[0-9]*; do
  [[ -r "$proc/exe" ]] || continue
  running_exe="$(readlink "$proc/exe" 2>/dev/null || true)"
  if [[ "$running_exe" == "$APP_DIR/ghost-surfer" ]]; then
    echo "Close Ghost Surfer before installing or updating it." >&2
    exit 1
  fi
done

mkdir -p "$APP_DIR" "$ICON_DIR" "$DESKTOP_DIR" "$BIN_DIR"
cp -a "$ROOT/app/." "$APP_DIR/"
install -m 0644 "$ROOT/ghost-surfer.svg" "$APP_DIR/ghost-surfer.svg"
install -m 0755 "$ROOT/uninstall-linux.sh" "$APP_DIR/uninstall-linux.sh"
touch "$APP_DIR/.ghost-surfer-install"
install -m 0644 "$ROOT/ghost-surfer.svg" "$ICON_DIR/ghost-surfer.svg"
install -m 0755 "$ROOT/manage-linux.sh" "$BIN_DIR/ghost-surfer-manager"

desktop_escape() { sed 's/\\/\\\\/g; s/"/\\"/g'; }
exec_path="$(printf '%s' "$APP_DIR/ghost-surfer" | desktop_escape)"
icon_path="$(printf '%s' "$ICON_DIR/ghost-surfer.svg" | desktop_escape)"
cat > "$DESKTOP_DIR/ghost-surfer.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Ghost Surfer
Comment=Privacy-first web browser
Exec="$exec_path"
Icon="$icon_path"
Terminal=false
Categories=Network;WebBrowser;Privacy;
StartupNotify=true
EOF

chmod 0755 "$DESKTOP_DIR/ghost-surfer.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi

echo "Ghost Surfer was installed for this user. The install manager is available as: $BIN_DIR/ghost-surfer-manager"
"$APP_DIR/ghost-surfer" >/dev/null 2>&1 &
