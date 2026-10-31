"""Local Manifest V3 extension management for Ghost Surfer's Qt WebEngine profile."""

import json
import re
import stat
import zipfile
from pathlib import Path
from pathlib import PurePosixPath

from PySide6.QtWidgets import (
    QDialog, QFileDialog, QGroupBox, QHBoxLayout, QLabel, QListWidget, QListWidgetItem,
    QMessageBox, QPushButton, QVBoxLayout,
)
from PySide6.QtWebEngineCore import QWebEnginePage
from PySide6.QtWebEngineWidgets import QWebEngineView


MAX_ARCHIVE_ENTRIES = 2048
MAX_ARCHIVE_UNPACKED_BYTES = 100 * 1024 * 1024


def _manifest_from_source(source: Path) -> dict:
    if source.is_dir():
        manifest_path = source / "manifest.json"
        if not manifest_path.is_file():
            raise ValueError("The selected folder must contain manifest.json at its root.")
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    elif source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise ValueError(f"The ZIP exceeds the {MAX_ARCHIVE_ENTRIES}-entry safety limit.")
            total_unpacked = 0
            for entry in entries:
                normalized = entry.filename.replace("\\", "/")
                path = PurePosixPath(normalized)
                mode = (entry.external_attr >> 16) & 0xFFFF
                if (not normalized or "\x00" in normalized or normalized.startswith("/")
                        or re.match(r"^[A-Za-z]:", normalized)
                        or any(part == ".." for part in path.parts)
                        or stat.S_ISLNK(mode)):
                    raise ValueError("The ZIP contains an unsafe path or symbolic link.")
                total_unpacked += entry.file_size
                if total_unpacked > MAX_ARCHIVE_UNPACKED_BYTES:
                    raise ValueError("The ZIP exceeds the 100 MiB uncompressed-size safety limit.")
            names = [name for name in archive.namelist() if not name.endswith("/")]
            if "manifest.json" not in names:
                raise ValueError("The ZIP must contain manifest.json at its root.")
            info = archive.getinfo("manifest.json")
            if info.file_size > 1024 * 1024:
                raise ValueError("The manifest is unexpectedly large.")
            data = json.loads(archive.read(info).decode("utf-8"))
    else:
        raise ValueError("Choose a local .zip package or an unpacked extension folder.")
    if not isinstance(data, dict) or data.get("manifest_version") != 3:
        raise ValueError("Ghost Surfer supports Manifest V3 packages only.")
    if not isinstance(data.get("name"), str) or not data["name"].strip():
        raise ValueError("The manifest is missing its extension name.")
    return data


def _permission_summary(manifest: dict) -> str:
    rows = []
    for key, label in (("permissions", "Permissions"), ("optional_permissions", "Optional permissions"),
                       ("host_permissions", "Website access"), ("optional_host_permissions", "Optional website access")):
        values = manifest.get(key, [])
        if isinstance(values, list) and values:
            rows.append(f"{label}: " + ", ".join(str(value) for value in values))
    scripts = manifest.get("content_scripts", [])
    matches = sorted({match for row in scripts if isinstance(row, dict)
                      for match in row.get("matches", []) if isinstance(match, str)})
    if matches:
        rows.append("Content scripts run on: " + ", ".join(matches))
    return "\n".join(rows) if rows else "No declared permissions or host access."


