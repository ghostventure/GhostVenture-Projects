"""Consent gates and periodic domain-registration checks for personal-data forms."""
from __future__ import annotations

import json
import re
import threading
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PySide6.QtCore import QObject, QThread, Qt, Signal, Slot
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWidgets import (
    QCheckBox, QDialog, QHBoxLayout, QLabel, QMessageBox, QPushButton,
    QScrollArea, QVBoxLayout, QWidget,
)
from PySide6.QtWebEngineCore import QWebEngineScript, QWebEnginePage

from ghost_guard import registrable_domain


CATEGORIES = {
    "name": "Name",
    "email": "Email address",
    "phone": "Phone number",
    "address": "Address",
    "username": "Username",
    "password": "Password",
    "payment": "Payment card details (not saved in the vault)",
    "birthdate": "Date of birth",
    "government_id": "Government identifier",
}
CHECK_INTERVAL_SECONDS = 30 * 24 * 60 * 60
BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json"
_CACHE_LOCK = threading.Lock()
_BOOTSTRAP_LOCK = threading.Lock()
_BOOTSTRAP_CACHE: tuple[float, dict] | None = None
MAX_REVIEW_FIELDS = 100


FORM_MONITOR_SCRIPT = r"""
(function () {
  if (!location || !/^https?:$/.test(location.protocol)) return;
  const src = document.createElement('script');
  src.src = 'qrc:///qtwebchannel/qwebchannel.js';
  src.onload = function () {
    if (!window.qt || !qt.webChannelTransport || !window.QWebChannel) return;
    new QWebChannel(qt.webChannelTransport, function (channel) {
      const bridge = channel.objects.personalDataConsent;
      const pending = new Map();
      const fieldIds = new WeakMap();
      const approvedForms = new WeakSet();
      const categoryNames = {name:'Name',email:'Email address',phone:'Phone number',address:'Address',username:'Username',password:'Password',payment:'Payment card details',birthdate:'Date of birth',government_id:'Government identifier'};
      const fieldId = (el) => { if (!fieldIds.has(el)) fieldIds.set(el, 'f' + (++nextId).toString(36)); return fieldIds.get(el); };
      const sensitive = (el) => {
        if (!el || el.disabled || el.readOnly || el.type === 'hidden' || el.getAttribute('aria-hidden') === 'true') return '';
        const hint = [el.type, el.autocomplete, el.name, el.id, el.getAttribute('aria-label'), el.placeholder,
          ...(el.labels ? [...el.labels].map(label => label.innerText) : [])].join(' ').toLowerCase().replace(/[_-]+/g, ' ');
        if (/cc-number|cc-csc|cc-exp|credit.?card|card.?number|security.?code|\bcvv\b|\bcvc\b/.test(hint)) return 'payment';
        if (/birth|birthday|date\s+of\s+birth|\bdob\b/.test(hint)) return 'birthdate';
        if (/social\s+security|\bssn\b|national\s+id|government\s+id|tax\s+id|passport|driver.?licen[cs]e|\beitin\b/.test(hint)) return 'government_id';
        if (el.type === 'password' || /current-password|new-password/.test(hint)) return 'password';
        if (/street-address|address-line|postal-code|zip-code/.test(hint) || /address|street|postal|zip/.test(hint)) return 'address';
        if (el.type === 'tel' || /\btel\b|phone|mobile/.test(hint)) return 'phone';
        if (/\bemail\b/.test(hint) || el.type === 'email') return 'email';
        if (/given-name|family-name|\bname\b/.test(hint)) return 'name';
        if (/username|user-name|login/.test(hint)) return 'username';
        return '';
      };
      let nextId = 0;
      const capture = (form, submitter, directSubmit) => {
        const fields = [...form.querySelectorAll('input,textarea,select')].map(el => ({el, category: sensitive(el), id:fieldId(el)})).filter(x => x.category);
        if (!fields.length || pending.has(form)) return false;
        const token = 'gs-' + Date.now().toString(36) + '-' + (++nextId).toString(36);
        const request = {
          token,
          action: (() => { try { const destination = submitter && submitter.formAction ? submitter.formAction : (form.getAttribute('action') || location.href); const u = new URL(destination, location.href); return {scheme:u.protocol.replace(':',''), host:u.hostname.toLowerCase()}; } catch { return {scheme:'unknown',host:''}; } })(),
          fields: fields.slice(0, 100).map(({el,category,id}) => {
            const label = (el.labels && el.labels.length ? el.labels[0].innerText : '') || el.getAttribute('aria-label') || el.placeholder || el.name || categoryNames[category];
            return {id,category,label:String(label).trim().slice(0,120),required:!!el.required,filled:!!String(el.value || '').trim()};
          }),
          directSubmit:!!directSubmit,
          submitter: submitter && submitter.name ? {name:submitter.name,value:submitter.value} : null
        };
        pending.set(form, {fields, submitter, directSubmit, token});
        bridge.requestPersonalData(JSON.stringify(request));
        return true;
      };
      document.addEventListener('submit', function (event) {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (approvedForms.has(form)) { approvedForms.delete(form); return; }
        if (!capture(form, event.submitter || null, false)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
      const nativeSubmit = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function () {
        if (capture(this, null, true)) return;
        return nativeSubmit.call(this);
      };
      bridge.submissionResolved.connect(function (token, rawDecision) {
        let decision; try { decision = JSON.parse(rawDecision); } catch { decision = {allow:false,fields:[]}; }
        let found = null;
        for (const [form, item] of pending) {
          if (item.token === token) { found = [form,item]; break; }
        }
        if (!found) return;
        const [form,item] = found;
        pending.delete(form);
        if (!decision.allow) return;
        const approved = new Set(Array.isArray(decision.fields) ? decision.fields : []);
        const restore = [];
        for (const {el,id} of item.fields) {
          if (!approved.has(id)) {
            restore.push([el,el.disabled]);
            el.disabled = true;
          }
        }
        if (item.directSubmit) nativeSubmit.call(form);
        else {
          approvedForms.add(form);
          try { form.requestSubmit(item.submitter || undefined); }
          catch { nativeSubmit.call(form); }
        }
        window.setTimeout(() => restore.forEach(([el,wasDisabled]) => { if (el.isConnected) el.disabled = wasDisabled; }), 2500);
      });
    });
  };
  (document.head || document.documentElement).appendChild(src);
})();
"""


