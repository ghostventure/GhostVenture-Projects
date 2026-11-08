#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
APP_PARENT="$HOME/.local/opt"
APP_DIR="$APP_PARENT/ghost-surfer"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"

if [[ "$(id -u)" == 0 ]]; then
  echo "Run the per-user installer as your regular account; sudo is not required." >&2
  exit 1
fi
if [[ ! -x "$ROOT/app/ghost-surfer" ]]; then
  echo "The package is incomplete: app/ghost-surfer is missing or not executable." >&2
  exit 1
fi
if [[ -L "$APP_PARENT" || -L "$APP_DIR" ]]; then
  echo "Refusing to install through a symbolic link at $APP_PARENT or $APP_DIR." >&2
  exit 1
fi
if [[ -e "$APP_DIR" && ! -f "$APP_DIR/.ghost-surfer-install" ]]; then
  echo "Refusing to replace an unmanaged directory: $APP_DIR" >&2
  exit 1
fi

mkdir -p "$APP_PARENT" "$ICON_DIR" "$DESKTOP_DIR" "$BIN_DIR"
if [[ -L "$APP_PARENT" || "$(stat -c '%u' "$APP_PARENT")" != "$(id -u)" ]]; then
  echo "Refusing to use an install directory not owned by this account: $APP_PARENT" >&2
  exit 1
fi
LOCK_FILE="$APP_PARENT/.ghost-surfer-install.lock"
if [[ -L "$LOCK_FILE" ]]; then
  echo "Refusing to use a symbolic-link install lock: $LOCK_FILE" >&2
  exit 1
fi
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another Ghost Surfer install or update is already running." >&2
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

STAGING="$(mktemp -d "$APP_PARENT/.ghost-surfer-new.XXXXXX")"
BACKUP="$APP_PARENT/.ghost-surfer-backup.$$"
cleanup() {
  [[ -n "${STAGING:-}" && -d "$STAGING" ]] && rm -rf -- "$STAGING"
}
trap cleanup EXIT
cp -a "$ROOT/app/." "$STAGING/"
install -m 0644 "$ROOT/ghost-surfer.svg" "$STAGING/ghost-surfer.svg"
install -m 0755 "$ROOT/uninstall-linux.sh" "$STAGING/uninstall-linux.sh"
touch "$STAGING/.ghost-surfer-install"
if [[ ! -x "$STAGING/ghost-surfer" ]]; then
  echo "The staged application is missing its executable." >&2
  exit 1
fi

if [[ -e "$APP_DIR" ]]; then
  mv -- "$APP_DIR" "$BACKUP"
fi
if ! mv -- "$STAGING" "$APP_DIR"; then
  if [[ -e "$BACKUP" && ! -e "$APP_DIR" ]]; then
    mv -- "$BACKUP" "$APP_DIR"
  fi
  exit 1
fi
STAGING=""
if [[ -e "$BACKUP" ]]; then
  rm -rf -- "$BACKUP"
fi

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
chmod 0644 "$DESKTOP_DIR/ghost-surfer.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi

echo "Ghost Surfer was installed for this user at $APP_DIR. Browser profile data is stored separately."
if [[ "${GHOST_SURFER_SKIP_LAUNCH:-0}" != 1 ]]; then
  "$APP_DIR/ghost-surfer" >/dev/null 2>&1 &
fi
