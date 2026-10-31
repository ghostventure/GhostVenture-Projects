"""Optional personal data vault for Ghost Surfer.

Vault contents are encrypted with Windows DPAPI for the current user and are
kept in a separate file from browser history, exports, and profile backups.
"""
from __future__ import annotations

import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path
from urllib.parse import urlsplit

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox, QDialog, QFormLayout, QHBoxLayout, QLabel,
    QLineEdit, QListWidget, QMessageBox, QPushButton, QVBoxLayout,
)


class _Blob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


def _protect(raw: bytes) -> bytes:
    if os.name != "nt":
        raise OSError("The personal vault requires Windows account encryption.")
    source_buf = ctypes.create_string_buffer(raw)
    source = _Blob(len(raw), ctypes.cast(source_buf, ctypes.POINTER(ctypes.c_ubyte)))
    target = _Blob()
    crypt = ctypes.windll.crypt32
    kernel = ctypes.windll.kernel32
    crypt.CryptProtectData.argtypes = [ctypes.POINTER(_Blob), wintypes.LPCWSTR, ctypes.POINTER(_Blob), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(_Blob)]
    crypt.CryptProtectData.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if not crypt.CryptProtectData(ctypes.byref(source), "Ghost Surfer Personal Vault", None, None, None, 0x1, ctypes.byref(target)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(target.pbData, target.cbData)
    finally:
        kernel.LocalFree(target.pbData)


def _unprotect(raw: bytes) -> bytes:
    if os.name != "nt":
        raise OSError("The personal vault requires Windows account encryption.")
    source_buf = ctypes.create_string_buffer(raw)
    source = _Blob(len(raw), ctypes.cast(source_buf, ctypes.POINTER(ctypes.c_ubyte)))
    target = _Blob()
    description = wintypes.LPWSTR()
    crypt = ctypes.windll.crypt32
    kernel = ctypes.windll.kernel32
    crypt.CryptUnprotectData.argtypes = [ctypes.POINTER(_Blob), ctypes.POINTER(wintypes.LPWSTR), ctypes.POINTER(_Blob), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(_Blob)]
    crypt.CryptUnprotectData.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if not crypt.CryptUnprotectData(ctypes.byref(source), ctypes.byref(description), None, None, None, 0x1, ctypes.byref(target)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(target.pbData, target.cbData)
    finally:
        kernel.LocalFree(target.pbData)
        if description:
            kernel.LocalFree(description)


class PersonalDataVault:
    def __init__(self, path: Path):
        self.path = path
        self.records: list[dict[str, str]] = []
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            rows = json.loads(_unprotect(self.path.read_bytes()).decode("utf-8"))
            if not isinstance(rows, list):
                raise ValueError("Vault data has an unsupported format.")
            self.records = [
                {key: str(row.get(key, "")) for key in ("kind", "name", "address", "phone", "username", "password", "origin")}
                for row in rows if isinstance(row, dict) and row.get("kind") in {"Contact", "Login"}
            ][:1000]
        except (OSError, ValueError, UnicodeError, json.JSONDecodeError) as exc:
            raise ValueError("The encrypted personal vault could not be opened. Its data was left untouched.") from exc

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        encrypted = _protect(json.dumps(self.records, ensure_ascii=False).encode("utf-8"))
        temporary = self.path.with_suffix(".tmp")
        temporary.write_bytes(encrypted)
        temporary.replace(self.path)


class PersonalDataVaultDialog(QDialog):
    def __init__(self, browser_window, path: Path):
        super().__init__(browser_window)
        self.browser_window = browser_window
        self.vault = PersonalDataVault(path)
        self.setWindowTitle("Personal Data Vault")
        self.setMinimumSize(600, 500)
        self.setModal(True)
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Names, addresses, phone numbers, and site logins are encrypted for your Windows account. Credit cards are not supported. This vault is excluded from browser history and backups."))
        self.rows = QListWidget()
        self.rows.setAccessibleName("Saved contacts and website logins")
        layout.addWidget(self.rows, 1)
        actions = QHBoxLayout()
        self.kind = QComboBox()
        self.kind.addItems(["Contact", "Login"])
        actions.addWidget(self.kind)
        for label, callback in (("Add", self.add_record), ("Edit", self.edit_record), ("Delete", self.delete_record), ("Fill login on this site", self.fill_login)):
            button = QPushButton(label)
            button.clicked.connect(callback)
            actions.addWidget(button)
        layout.addLayout(actions)
        close = QPushButton("Close")
        close.clicked.connect(self.accept)
        layout.addWidget(close, 0, Qt.AlignmentFlag.AlignRight)
        self.refresh()

    def refresh(self) -> None:
        self.rows.clear()
        for row in self.vault.records:
            title = row.get("name") or row.get("username") or "Untitled"
            detail = row.get("origin") if row["kind"] == "Login" else row.get("phone")
            self.rows.addItem(f"{row['kind']}  |  {title}" + (f"  |  {detail}" if detail else ""))

    def _fields(self, kind: str, existing: dict[str, str] | None = None):
        existing = existing or {}
        dialog = QDialog(self)
        dialog.setWindowTitle(f"{'Edit' if existing else 'Add'} {kind.lower()}")
        form = QFormLayout(dialog)
        fields: dict[str, QLineEdit] = {}
        keys = (("name", "Name"), ("address", "Address"), ("phone", "Phone number")) if kind == "Contact" else (("name", "Label"), ("origin", "Website (https://example.com)"), ("username", "Username"), ("password", "Password"))
        for key, label in keys:
            edit = QLineEdit(existing.get(key, ""))
            if key == "password":
                edit.setEchoMode(QLineEdit.EchoMode.Password)
            fields[key] = edit
            form.addRow(label, edit)
        save = QPushButton("Save")
        save.clicked.connect(dialog.accept)
        form.addRow(save)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return None
        result = {key: value.text().strip() for key, value in fields.items()}
        result.update({key: "" for key in ("name", "address", "phone", "username", "password", "origin") if key not in result})
        result["kind"] = kind
        if kind == "Login":
            parsed = urlsplit(result["origin"])
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                QMessageBox.warning(self, "Website needed", "Enter a website address beginning with https://, without a username or password in the URL.")
                return None
            result["origin"] = f"https://{parsed.netloc.lower()}"
            if not result["username"] or not result["password"]:
                QMessageBox.warning(self, "Login incomplete", "Enter both a username and password.")
                return None
        elif not result["name"]:
            QMessageBox.warning(self, "Name needed", "Enter a name for this contact.")
            return None
        return result

    def _commit(self) -> None:
        try:
            self.vault.save()
        except (OSError, ValueError) as exc:
            QMessageBox.critical(self, "Vault could not be saved", str(exc))
        self.refresh()

    def add_record(self) -> None:
        row = self._fields(self.kind.currentText())
        if row:
            self.vault.records.append(row)
            self._commit()

    def edit_record(self) -> None:
        index = self.rows.currentRow()
        if index < 0:
            return
        row = self._fields(self.vault.records[index]["kind"], self.vault.records[index])
        if row:
            self.vault.records[index] = row
            self._commit()

    def delete_record(self) -> None:
        index = self.rows.currentRow()
        if index < 0:
            return
        if QMessageBox.question(self, "Delete saved information?", "Permanently delete this vault entry?") == QMessageBox.StandardButton.Yes:
            del self.vault.records[index]
            self._commit()

    def fill_login(self) -> None:
        index = self.rows.currentRow()
        tab = self.browser_window.current_tab()
        if index < 0 or not tab:
            return
        row = self.vault.records[index]
        parsed = urlsplit(tab.url().toString())
        if row["kind"] != "Login" or parsed.scheme != "https" or parsed.netloc.casefold() != urlsplit(row["origin"]).netloc.casefold():
            QMessageBox.information(self, "Site does not match", "Select a saved login for the exact HTTPS site currently open.")
            return
        payload = json.dumps([row["username"], row["password"]])
        script = """((values) => { const fields=[...document.querySelectorAll('input:not([type]),input[type=text],input[type=email],input[autocomplete=username],input[type=password]')].filter(e=>e.getClientRects().length&&!e.disabled&&!e.readOnly); const pass=fields.find(e=>e.type==='password'); if(!pass)return false; const user=fields.find(e=>e!==pass&&(/user|email|login/i.test(e.autocomplete+' '+e.name+' '+e.id)||e.type==='email'))||fields.find(e=>e!==pass); if(user){user.focus();user.value=values[0];user.dispatchEvent(new Event('input',{bubbles:true}));user.dispatchEvent(new Event('change',{bubbles:true}));} pass.focus();pass.value=values[1];pass.dispatchEvent(new Event('input',{bubbles:true}));pass.dispatchEvent(new Event('change',{bubbles:true}));return true; })""" + f"({payload})"
        tab.page().runJavaScript(script, lambda ok: QMessageBox.information(self, "Login fill", "Login filled. Review the fields before submitting." if ok else "No visible password field was found on this page."))
