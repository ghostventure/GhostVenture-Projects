#!/usr/bin/env bash
set -euo pipefail

SERVICE_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${SERVICE_DIR}/timmy-trader.service"

mkdir -p "${SERVICE_DIR}"

cat > "${SERVICE_FILE}" <<SERVICE
[Unit]
Description=Timmy native trading assistant
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/timmy-trader
Restart=on-failure
RestartSec=10
Environment=TIMMY_HOME=${HOME}/.config/timmy-trader
Environment=DISPLAY=${DISPLAY:-:0}

[Install]
WantedBy=default.target
SERVICE

systemctl --user daemon-reload
echo "Installed ${SERVICE_FILE}"
echo "Enable with: systemctl --user enable --now timmy-trader.service"
