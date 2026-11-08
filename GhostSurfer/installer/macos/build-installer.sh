#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
version="${VERSION:-0.2.2}"
derived_data="${DERIVED_DATA_PATH:-${TMPDIR:-/tmp}/GhostSurferMacInstallerDerivedData}"
output_package="${OUTPUT_PACKAGE:-$script_dir/Ghost-Surfer-macOS-${version}.pkg}"
updates_dir="${UPDATES_DIR:-$project_root/site/updates}"
app_path="$derived_data/Build/Products/Release/Ghost Surfer.app"
project_path="$project_root/macOS/GhostSurferMac.xcodeproj"

xcode_args=(
  -project "$project_path"
  -scheme GhostSurferMac
  -configuration Release
  -destination 'platform=macOS'
  -derivedDataPath "$derived_data"
  -packageAuthorizationProvider netrc
  -skipPackageUpdates
  'ARCHS=arm64 x86_64'
  ONLY_ACTIVE_ARCH=NO
)

if [[ -n "${APP_SIGN_IDENTITY:-}" ]]; then
  xcode_args+=("CODE_SIGN_IDENTITY=$APP_SIGN_IDENTITY" CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES)
else
  # Sparkle needs a code-signed app bundle. Ad-hoc signing keeps the app
  # executable on this machine; a Developer ID signature is recommended for distribution.
  xcode_args+=(CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES CODE_SIGN_IDENTITY=-)
fi

echo "Building Ghost Surfer for Apple silicon and Intel..."
xcodebuild "${xcode_args[@]}" build

if [[ ! -d "$app_path" ]]; then
  echo "Build did not produce the expected app: $app_path" >&2
  exit 1
fi
if [[ ! -f "$app_path/Contents/Resources/GhostSurfer.icns" ]]; then
  echo "The Ghost Surfer app icon is missing from the built app." >&2
  exit 1
fi

codesign --verify --deep --strict "$app_path"
if ! otool -l "$app_path/Contents/MacOS/Ghost Surfer" | grep -Fq '@executable_path/../Frameworks'; then
  echo "The app is missing the embedded-framework runtime search path." >&2
  exit 1
fi
if ! otool -L "$app_path/Contents/MacOS/Ghost Surfer" | grep -Fq '@rpath/Sparkle.framework/Versions/B/Sparkle'; then
  echo "The app is not linked to the embedded Sparkle framework." >&2
  exit 1
fi
app_arches="$(lipo -archs "$app_path/Contents/MacOS/Ghost Surfer")"
if [[ "$app_arches" != *arm64* || "$app_arches" != *x86_64* ]]; then
  echo "Expected a universal arm64 and x86_64 app; found: $app_arches" >&2
  exit 1
fi
if [[ "$(/usr/libexec/PlistBuddy -c 'Print :SURequireSignedFeed' "$app_path/Contents/Info.plist")" != "true" || \
      "$(/usr/libexec/PlistBuddy -c 'Print :SUVerifyUpdateBeforeExtraction' "$app_path/Contents/Info.plist")" != "true" ]]; then
  echo "Sparkle signed-feed and pre-extraction verification must remain enabled." >&2
  exit 1
fi

mkdir -p "$(dirname "$output_package")"
rm -f "$output_package"
pkg_args=(
  --component "$app_path"
  --install-location /Applications
  --identifier com.blacklion.ghostsurfer.mac
  --version "$version"
)

if [[ -n "${INSTALLER_SIGN_IDENTITY:-}" ]]; then
  pkg_args+=(--sign "$INSTALLER_SIGN_IDENTITY")
fi

pkgbuild "${pkg_args[@]}" "$output_package"

mkdir -p "$updates_dir" "$project_root/site/downloads"
update_archive="$updates_dir/Ghost-Surfer-macOS-${version}.zip"
rm -f "$update_archive"
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$update_archive"

sparkle_project="$(find "$HOME/Library/Developer/Xcode/DerivedData" -path '*/SourcePackages/checkouts/Sparkle/Sparkle.xcodeproj' -type d -print -quit 2>/dev/null || true)"
if [[ -z "$sparkle_project" ]]; then
  echo "Sparkle package checkout not found; open the Xcode project once to resolve packages." >&2
  exit 1
fi
tools_derived_data="$derived_data/SparkleTools"
DEVELOPER_DIR="${DEVELOPER_DIR:-$(xcode-select -p)}" xcodebuild \
  -project "$sparkle_project" \
  -scheme generate_appcast \
  -configuration Release \
  -derivedDataPath "$tools_derived_data" \
  -packageAuthorizationProvider netrc \
  -skipPackageUpdates build
