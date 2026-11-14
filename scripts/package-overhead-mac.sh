#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-0.1.0}"
APP_DIR="$ROOT/macOS/OverHeadNative/.build/OverHead.app"
OUT_DIR="$ROOT/website-next/public/downloads/mac"
ARCHIVE="$OUT_DIR/OverHead-Mac-$VERSION.zip"

"$ROOT/macOS/OverHeadNative/build-macos-app.sh" release
mkdir -p "$OUT_DIR"
rm -f "$ARCHIVE"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$ARCHIVE"
(cd "$OUT_DIR" && shasum -a 256 "$(basename "$ARCHIVE")" > SHA256SUMS.txt)

echo "Packaged $ARCHIVE"
echo "SHA-256: $(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"
