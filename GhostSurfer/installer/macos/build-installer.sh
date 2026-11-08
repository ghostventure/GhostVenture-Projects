#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
version="${VERSION:-0.2.0}"
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
"$generate_appcast" \
  --download-url-prefix "https://ghost-surfer-browser.web.app/updates/" \
  --release-notes-url-prefix "https://ghost-surfer-browser.web.app/updates/" \
  --link "https://ghost-surfer-browser.web.app/" \
  -o "$project_root/site/appcast-macos.xml" \
  "$updates_dir"

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