class ExtensionFeatures:
    def __init__(self, window):
        self.window = window
        self.manager = window.profile.extensionManager() if window.extensions_profile_enabled else None
        self._pending_source = None
        if self.manager is not None:
            self.manager.installFinished.connect(self._install_finished)
            self.manager.loadFinished.connect(self._load_finished)
            self.manager.uninstallFinished.connect(self._uninstall_finished)

    def add_settings(self, layout) -> None:
        group = QGroupBox("Local browser extensions (Manifest V3)")
        box = QVBoxLayout(group)
        self.mode_label = QLabel()
        self.mode_label.setWordWrap(True)
        box.addWidget(self.mode_label)
        self.mode_button = QPushButton()
        self.mode_button.setObjectName("panelButton")
        self.mode_button.clicked.connect(self.toggle_profile_mode)
        box.addWidget(self.mode_button)
        self.status_label = QLabel()
        self.status_label.setWordWrap(True)
        box.addWidget(self.status_label)
        self.extension_list = QListWidget()
        self.extension_list.setMinimumHeight(140)
        self.extension_list.currentItemChanged.connect(lambda *_: self._update_actions())
        box.addWidget(self.extension_list)
        actions = QHBoxLayout()
        self.import_button = QPushButton("Import package")
        self.import_button.setObjectName("panelButton")
        self.import_button.clicked.connect(self.import_package)
        self.toggle_button = QPushButton("Enable / Disable")
        self.toggle_button.setObjectName("panelButton")
        self.toggle_button.clicked.connect(self.toggle_selected)
        self.remove_button = QPushButton("Remove")
        self.remove_button.setObjectName("panelButton")
        self.remove_button.clicked.connect(self.remove_selected)
        self.open_button = QPushButton("Open")
        self.open_button.setObjectName("panelButton")
        self.open_button.clicked.connect(self.open_selected)
        actions.addWidget(self.open_button)
        actions.addWidget(self.import_button)
        actions.addWidget(self.toggle_button)
        actions.addWidget(self.remove_button)
        box.addLayout(actions)
        note = QLabel(
            "Ghost Surfer imports local MV3 ZIPs or folders through Qt WebEngine. Review requested permissions before enabling. "
            "Chrome Web Store sign-in/install flows and native messaging are not supported. Extensions can read or change data "
            "on the sites their declared access covers. Enabling this mode uses a separate persistent browser profile; turn it "
            "off and restart to return to Ghost Surfer's temporary browsing profile."
        )
        note.setWordWrap(True)
        box.addWidget(note)
        layout.addWidget(group)
        self.refresh()

    def toggle_profile_mode(self) -> None:
        target = not self.window.extensions_profile_enabled
        description = (
            "Extensions require a separate persistent browser profile. Cookies and site storage in that profile remain on this device between runs. "
            "Your current temporary profile and its files will not be moved or removed. Ghost Surfer must restart to switch profiles."
            if target else
            "Ghost Surfer will restart in its temporary browsing profile. The extensions profile and installed extension files will remain on disk."
        )
        answer = QMessageBox.question(self.window, "Restart to change extension mode", description + "\n\nRestart now?")
        if answer != QMessageBox.StandardButton.Yes:
            return
        self.window.settings_data["extensions_profile_enabled"] = target
        self.window.store.save()
        self.window.close()
        import sys
        from PySide6.QtCore import QProcess
        arguments = sys.argv[1:] if getattr(sys, "frozen", False) else sys.argv
        QProcess.startDetached(sys.executable, arguments)

    def _require_manager(self) -> bool:
        if self.manager is None:
            QMessageBox.information(self.window, "Extensions are off", "Turn on Extensions and restart Ghost Surfer before importing or managing extensions.")
            return False
        return True

    def import_package(self) -> None:
        if not self._require_manager():
            return
        path, _ = QFileDialog.getOpenFileName(self.window, "Import extension package", "", "Extension package (*.zip);;All files (*)")
        if not path:
            path = QFileDialog.getExistingDirectory(self.window, "Select unpacked extension folder")
        if not path:
            return
        source = Path(path)
        try:
            manifest = _manifest_from_source(source)
        except (OSError, ValueError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
            QMessageBox.warning(self.window, "Extension package not imported", str(exc))
            return
        package_kind = "unpacked folder" if source.is_dir() else "ZIP package"
        details = f"{manifest['name']}\nVersion: {manifest.get('version', 'unknown')}\nSource: local {package_kind}\n\n{_permission_summary(manifest)}\n\nInstall this package? Its extension code will be available to run in Ghost Surfer, but it will remain disabled until you enable it."
        if QMessageBox.question(self.window, "Review extension access", details) != QMessageBox.StandardButton.Yes:
            return
        self._pending_source = source
        self.status_label.setText("Installing local package…")
        self.manager.installExtension(str(source))

    def _install_finished(self, info) -> None:
        error = info.error()
        if error:
            self.status_label.setText(f"Install failed: {error}")
        else:
            self.status_label.setText(f"Installed {info.name()} and left it disabled. Review its access before enabling.")
            self.refresh()
        self._pending_source = None

    def refresh(self) -> None:
        active = self.manager is not None
        self.mode_label.setText("Extensions are on. This profile stores cookies and site data between runs." if active else
                                "Extensions are off. The browser continues to use its temporary profile.")
        self.mode_button.setText("Turn extensions off and restart" if active else "Turn extensions on and restart")
        self.import_button.setEnabled(active)
        self.toggle_button.setEnabled(active)
        self.remove_button.setEnabled(active)
        self.open_button.setEnabled(False)
        self.extension_list.clear()
        if not active:
            self.status_label.setText("Enable the separate persistent profile to manage extensions.")
            return
        infos = [info for info in self.manager.extensions() if info.isInstalled()]
        if not infos:
            self.status_label.setText("No local extensions installed.")
            return
        self.status_label.setText(f"{len(infos)} local extension(s). Newly installed extensions start disabled.")
        for info in infos:
            error = info.error()
            state = "Enabled" if info.isEnabled() else "Disabled"
            item = QListWidgetItem(f"{info.name()} — {state}" + (f" — {error}" if error else ""))
            item.setData(256, info.id())
            item.setToolTip(f"{info.name()}\nID: {info.id()}\nPath: {info.path()}\n{state}" + (f"\nError: {error}" if error else ""))
            self.extension_list.addItem(item)
        self._update_actions()

    def _update_actions(self) -> None:
        info = self._selected_info()
        self.open_button.setEnabled(bool(info and info.isEnabled() and not info.actionPopupUrl().isEmpty()))

    def _selected_info(self):
        item = self.extension_list.currentItem()
        if item is None or self.manager is None:
            return None
        wanted = item.data(256)
        return next((info for info in self.manager.extensions() if info.id() == wanted and info.isInstalled()), None)

    def toggle_selected(self) -> None:
        info = self._selected_info()
        if info is None:
            return
        enable = not info.isEnabled()
        if enable:
            try:
                manifest = json.loads((Path(info.path()) / "manifest.json").read_text(encoding="utf-8"))
            except (OSError, ValueError, TypeError):
                manifest = {"name": info.name()}
            details = f"Enable {info.name()}?\n\n{_permission_summary(manifest)}\n\nThe extension may access pages and data covered by these permissions."
            if QMessageBox.question(self.window, "Confirm extension access", details) != QMessageBox.StandardButton.Yes:
                return
        self.manager.setExtensionEnabled(info, enable)
        self.window.settings_data.setdefault("enabled_extensions", {})[info.id()] = enable
        self.window.store.save()
        self.refresh()

    def remove_selected(self) -> None:
        info = self._selected_info()
        if info is None:
            return
        answer = QMessageBox.question(self.window, "Remove extension", f"Remove {info.name()} and its installed extension files? This does not clear the rest of the browser profile.")
        if answer == QMessageBox.StandardButton.Yes:
            self.manager.uninstallExtension(info)
            self.window.settings_data.setdefault("enabled_extensions", {}).pop(info.id(), None)
            self.window.store.save()

    def open_selected(self) -> None:
        info = self._selected_info()
        if info is None or not info.isEnabled() or info.actionPopupUrl().isEmpty():
            return
        dialog = QDialog(self.window)
        dialog.setWindowTitle(info.name())
        dialog.resize(380, 520)
        layout = QVBoxLayout(dialog)
        view = QWebEngineView(dialog)
        view.setPage(QWebEnginePage(self.window.profile, view))
        view.setUrl(info.actionPopupUrl())
        layout.addWidget(view)
        dialog.exec()

    def _load_finished(self, info) -> None:
        saved = self.window.settings_data.get("enabled_extensions", {})
        if isinstance(saved, dict) and saved.get(info.id()) is True and not info.isEnabled():
            self.manager.setExtensionEnabled(info, True)
        self.refresh()

    def _uninstall_finished(self, _info) -> None:
        self.refresh()
