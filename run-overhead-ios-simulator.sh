#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$ROOT/ios/OverHeadMobile.xcodeproj"
SCHEME="OverHeadMobile"
BUNDLE_ID="com.blacklion.overhead"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "iOS Simulator builds require macOS and Xcode. Use Linux to edit and push source, then run this on the Mac." >&2
    exit 1
fi

if [[ -n "${DEVELOPER_DIR:-}" ]]; then
    XCODE_DEVELOPER_DIR="$DEVELOPER_DIR"
elif [[ -n "${XCODE_APP:-}" && -d "$XCODE_APP/Contents/Developer" ]]; then
    XCODE_DEVELOPER_DIR="$XCODE_APP/Contents/Developer"
elif [[ -d "/Applications/Xcode.app/Contents/Developer" ]]; then
    XCODE_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
elif [[ -d "/Users/admin/Downloads/Xcode.app/Contents/Developer" ]]; then
    XCODE_DEVELOPER_DIR="/Users/admin/Downloads/Xcode.app/Contents/Developer"
else
    echo "Could not find Xcode. Set DEVELOPER_DIR or XCODE_APP to your Xcode installation." >&2
    exit 1
fi

export DEVELOPER_DIR="$XCODE_DEVELOPER_DIR"
XCODEBUILD="$DEVELOPER_DIR/usr/bin/xcodebuild"
SIMCTL="$(xcrun --find simctl)"

if [[ ! -d "$PROJECT" ]]; then
    echo "Xcode project not found: $PROJECT" >&2
    exit 1
fi

if [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=all)" ]]; then
    echo "Working tree has local changes. Commit or stash them before refreshing from GitHub." >&2
    exit 1
fi

if ! git -C "$ROOT" symbolic-ref --quiet --short HEAD >/dev/null; then
    echo "You are on a detached Git commit. Switch to a branch with an upstream before refreshing." >&2
    exit 1
fi
if ! git -C "$ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    echo "This branch has no GitHub upstream. Set one before refreshing." >&2
    exit 1
fi

echo "Fetching the latest OverHead iOS source..."
git -C "$ROOT" pull --ff-only

SIMULATOR_ID="$("$SIMCTL" list devices available --json | SIMULATOR_NAME="${SIMULATOR_NAME:-}" python3 -c '
import json, os, sys
target = os.environ.get("SIMULATOR_NAME", "").strip().lower()
devices = [d for group in json.load(sys.stdin)["devices"].values() for d in group
           if d.get("isAvailable") and "iphone" in d.get("name", "").lower()
           and (not target or target in d["name"].lower())]
booted = [d for d in devices if d.get("state") == "Booted"]
choices = booted or devices
if choices:
    print(choices[0]["udid"])
')"
if [[ -z "$SIMULATOR_ID" ]]; then
    if [[ -n "${SIMULATOR_NAME:-}" ]]; then
        echo "No available iPhone simulator matched SIMULATOR_NAME='$SIMULATOR_NAME'." >&2
    else
        echo "No available iPhone simulator was found. Install an iPhone runtime in Xcode first." >&2
    fi
    exit 1
fi

if ! "$SIMCTL" list devices | grep -F "$SIMULATOR_ID" | grep -q '(Booted)'; then
    "$SIMCTL" boot "$SIMULATOR_ID"
fi
open -a "$DEVELOPER_DIR/Applications/Simulator.app" --args -CurrentDeviceUDID "$SIMULATOR_ID"
SIMULATOR_BOOT_TIMEOUT="${SIMULATOR_BOOT_TIMEOUT:-180}"
python3 - "$SIMCTL" "$SIMULATOR_ID" "$SIMULATOR_BOOT_TIMEOUT" <<'PY'
import subprocess
import sys

try:
    subprocess.run([sys.argv[1], "bootstatus", sys.argv[2], "-b"], check=True, timeout=int(sys.argv[3]))
except subprocess.TimeoutExpired:
    print(f"Simulator startup exceeded {sys.argv[3]} seconds. Open Simulator, let its first-time setup finish, then run this command again.", file=sys.stderr)
    sys.exit(1)
PY

DERIVED_DATA="${DERIVED_DATA:-$HOME/Library/Developer/Xcode/DerivedData/${SCHEME}-Simulator}"
"$XCODEBUILD" \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "id=$SIMULATOR_ID" \
    -derivedDataPath "$DERIVED_DATA" \
    -quiet \
    ONLY_ACTIVE_ARCH=YES \
    CODE_SIGNING_ALLOWED=NO \
    build

APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/$SCHEME.app"
if [[ ! -d "$APP_PATH" ]]; then
    echo "Build succeeded but the app bundle was not found: $APP_PATH" >&2
    exit 1
fi

"$SIMCTL" terminate "$SIMULATOR_ID" "$BUNDLE_ID" >/dev/null 2>&1 || true
"$SIMCTL" install "$SIMULATOR_ID" "$APP_PATH"
"$SIMCTL" launch "$SIMULATOR_ID" "$BUNDLE_ID"
sleep 2
echo "OverHead is running in the iOS Simulator."
