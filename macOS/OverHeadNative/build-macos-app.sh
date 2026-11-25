#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CONFIGURATION="${1:-release}"
APP_NAME="OverHead.app"
APP_PATH="$ROOT/.build/$APP_NAME"

cd "$ROOT"
swift build -c "$CONFIGURATION" -Xswiftc -disable-batch-mode -j 1

EXECUTABLE="$(swift build -c "$CONFIGURATION" --show-bin-path)/OverHead"
if [[ ! -x "$EXECUTABLE" ]]; then
  echo "SwiftPM executable not found: $EXECUTABLE" >&2
  exit 1
fi

mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"
cp "$EXECUTABLE" "$APP_PATH/Contents/MacOS/OverHead"
BILLING_EXECUTABLE="$(swift build -c "$CONFIGURATION" --show-bin-path)/OverHeadBilling"
BILLING_APP="$APP_PATH/Contents/PlugIns/OverHeadBilling.app"
mkdir -p "$BILLING_APP/Contents/MacOS"
cp "$BILLING_EXECUTABLE" "$BILLING_APP/Contents/MacOS/OverHeadBilling"
SYNC_EXECUTABLE="$(swift build -c "$CONFIGURATION" --show-bin-path)/OverHeadBillingSync"
cp "$SYNC_EXECUTABLE" "$BILLING_APP/Contents/MacOS/OverHeadBillingSync"
cat > "$BILLING_APP/Contents/Info.plist" <<'BILLING_PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>OverHeadBilling</string>
<key>CFBundleIdentifier</key><string>com.blacklion.overhead.billing</string>
<key>CFBundleName</key><string>OverHead Billing</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
BILLING_PLIST
ICONSET="$ROOT/.build/OverHead.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
for spec in "16 icon_16x16.png" "32 icon_16x16@2x.png" "32 icon_32x32.png" "64 icon_32x32@2x.png" "128 icon_128x128.png" "256 icon_128x128@2x.png" "256 icon_256x256.png" "512 icon_256x256@2x.png" "512 icon_512x512.png" "1024 icon_512x512@2x.png"; do
  read -r SIZE NAME <<< "$spec"
  sips -s format png --resampleWidth "$SIZE" --resampleHeight "$SIZE" "$ROOT/Assets/OverHead-Mark.svg" --out "$ICONSET/$NAME" >/dev/null
done
iconutil --convert icns --output "$APP_PATH/Contents/Resources/OverHead.icns" "$ICONSET"
rm -rf "$ICONSET"
cat > "$APP_PATH/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>en</string>
    <key>CFBundleExecutable</key><string>OverHead</string>
    <key>CFBundleIdentifier</key><string>com.blacklion.overhead</string>
    <key>CFBundleIconFile</key><string>OverHead</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>OverHead</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>LSUIElement</key><false/>
    <key>LSBackgroundOnly</key><false/>
    <key>NSHighResolutionCapable</key><true/>
    <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
PLIST

# Give the Billing sync helper the same local code identity as the Billing app so
# their Keychain-backed authenticated archive remains accessible to both processes.
codesign --force --sign - --identifier com.blacklion.overhead.billing "$BILLING_APP/Contents/MacOS/OverHeadBillingSync"
# Ad-hoc signatures seal nested code and resources for local tamper detection.
codesign --force --sign - "$BILLING_APP"
codesign --force --sign - "$APP_PATH"

echo "Created $APP_PATH"
echo "This local build is ad-hoc signed. Use Developer ID signing and notarization for distribution outside your Mac."