class PersonalDataConsentBridge(QObject):
    request_detected = Signal(object)
    submissionResolved = Signal(str, str)

    def __init__(self, page: QWebEnginePage, parent=None):
        super().__init__(parent)
        self.page = page

    @Slot(str)
    def requestPersonalData(self, raw: str) -> None:
        try:
            request = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            return
        if not isinstance(request, dict) or not isinstance(request.get("fields"), list):
            return
        page_url = self.page.url()
        if page_url.scheme().lower() not in {"http", "https"} or not page_url.host():
            return
        action = request.get("action") if isinstance(request.get("action"), dict) else {}
        action_host = str(action.get("host", "")).strip().lower()[:253]
        if not re.fullmatch(r"[a-z0-9.-]+", action_host or ""):
            action_host = page_url.host().lower()
        fields = []
        seen = set()
        for field in request["fields"][:MAX_REVIEW_FIELDS]:
            if not isinstance(field, dict):
                continue
            field_id = str(field.get("id", ""))[:80]
            category = str(field.get("category", ""))
            if not field_id or field_id in seen or category not in CATEGORIES:
                continue
            seen.add(field_id)
            fields.append({
                "id": field_id,
                "category": category,
                "label": str(field.get("label", CATEGORIES[category])).replace("\n", " ").strip()[:120] or CATEGORIES[category],
                "required": bool(field.get("required")),
                "filled": bool(field.get("filled")),
            })
        if not fields:
            return
        token = str(request.get("token", ""))[:100]
        if not token:
            return
        payload = {
            "token": token,
            "page_host": page_url.host().lower(),
            "page_scheme": page_url.scheme().lower(),
            "action_host": action_host,
            "action_scheme": str(action.get("scheme", page_url.scheme().lower())).lower()[:12],
            "fields": fields,
        }
        self.request_detected.emit(payload)


def install_personal_data_monitor(page: QWebEnginePage, callback) -> PersonalDataConsentBridge:
    bridge = PersonalDataConsentBridge(page, page)
    bridge.request_detected.connect(lambda request, source=page: callback(source, request))
    channel = QWebChannel(page)
    channel.registerObject("personalDataConsent", bridge)
    page.setWebChannel(channel, int(QWebEngineScript.ScriptWorldId.ApplicationWorld))
    script = QWebEngineScript()
    script.setName("GhostSurferPersonalDataConsent")
    script.setInjectionPoint(QWebEngineScript.InjectionPoint.DocumentCreation)
    script.setWorldId(QWebEngineScript.ScriptWorldId.ApplicationWorld)
    script.setRunsOnSubFrames(False)
    script.setSourceCode(FORM_MONITOR_SCRIPT)
    page.scripts().insert(script)
    return bridge


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


