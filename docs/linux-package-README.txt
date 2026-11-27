OverHead 0.3.14 for Linux (x86_64)

This bundle contains both supported package formats:
  OverHead-0.3.14-x86_64.AppImage
  OverHead-0.3.14-amd64.deb

Choose one package format; do not install both at once.

AppImage:
  chmod +x OverHead-0.3.14-x86_64.AppImage
  ./OverHead-0.3.14-x86_64.AppImage

Debian/Ubuntu:
  sudo apt install ./OverHead-0.3.14-amd64.deb

The SHA256SUMS.txt file verifies both installers. The AppImage update manifest
is latest-linux.yml. AppImage automatic updates use the OverHead Linux GitHub
release feed; Debian package updates are installed through the package manager.

Billing startup requires the updated Firebase billingApi deployment. A package
build alone does not confirm that a live payment can be processed.