generate_appcast="$tools_derived_data/Build/Products/Release/generate_appcast"
if [[ ! -x "$generate_appcast" ]]; then
  echo "Sparkle generate_appcast tool was not built." >&2
  exit 1
fi
DEVELOPER_DIR="${DEVELOPER_DIR:-$(xcode-select -p)}" xcodebuild \
  -project "$sparkle_project" \
  -scheme sign_update \
  -configuration Release \
  -derivedDataPath "$tools_derived_data" \
  -packageAuthorizationProvider netrc \
  -skipPackageUpdates build
sign_update="$tools_derived_data/Build/Products/Release/sign_update"
if [[ ! -x "$sign_update" ]]; then
  echo "Sparkle sign_update tool was not built." >&2
  exit 1
fi
"$generate_appcast" \
  --download-url-prefix "https://ghost-surfer-browser.web.app/updates/" \
  --release-notes-url-prefix "https://ghost-surfer-browser.web.app/updates/" \
  --link "https://ghost-surfer-browser.web.app/" \
  -o "$project_root/site/appcast-macos.xml" \
  "$updates_dir"

appcast_path="$project_root/site/appcast-macos.xml"
"$sign_update" --verify "$appcast_path"
archive_signature="$(python3 - "$appcast_path" "$version" <<'PY'
import sys
import xml.etree.ElementTree as ET

feed_path, version = sys.argv[1:]
sparkle = "http://www.andymatuschak.org/xml-namespaces/sparkle"
root = ET.parse(feed_path).getroot()
for item in root.findall(".//item"):
    if item.findtext(f"{{{sparkle}}}shortVersionString") == version:
        enclosure = item.find("enclosure")
        if enclosure is None:
            break
        print(enclosure.attrib[f"{{{sparkle}}}edSignature"])
        break
else:
    raise SystemExit(f"No signed appcast entry found for version {version}")
PY
)"
notes_signature="$(python3 - "$appcast_path" "$version" <<'PY'
import sys
import xml.etree.ElementTree as ET

feed_path, version = sys.argv[1:]
sparkle = "http://www.andymatuschak.org/xml-namespaces/sparkle"
root = ET.parse(feed_path).getroot()
for item in root.findall(".//item"):
    if item.findtext(f"{{{sparkle}}}shortVersionString") == version:
        notes = item.find(f"{{{sparkle}}}releaseNotesLink")
        if notes is None:
            break
        print(notes.attrib[f"{{{sparkle}}}edSignature"])
        break
else:
    raise SystemExit(f"No signed release notes found for version {version}")
PY
)"
"$sign_update" --verify "$update_archive" "$archive_signature"
"$sign_update" --verify "$updates_dir/Ghost-Surfer-macOS-${version}.md" "$notes_signature"
while IFS=$'\t' read -r delta_name delta_signature; do
  [[ -z "$delta_name" ]] && continue
  "$sign_update" --verify "$updates_dir/$delta_name" "$delta_signature"
done < <(python3 - "$appcast_path" "$version" <<'PY'
import sys
import urllib.parse
import xml.etree.ElementTree as ET

feed_path, version = sys.argv[1:]
sparkle = "http://www.andymatuschak.org/xml-namespaces/sparkle"
root = ET.parse(feed_path).getroot()
for item in root.findall(".//item"):
    if item.findtext(f"{{{sparkle}}}shortVersionString") != version:
        continue
    deltas = item.find(f"{{{sparkle}}}deltas")
    if deltas is not None:
        for enclosure in deltas.findall("enclosure"):
            path = urllib.parse.unquote(urllib.parse.urlparse(enclosure.attrib["url"]).path.rsplit("/", 1)[-1])
            signature = enclosure.attrib[f"{{{sparkle}}}edSignature"]
            print(f"{path}\t{signature}")
    break
PY
)

if [[ -n "${NOTARY_PROFILE:-}" ]]; then
  if [[ -z "${APP_SIGN_IDENTITY:-}" || -z "${INSTALLER_SIGN_IDENTITY:-}" ]]; then
    echo "Notarization requires both APP_SIGN_IDENTITY and INSTALLER_SIGN_IDENTITY." >&2
    exit 1
  fi
  xcrun notarytool submit "$output_package" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$output_package"
fi

cp "$output_package" "$project_root/site/downloads/"

echo "Created installer: $output_package"
echo "Created Sparkle update archive: $update_archive"
shasum -a 256 "$output_package"