class SiteVerificationWorker(QThread):
    completed = Signal(object)

    def __init__(self, domain: str, cache_path: Path, parent=None):
        super().__init__(parent)
        self.domain = domain
        self.cache_path = cache_path

    @staticmethod
    def _read_cache(path: Path) -> dict:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    @staticmethod
    def _rdap_base(domain: str) -> str:
        global _BOOTSTRAP_CACHE
        with _BOOTSTRAP_LOCK:
            now = datetime.now(timezone.utc).timestamp()
            if _BOOTSTRAP_CACHE and now - _BOOTSTRAP_CACHE[0] < CHECK_INTERVAL_SECONDS:
                bootstrap = _BOOTSTRAP_CACHE[1]
            else:
                request = urllib.request.Request(BOOTSTRAP_URL, headers={"User-Agent": "GhostSurfer-SiteCheck/1.0"})
                with urllib.request.urlopen(request, timeout=3) as response:
                    final = urllib.parse.urlsplit(response.geturl())
                    if final.scheme != "https" or final.hostname != "data.iana.org":
                        raise ValueError("The RDAP directory redirected to an unexpected host.")
                    bootstrap = json.loads(response.read(2 * 1024 * 1024).decode("utf-8"))
                _BOOTSTRAP_CACHE = (now, bootstrap)
        tld = domain.rsplit(".", 1)[-1].casefold()
        for tlds, urls in bootstrap.get("services", []):
            if tld in {str(value).casefold() for value in tlds}:
                for base in urls:
                    parsed = urllib.parse.urlsplit(base)
                    if parsed.scheme == "https" and parsed.hostname:
                        return str(base).rstrip("/") + "/"
        raise ValueError("No authoritative RDAP server is listed for this domain suffix.")

    def _refresh(self, domain: str, previous: dict) -> dict:
        base = self._rdap_base(domain)
        parsed_base = urllib.parse.urlsplit(base)
        url = base + "domain/" + urllib.parse.quote(domain, safe=".")
        request = urllib.request.Request(url, headers={"Accept": "application/rdap+json, application/json", "User-Agent": "GhostSurfer-SiteCheck/1.0"})
        with urllib.request.urlopen(request, timeout=3) as response:
            final = urllib.parse.urlsplit(response.geturl())
            if final.scheme != "https" or final.hostname != parsed_base.hostname:
                raise ValueError("The RDAP response came from an unexpected host.")
            record = json.loads(response.read(1024 * 1024).decode("utf-8"))
        created = None
        changed = None
        for event in record.get("events", []):
            action = str(event.get("eventAction", "")).casefold()
            if action in {"registration", "registered"}:
                created = event.get("eventDate")
            elif action in {"last changed", "last update of rdap database"}:
                changed = event.get("eventDate")
        registrar = ""
        for entity in record.get("entities", []):
            if "registrar" in [str(role).casefold() for role in entity.get("roles", [])]:
                for item in entity.get("vcardArray", [None, []])[1]:
                    if len(item) >= 4 and item[0] == "fn":
                        registrar = str(item[3])[:100]
                        break
                if registrar:
                    break
        current = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "created": str(created or ""),
            "changed": str(changed or ""),
            "registrar": registrar,
            "statuses": [str(item)[:80] for item in record.get("status", [])[:20]],
            "source": parsed_base.hostname or "registry",
        }
        had_record = any(previous.get(key) for key in ("created", "registrar", "statuses"))
        current["changed_since_previous_check"] = bool(had_record and any(
            previous.get(key) != current.get(key) for key in ("created", "registrar", "statuses")
        ))
        return current

    def run(self) -> None:
        domain = registrable_domain(self.domain)
        if not domain:
            self.completed.emit({"domain": self.domain, "error": "No public registration domain is available."})
            return
        with _CACHE_LOCK:
            cache = self._read_cache(self.cache_path)
            previous = cache.get(domain, {}) if isinstance(cache.get(domain), dict) else {}
        checked = _parse_date(previous.get("last_attempt_at") or previous.get("checked_at"))
        now = datetime.now(timezone.utc)
        if checked and (now - checked).total_seconds() < CHECK_INTERVAL_SECONDS:
            result = dict(previous)
            result.update({"domain": domain, "cached": True})
            if previous.get("last_refresh_error"):
                result["refresh_error"] = previous["last_refresh_error"]
            self.completed.emit(result)
            return
        try:
            result = self._refresh(domain, previous)
            result.pop("last_refresh_error", None)
            result.update({"domain": domain, "cached": False})
        except Exception as exc:
            result = dict(previous)
            message = str(exc)[:240]
            result.update({"domain": domain, "cached": True, "refresh_error": message, "last_refresh_error": message, "last_attempt_at": now.isoformat()})
            if not result.get("checked_at"):
                result["checked_at"] = now.isoformat()
                result["error"] = str(exc)[:240]
        if "last_attempt_at" not in result:
            result["last_attempt_at"] = now.isoformat()
        with _CACHE_LOCK:
            cache = self._read_cache(self.cache_path)
            cache[domain] = {key: value for key, value in result.items() if key not in {"domain", "cached", "refresh_error"}}
            try:
                self.cache_path.parent.mkdir(parents=True, exist_ok=True)
                temporary = self.cache_path.with_suffix(".tmp")
                temporary.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
                temporary.replace(self.cache_path)
            except OSError:
                result["cache_error"] = True
        self.completed.emit(result)


