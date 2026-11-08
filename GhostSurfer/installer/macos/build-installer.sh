#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_root="$(cd "$script_dir/../.." && pwd)"
version="${VERSION:-0.1.0}"
derived_data="${DERIVED_DATA_PATH:-${TMPDIR:-/tmp}/GhostSurferMacInstallerDerivedData}"
output_package="${OUTPUT_PACKAGE:-$script_dir/Ghost-Surfer-macOS-${version}.pkg}"
app_path="$derived_data/Build/Products/Release/Ghost Surfer.app"
project_path="$project_root/macOS/GhostSurferMac.xcodeproj"

xcode_args=(
  -project "$project_path"
  -scheme GhostSurferMac
  -configuration Release
  -destination 'platform=macOS'
  -derivedDataPath "$derived_data"
  'ARCHS=arm64 x86_64'
  ONLY_ACTIVE_ARCH=NO
)

if [[ -n "${APP_SIGN_IDENTITY:-}" ]]; then
  xcode_args+=("CODE_SIGN_IDENTITY=$APP_SIGN_IDENTITY" CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES)
else
  xcode_args+=(CODE_SIGNING_ALLOWED=NO)
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

if [[ -n "${NOTARY_PROFILE:-}" ]]; then
  if [[ -z "${APP_SIGN_IDENTITY:-}" || -z "${INSTALLER_SIGN_IDENTITY:-}" ]]; then
    echo "Notarization requires both APP_SIGN_IDENTITY and INSTALLER_SIGN_IDENTITY." >&2
    exit 1
  fi
  xcrun notarytool submit "$output_package" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$output_package"
fi

echo "Created $output_package"
shasum -a 256 "$output_package"
