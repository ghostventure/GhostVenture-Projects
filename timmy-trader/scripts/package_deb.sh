#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=${1:-0.1.0}
ARCH=amd64
PKG_NAME=timmy-trader
PKG_ROOT="build/deb/${PKG_NAME}_${VERSION}_${ARCH}"
DEB_OUT="dist/${PKG_NAME}_${VERSION}_${ARCH}.deb"

scripts/build_elf.sh

rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT/DEBIAN"
mkdir -p "$PKG_ROOT/opt/timmy-trader"
mkdir -p "$PKG_ROOT/usr/bin"
mkdir -p "$PKG_ROOT/usr/share/applications"
mkdir -p "$PKG_ROOT/usr/share/doc/timmy-trader"
mkdir -p "$PKG_ROOT/usr/share/doc/timmy-trader/knowledge"

cp -a dist/Timmy/. "$PKG_ROOT/opt/timmy-trader/"
install -m 0755 packaging/timmy-trader "$PKG_ROOT/usr/bin/timmy-trader"
install -m 0644 packaging/timmy-trader.desktop "$PKG_ROOT/usr/share/applications/timmy-trader.desktop"
install -m 0644 README.md "$PKG_ROOT/usr/share/doc/timmy-trader/README.md"
install -m 0644 .env.example "$PKG_ROOT/usr/share/doc/timmy-trader/env.example"
install -m 0644 docs/WEBULL_SETUP.md "$PKG_ROOT/usr/share/doc/timmy-trader/WEBULL_SETUP.md"
install -m 0644 docs/HOTFIX_IMPLEMENTATION_LOG.md "$PKG_ROOT/usr/share/doc/timmy-trader/HOTFIX_IMPLEMENTATION_LOG.md"
install -m 0644 docs/OPERATOR_CHECKLIST.md "$PKG_ROOT/usr/share/doc/timmy-trader/OPERATOR_CHECKLIST.md"
install -m 0644 docs/IMPLEMENTATION_OUTLINE.md "$PKG_ROOT/usr/share/doc/timmy-trader/IMPLEMENTATION_OUTLINE.md"
install -m 0644 knowledge/*.md "$PKG_ROOT/usr/share/doc/timmy-trader/knowledge/"

cat > "$PKG_ROOT/DEBIAN/control" <<CONTROL
Package: ${PKG_NAME}
Version: ${VERSION}
Section: office
Priority: optional
Architecture: ${ARCH}
Maintainer: Local Timmy Build <local@timmy>
Description: Timmy native Webull trading assistant
 Timmy is a native Linux trading assistant and guarded Webull OpenAPI preview tool.
 Credentials are not bundled and are stored under the user's config directory.
CONTROL

cat > "$PKG_ROOT/DEBIAN/postinst" <<'POSTINST'
#!/usr/bin/env bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi
POSTINST
chmod 0755 "$PKG_ROOT/DEBIAN/postinst"

cat > "$PKG_ROOT/DEBIAN/postrm" <<'POSTRM'
#!/usr/bin/env bash
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi
POSTRM
chmod 0755 "$PKG_ROOT/DEBIAN/postrm"

mkdir -p dist
dpkg-deb --root-owner-group --build "$PKG_ROOT" "$DEB_OUT"
dpkg-deb --info "$DEB_OUT"
echo "$DEB_OUT"
