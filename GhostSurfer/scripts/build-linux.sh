#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PYTHON_CMD="${PYTHON:-python3}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Build this package on Linux so PyInstaller bundles the correct native libraries." >&2
  exit 1
fi

ARCH="$(uname -m)"
if [[ "$ARCH" != "x86_64" ]]; then
  echo "This broad-compatibility build currently targets x86_64; got: $ARCH." >&2
  exit 1
fi

if ! "$PYTHON_CMD" -c 'import PyInstaller, PySide6; assert PySide6.__version__ == "6.12.0" and PyInstaller.__version__ == "6.21.0"' >/dev/null 2>&1; then
  echo "Install the pinned Linux build dependencies: $PYTHON_CMD -m pip install -r requirements-linux.txt" >&2
  exit 1
fi

GLIBC_VERSION="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}' || true)"
if [[ -z "$GLIBC_VERSION" ]]; then
  echo "This build requires glibc; musl-based distributions are not supported." >&2
  exit 1
fi

BUILD_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/release-linux-$ARCH-$BUILD_ID"
APP_VERSION="$(sed -n 's/^APP_VERSION = "\([^"]*\)"$/\1/p' ghost_surfer.py | head -1)"
if [[ -z "$APP_VERSION" ]]; then
  echo "Could not determine APP_VERSION from ghost_surfer.py." >&2
  exit 1
fi
PACKAGE="$OUT/GhostSurfer-Linux-$ARCH"
mkdir -p "$PACKAGE/app"

"$PYTHON_CMD" -m PyInstaller \
  --clean \
  --noconfirm \
  --windowed \
  --name ghost-surfer \
  --distpath "$OUT/dist" \
  --workpath "$OUT/work" \
  --specpath "$OUT" \
  --add-data "$ROOT/assets/ghost-surfer-icon.svg:assets" \
  ghost_surfer.py

cp -a "$OUT/dist/ghost-surfer/." "$PACKAGE/app/"
cp assets/ghost-surfer-icon.svg "$PACKAGE/ghost-surfer.svg"
cp scripts/install-linux.sh "$PACKAGE/install-linux.sh"
cp scripts/uninstall-linux.sh "$PACKAGE/uninstall-linux.sh"
cp scripts/manage-linux.sh "$PACKAGE/manage-linux.sh"
cp docs/LINUX.md "$PACKAGE/README.txt"
cat > "$PACKAGE/release.json" <<EOF
{
  "name": "Ghost Surfer",
  "version": "$APP_VERSION",
  "platform": "linux",
  "architecture": "$ARCH",
  "glibc_build": "$GLIBC_VERSION"
}
EOF
chmod +x "$PACKAGE/install-linux.sh" "$PACKAGE/uninstall-linux.sh" "$PACKAGE/manage-linux.sh" "$PACKAGE/app/ghost-surfer"

tar -C "$OUT" -czf "$OUT/GhostSurfer-Linux-$ARCH-v$APP_VERSION.tar.gz" "GhostSurfer-Linux-$ARCH"
(
  cd "$OUT"
  sha256sum "GhostSurfer-Linux-$ARCH-v$APP_VERSION.tar.gz" > SHA256SUMS.txt
)
echo "Created: $OUT/GhostSurfer-Linux-$ARCH-v$APP_VERSION.tar.gz"
echo "Checksum: $OUT/SHA256SUMS.txt"
