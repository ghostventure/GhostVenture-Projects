#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/.local/opt/ghost-surfer"
ACTION="${1:-help}"

case "$ACTION" in
  install|update)
    PACKAGE_DIR="${2:-}"
    if [[ -z "$PACKAGE_DIR" || ! -x "$PACKAGE_DIR/install-linux.sh" ]]; then
      echo "Usage: ghost-surfer-manager $ACTION <extracted-package-directory>" >&2
      exit 2
    fi
    exec "$PACKAGE_DIR/install-linux.sh"
    ;;
  launch)
    if [[ ! -x "$INSTALL_DIR/ghost-surfer" ]]; then
      echo "Ghost Surfer is not installed. Use: ghost-surfer-manager install <package-directory>" >&2
      exit 1
    fi
    exec "$INSTALL_DIR/ghost-surfer"
    ;;
  uninstall)
    if [[ ! -x "$INSTALL_DIR/uninstall-linux.sh" ]]; then
      echo "Ghost Surfer is not installed at $INSTALL_DIR" >&2
      exit 1
    fi
    exec "$INSTALL_DIR/uninstall-linux.sh" "$INSTALL_DIR"
    ;;
  status)
    if [[ -x "$INSTALL_DIR/ghost-surfer" ]]; then
      echo "Ghost Surfer is installed at $INSTALL_DIR"
    else
      echo "Ghost Surfer is not installed"
      exit 1
    fi
    ;;
  help|--help|-h)
    cat <<'EOF'
Ghost Surfer installation manager

Usage:
  ghost-surfer-manager install <extracted-package-directory>
  ghost-surfer-manager update <extracted-package-directory>
  ghost-surfer-manager launch
  ghost-surfer-manager status
  ghost-surfer-manager uninstall

Install and update require the extracted Linux package directory. Close Ghost
Surfer before updating or uninstalling it. Browser profile data is preserved.
EOF
    ;;
  *)
    echo "Unknown action: $ACTION (use ghost-surfer-manager help)" >&2
    exit 2
    ;;
esac
