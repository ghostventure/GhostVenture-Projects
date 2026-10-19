#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${SERVICE_DIR}/timmy-trader.service"
USER_BIN="${HOME}/.local/bin"
APP_LAUNCHER="${USER_BIN}/timmy-trader"

mkdir -p "${SERVICE_DIR}"
mkdir -p "${USER_BIN}"

# The updater atomically replaces this user launcher with its overlay launcher.
# Before an update exists, keep the packaged system launcher as the fallback.
LAUNCHER_TMP="${APP_LAUNCHER}.tmp"
cat > "${LAUNCHER_TMP}" <<'LAUNCHER'
#!/bin/sh
set -eu
OVERLAY="${HOME}/.local/share/timmy-trader/current/Timmy"
if [ -x "${OVERLAY}" ]; then
  export TIMMY_HOME="${TIMMY_HOME:-${HOME}/.config/timmy-trader}"
  exec "${OVERLAY}" "$@"
fi
exec /usr/bin/timmy-trader "$@"
LAUNCHER
chmod 0755 "${LAUNCHER_TMP}"
mv -f "${LAUNCHER_TMP}" "${APP_LAUNCHER}"

cat > "${SERVICE_FILE}" <<SERVICE
[Unit]
Description=Timmy native trading assistant
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
ExecStart=%h/.local/bin/timmy-trader
Restart=on-failure
RestartSec=10
Environment=TIMMY_HOME=%h/.config/timmy-trader

[Install]
WantedBy=default.target
SERVICE

# Capture the active graphical session when available. A fixed DISPLAY=:0 is
# incorrect on Wayland, multi-seat, and nonzero X display sessions.
systemctl --user import-environment DISPLAY WAYLAND_DISPLAY XAUTHORITY 2>/dev/null || true
systemctl --user daemon-reload
echo "Installed ${SERVICE_FILE}"
echo "Enable with: systemctl --user enable --now timmy-trader.service"