class PersonalDataRequestDialog(QDialog):
    def __init__(self, request: dict, cache_path: Path, recognized: bool, verify_enabled: bool = True, parent=None):
        super().__init__(parent)
        self.request = request
        self.cache_path = cache_path
        self.allowed_field_ids: list[str] = []
        self.remember_recognition = False
        self.setWindowTitle("Review personal information request")
        self.setMinimumSize(590, 520)
        self.setModal(True)
        layout = QVBoxLayout(self)
        heading = QLabel("This page is submitting personal information")
        heading.setStyleSheet("font-size: 15pt; font-weight: 700; color: #f5bd58")
        layout.addWidget(heading)
        summary = QLabel(f"Page: https://{request['page_host']}\nData destination: {request['action_scheme']}://{request['action_host']}")
        summary.setTextFormat(Qt.TextFormat.PlainText)
        summary.setWordWrap(True)
        layout.addWidget(summary)
        self.trust_label = QLabel("Checking public domain registration information…")
        self.trust_label.setWordWrap(True)
        layout.addWidget(self.trust_label)
        instruction = QLabel("Select only the fields you want this submission to send. Nothing is selected by default. Unselected fields are excluded. 'Required by site' means the page marked it required; it does not prove the business needs it.")
        instruction.setWordWrap(True)
        layout.addWidget(instruction)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        panel = QWidget()
        field_layout = QVBoxLayout(panel)
        self.field_checks: dict[str, QCheckBox] = {}
        for index, field in enumerate(request["fields"], start=1):
            qualifier = "required by site" if field["required"] else "optional field"
            populated = " · currently contains a value" if field["filled"] else " · empty"
            text = f"{CATEGORIES[field['category']]} — {field['label']} ({qualifier}{populated})"
            check = QCheckBox(text)
            check.setChecked(False)
            self.field_checks[field["id"]] = check
            field_layout.addWidget(check)
        field_layout.addStretch(1)
        scroll.setWidget(panel)
        layout.addWidget(scroll, 1)
        self.recognize_check = QCheckBox("I recognize this business and domain; remember my recognition for 30 days")
        self.recognize_check.setChecked(False)
        layout.addWidget(self.recognize_check)
        if recognized:
            prior = QLabel("You previously marked this domain as recognized. That records your choice; it does not verify the company.")
            prior.setWordWrap(True)
            layout.addWidget(prior)
        else:
            prior = QLabel("This destination is not on your recognized-site list yet. You can still review every field and deny the submission.")
            prior.setWordWrap(True)
            layout.addWidget(prior)
        buttons = QHBoxLayout()
        required = QPushButton("Select site-required fields")
        required.clicked.connect(self.select_required)
        buttons.addWidget(required)
        buttons.addStretch(1)
        deny = QPushButton("Deny all and stop")
        deny.clicked.connect(self.reject)
        buttons.addWidget(deny)
        allow = QPushButton("Send selected fields")
        allow.setDefault(True)
        allow.setEnabled(not verify_enabled)
        self.allow_button = allow
        allow.clicked.connect(self.accept_selected)
        buttons.addWidget(allow)
        layout.addLayout(buttons)
        self.verifier = None
        if verify_enabled:
            self.verifier = SiteVerificationWorker(request["action_host"], cache_path, parent)
            self.verifier.completed.connect(self.show_verification)
            self.verifier.finished.connect(self.verifier.deleteLater)
            self.verifier.start()
        else:
            self.trust_label.setText("Periodic domain registration checks are turned off. HTTPS does not prove that this company or website is legitimate.")

    def select_required(self) -> None:
        for field in self.request["fields"]:
            self.field_checks[field["id"]].setChecked(bool(field["required"]))

    def accept_selected(self) -> None:
        selected = [field_id for field_id, check in self.field_checks.items() if check.isChecked()]
        if not selected:
            QMessageBox.information(self, "Select information to send", "Choose at least one field, or deny the submission.")
            return
        self.allowed_field_ids = selected
        self.remember_recognition = self.recognize_check.isChecked()
        self.accept()

    def show_verification(self, result: dict) -> None:
        domain = result.get("domain", self.request["action_host"])
        created = _parse_date(result.get("created"))
        warnings = []
        if self.request["action_scheme"] != "https":
            warnings.append("The data destination is not HTTPS. Ghost Surfer cannot protect this submission; deny it.")
        if self.request["action_host"] != self.request["page_host"]:
            warnings.append("The form sends data to a different domain than the page you are viewing.")
        if "xn--" in self.request["action_host"].casefold():
            warnings.append("The domain uses an internationalized/punycode label. Check the spelling carefully.")
        if created:
            age_days = max(0, (datetime.now(timezone.utc) - created).days)
            age_text = f"RDAP registration record: about {age_days} days old"
            if age_days < 60:
                warnings.append("The domain has a very recent registration record, which is a risk signal.")
            elif age_days < 180:
                warnings.append("The domain registration is less than six months old; use extra care.")
        else:
            age_text = "No domain registration date was available."
        statuses = result.get("statuses", [])
        if any("hold" in str(status).casefold() or "redemption" in str(status).casefold() for status in statuses):
            warnings.append("The registry reports an unusual domain status. Review before sending.")
        if result.get("changed_since_previous_check"):
            warnings.append("Registry registration details changed since Ghost Surfer's previous check; review the site identity.")
        if result.get("refresh_error"):
            warnings.append("The periodic registration check could not refresh; showing the last saved result.")
        if result.get("cache_error"):
            warnings.append("The latest check could not be saved for the next visit.")
        if result.get("error"):
            age_text = "Domain registration could not be verified right now."
            warnings.append("Ghost Surfer cannot confirm that this site is established.")
        elif not created:
            warnings.append("A registration record alone cannot establish who operates the company or whether the site is honest.")
        details = [f"Registration check for {domain}: {age_text}"]
        if result.get("registrar"):
            details.append(f"Registrar: {result['registrar']}")
        if result.get("checked_at"):
            details.append(f"Last refreshed: {result['checked_at'][:10]}" + (" (cached; refresh is periodic)" if result.get("cached") else ""))
        details.append("HTTPS certificates encrypt a connection; they do not prove a company is legitimate.")
        if warnings:
            details.append("\nWarnings: " + " ".join(warnings))
        else:
            details.append("No registration-age or domain-format warning was found. This is not a safety or company-identity certification.")
        self.trust_label.setText("\n".join(details))
        self.trust_label.setTextFormat(Qt.TextFormat.PlainText)
        self.allow_button.setEnabled(True)


class SiteRecognitionStore:
    def __init__(self, path: Path):
        self.path = path
        self.data: dict = {}
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                self.data = loaded
        except (OSError, json.JSONDecodeError):
            pass

    def recognized(self, host: str) -> bool:
        entry = self.data.get(registrable_domain(host), {})
        at = _parse_date(entry.get("recognized_at")) if isinstance(entry, dict) else None
        return bool(at and (datetime.now(timezone.utc) - at).total_seconds() < CHECK_INTERVAL_SECONDS)

    def remember(self, host: str) -> None:
        domain = registrable_domain(host)
        if not domain:
            return
        self.data[domain] = {"recognized_at": datetime.now(timezone.utc).isoformat()}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)
