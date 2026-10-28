"""Tab and session UX helpers for Ghost Surfer's BrowserWindow.

Integration::

    self.tab_features = TabFeatures(self)
    self.tab_features.attach()  # after creating self.tabs and initial tab

Call ``save_previous_session`` from BrowserWindow.closeEvent. Add its actions to
the command palette if desired. The controller also installs its own tab
context menu and Ctrl+Tab shortcuts when attached.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtCore import Qt, QTimer, QUrl
from PySide6.QtGui import QColor, QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QDialogButtonBox,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QMenu,
    QPushButton,
    QSplitter,
    QTabBar,
    QToolButton,
    QVBoxLayout,
)


SESSION_KEY = "ghost_surfer_tab_features"
RECENT_LIMIT = 30


class TabFeatures:
    """Installs tab and session behaviors onto a Ghost Surfer BrowserWindow."""

    GROUP_COLORS = ("#50b4e8", "#c084fc", "#4ade80", "#fb923c", "#f472b6", "#facc15")

    def __init__(self, window) -> None:
        self.window = window
        self.tabs = window.tabs
        self._observed: set[int] = set()
        self._split_dialogs: list[QDialog] = []
        self._original_close_tab = window.close_tab
        self._state = window.store.data.setdefault(SESSION_KEY, {})
        self._state.setdefault("previous_session", [])
        self._state.setdefault("named_sessions", {})
        self._state.setdefault("recently_closed", [])
        self._restore_prompt_shown = False
        self._attached = False
        self.checkpoint_timer = QTimer(self.window)
        self.checkpoint_timer.setSingleShot(True)
        self.checkpoint_timer.setInterval(900)
        self.checkpoint_timer.timeout.connect(self.save_session_checkpoint)

    def attach(self) -> None:
        """Connect tab events, add tab context actions, and install cycling keys."""
        if self._attached:
            return
        self._attached = True
        bar = self.tabs.tabBar()
        bar.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        bar.customContextMenuRequested.connect(self.show_tab_context_menu)
        bar.setMouseTracking(True)
        self.tabs.currentChanged.connect(self._current_changed)
        try:
            self.tabs.tabCloseRequested.disconnect(self._original_close_tab)
        except (RuntimeError, TypeError):
            pass
        self.tabs.tabCloseRequested.connect(self.close_tab)
        # Keep direct calls such as close_other_tabs subject to pin protection too.
        self.window.close_tab = self.close_tab
        self._current_changed(self.tabs.currentIndex())

        self.next_tab_shortcut = QShortcut(QKeySequence("Ctrl+Tab"), self.window)
        self.next_tab_shortcut.activated.connect(lambda: self.cycle_tabs(1))
        self.previous_tab_shortcut = QShortcut(QKeySequence("Ctrl+Shift+Tab"), self.window)
        self.previous_tab_shortcut.activated.connect(lambda: self.cycle_tabs(-1))

        # BrowserWindow creates tabs through add_tab; observing on currentChanged
        # covers selected tabs, while a short timer catches background tabs too.
        self.observe_timer = QTimer(self.window)
        self.observe_timer.setInterval(350)
        self.observe_timer.timeout.connect(self.observe_tabs)
        self.observe_timer.start()
        QTimer.singleShot(0, self.restore_previous_session)

    def observe_tabs(self) -> None:
        found_new_tab = False
        for index in range(self.tabs.count()):
            tab = self.tabs.widget(index)
            if tab is None or id(tab) in self._observed:
                continue
            found_new_tab = True
            self._observed.add(id(tab))
            tab.titleChanged.connect(lambda _title, t=tab: self.refresh_tab_presentation(t))
            tab.urlChanged.connect(lambda _url, t=tab: self.refresh_tab_presentation(t))
            page = tab.page()
            if hasattr(page, "audioMutedChanged"):
                page.audioMutedChanged.connect(lambda _muted, t=tab: self.refresh_tab_presentation(t))
            self.refresh_tab_presentation(tab)
            self._install_close_button(tab)
        if found_new_tab:
            self.schedule_session_checkpoint()

    def _install_close_button(self, tab) -> None:
        index = self.tabs.indexOf(tab)
        if index < 0:
            return
        button = QToolButton(self.tabs.tabBar())
        button.setText("×")
        button.setToolTip("Close tab")
        button.setAccessibleName("Close tab")
        button.setAutoRaise(True)
        button.setFixedSize(20, 20)
        button.clicked.connect(lambda _checked=False, t=tab: self.close_tab(self.tabs.indexOf(t)))
        self.tabs.tabBar().setTabButton(index, QTabBar.ButtonPosition.RightSide, button)
        self._set_close_button(tab)

    def _set_close_button(self, tab) -> None:
        index = self.tabs.indexOf(tab)
        if index < 0:
            return
        button = self.tabs.tabBar().tabButton(index, QTabBar.ButtonPosition.RightSide)
        if button is not None:
            button.setVisible(not bool(tab.property("ghost_pinned")))

    def _current_changed(self, _index: int) -> None:
        self.observe_tabs()
        self.window.update_session_ui()
        self.schedule_session_checkpoint()

    def schedule_session_checkpoint(self) -> None:
        if self._attached:
            self.checkpoint_timer.start()

    def save_session_checkpoint(self) -> None:
        self._state["previous_session"] = self.current_session()
        self._state["previous_session_active_index"] = max(0, self.tabs.currentIndex())
        self.window.queue_store_save()

    def _tab_label(self, tab) -> str:
        title = tab.title().strip() or tab.url().host() or "New tab"
        if bool(tab.property("ghost_pinned")):
            return "◆ " + title
        return title

    def refresh_tab_presentation(self, tab) -> None:
        index = self.tabs.indexOf(tab)
        if index < 0:
            return
        title = tab.title().strip() or "New tab"
        url = tab.url().toString()
        group = str(tab.property("ghost_group") or "")
        muted = bool(tab.page().isAudioMuted())
        frozen = bool(tab.property("ghost_frozen"))
        keep_active = bool(tab.property("ghost_keep_active"))
        prefix = ("◆ " if bool(tab.property("ghost_pinned")) else "") + ("❄ " if frozen else "")
        self.tabs.setTabText(index, prefix + ("◖ " if muted else "") + title)
        preview = [title, url]
        if group:
            preview.append(f"Group: {group}")
        if bool(tab.property("ghost_pinned")):
            preview.append("Pinned tab")
        if muted:
            preview.append("Audio muted")
        if frozen:
            preview.append("Paused by Speed Mode; select this tab to resume")
        if keep_active:
            preview.append("Exempt from Speed Mode tab freezing")
        self.tabs.setTabToolTip(index, "\n".join(part for part in preview if part))
        if group:
            self.tabs.tabBar().setTabTextColor(index, QColor(self._group_color(group)))
        else:
            self.tabs.tabBar().setTabTextColor(index, self.window.palette().color(self.window.foregroundRole()))
        self._set_close_button(tab)
        self.schedule_session_checkpoint()

    def _group_color(self, group: str) -> str:
        return self.GROUP_COLORS[sum(ord(char) for char in group.casefold()) % len(self.GROUP_COLORS)]

    def _entry_for_tab(self, tab) -> dict[str, Any]:
        return {
            "title": tab.title().strip(),
            "url": tab.url().toString(),
            "pinned": bool(tab.property("ghost_pinned")),
            "group": str(tab.property("ghost_group") or ""),
            "muted": bool(tab.page().isAudioMuted()),
            "keep_active": bool(tab.property("ghost_keep_active")),
        }

    def current_session(self) -> list[dict[str, Any]]:
        entries = []
        for index in range(self.tabs.count()):
            tab = self.tabs.widget(index)
            if tab is not None:
                entry = self._entry_for_tab(tab)
                if entry["url"]:
                    entries.append(entry)
        return entries

    def save_previous_session(self) -> None:
        """Persist current tabs; call from BrowserWindow.closeEvent before exit."""
        self.checkpoint_timer.stop()
        self._state["previous_session"] = self.current_session()
        self._state["previous_session_active_index"] = max(0, self.tabs.currentIndex())
        self.window.store.save()

    def restore_previous_session(self) -> None:
        """Restore the last saved session once; called automatically after attach."""
        if self._restore_prompt_shown:
            return
        self._restore_prompt_shown = True
        if self.window.settings_data.get("startup_page", "restore_session") != "restore_session":
            return
        entries = self._state.get("previous_session", [])
        if entries:
            if not getattr(self.window.store, "previous_session_was_clean", True):
                self._offer_crash_recovery(entries)
            else:
                self._replace_session(entries, self._state.get("previous_session_active_index", 0))

    def _offer_crash_recovery(self, entries: list[dict[str, Any]]) -> None:
        """Let users choose crash-session tabs; URLs carrying parameters start unchecked."""
        dialog = QDialog(self.window)
        dialog.setWindowTitle("Recover tabs from the previous session?")
        dialog.setMinimumWidth(460)
        layout = QVBoxLayout(dialog)
        intro = QLabel(
            "Ghost Surfer did not close cleanly last time. Choose which tabs to reopen. "
            "Pages with query or fragment data start unchecked because those parts of a URL can contain private tokens."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)
        unique: list[dict[str, Any]] = []
        seen: set[str] = set()
        for entry in entries:
            if not isinstance(entry, dict) or not entry.get("url"):
                continue
            url = QUrl(str(entry["url"]))
            key = url.toString()
            if key in seen:
                continue
            seen.add(key)
            unique.append(entry)
        checks: list[tuple[QCheckBox, dict[str, Any]]] = []
        for index, entry in enumerate(unique[:40], 1):
            url = QUrl(str(entry["url"]))
            origin = f"{url.scheme()}://{url.host()}" if url.host() else "local or blank page"
            sensitive = bool(url.query() or url.fragment())
            check = QCheckBox(f"Tab {index}: {origin}" + (" (URL contains private parameters)" if sensitive else ""))
            check.setChecked(not sensitive)
            checks.append((check, entry))
            layout.addWidget(check)
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.button(QDialogButtonBox.StandardButton.Ok).setText("Restore selected")
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        chosen = [entry for check, entry in checks if check.isChecked()]
        if chosen:
            self._replace_session(chosen, min(self._state.get("previous_session_active_index", 0), len(chosen) - 1))

    def _replace_session(self, entries: list[dict[str, Any]], active_index: int = 0) -> None:
        clean = [entry for entry in entries if isinstance(entry, dict) and entry.get("url")]
        if not clean:
            return
        while self.tabs.count():
            tab = self.tabs.widget(0)
            self.tabs.removeTab(0)
            if tab is not None:
                self._observed.discard(id(tab))
                tab.deleteLater()
        for entry in clean:
            tab = self.window.add_tab(entry.get("url", "about:blank"), switch=False)
            self._apply_tab_metadata(tab, entry)
        self.tabs.setCurrentIndex(max(0, min(int(active_index), self.tabs.count() - 1)))
        self.observe_tabs()
        self.window.update_session_ui()

    def restore_previous_session_now(self) -> None:
        self._replace_session(
            self._state.get("previous_session", []),
            self._state.get("previous_session_active_index", 0),
        )

    def _apply_tab_metadata(self, tab, entry: dict[str, Any]) -> None:
        tab.setProperty("ghost_pinned", bool(entry.get("pinned")))
        tab.setProperty("ghost_group", str(entry.get("group") or ""))
        tab.setProperty("ghost_keep_active", bool(entry.get("keep_active", False)))
        tab.page().setAudioMuted(bool(entry.get("muted", False)))
        self.refresh_tab_presentation(tab)

    def save_named_session(self, name: str | None = None) -> None:
        if name is None:
            name, accepted = QInputDialog.getText(self.window, "Save tab session", "Session name:")
            if not accepted:
                return
        name = (name or "").strip()
        if not name:
            QMessageBox.information(self.window, "Save tab session", "Enter a name for this session.")
            return
        sessions = self._state.setdefault("named_sessions", {})
        sessions[name] = self.current_session()
        self.window.store.save()
        self.window.status.showMessage(f"Saved tab session: {name}", 2600)

    def manage_sessions(self) -> None:
        dialog = QDialog(self.window)
        dialog.setWindowTitle("Saved tab sessions")
        dialog.resize(760, 560)
        layout = QVBoxLayout(dialog)
        layout.addWidget(QLabel("Preview a saved set, then replace, merge, or open only the checked tabs."))
        listing = QListWidget(dialog)
        names = sorted(self._state.setdefault("named_sessions", {}))
        listing.addItems(names)
        preview = QListWidget(dialog)
        preview.setSelectionMode(QListWidget.SelectionMode.NoSelection)
        body = QSplitter(Qt.Orientation.Horizontal, dialog)
        body.addWidget(listing)
        body.addWidget(preview)
        body.setSizes([220, 500])
        layout.addWidget(body, 1)
        row = QHBoxLayout()
        save_button = QPushButton("Save current…", dialog)
        replace_button = QPushButton("Replace current tabs", dialog)
        merge_button = QPushButton("Merge into current tabs", dialog)
        selected_button = QPushButton("Open checked tabs", dialog)
        delete_button = QPushButton("Delete", dialog)
        row.addWidget(save_button)
        row.addStretch(1)
        row.addWidget(replace_button)
        row.addWidget(merge_button)
        row.addWidget(selected_button)
        row.addWidget(delete_button)
        layout.addLayout(row)
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Close, parent=dialog)
        buttons.rejected.connect(dialog.reject)
        buttons.accepted.connect(dialog.accept)
        layout.addWidget(buttons)

        def refresh() -> None:
            selected = listing.currentItem().text() if listing.currentItem() else ""
            listing.clear()
            listing.addItems(sorted(self._state.setdefault("named_sessions", {})))
            if selected:
                found = listing.findItems(selected, Qt.MatchFlag.MatchExactly)
                if found:
                    listing.setCurrentItem(found[0])

        def save_current() -> None:
            name, accepted = QInputDialog.getText(dialog, "Save tab session", "Session name:")
            if accepted:
                self.save_named_session(name)
                refresh()
                found = listing.findItems(name.strip(), Qt.MatchFlag.MatchExactly)
                if found:
                    listing.setCurrentItem(found[0])

        def show_preview(_item=None, *_args) -> None:
            preview.clear()
            name = listing.currentItem().text() if listing.currentItem() else ""
            entries = self._state.setdefault("named_sessions", {}).get(name, [])
            for entry in entries:
                title = entry.get("title") or entry.get("url", "Saved tab")
                row_item = QListWidgetItem(f"{title}\n{entry.get('url', '')}")
                row_item.setFlags(row_item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
                row_item.setCheckState(Qt.CheckState.Checked)
                row_item.setData(Qt.ItemDataRole.UserRole, entry)
                preview.addItem(row_item)

        def selected_entries():
            return [preview.item(i).data(Qt.ItemDataRole.UserRole) for i in range(preview.count())
                    if preview.item(i).checkState() == Qt.CheckState.Checked]

        def replace_selected() -> None:
            item = listing.currentItem()
            if not item:
                return
            entries = self._state.setdefault("named_sessions", {}).get(item.text(), [])
            self._replace_session(entries)
            dialog.accept()

        def merge_all() -> None:
            item = listing.currentItem()
            if not item:
                return
            existing = {self._entry_for_tab(self.tabs.widget(i)).get("url") for i in range(self.tabs.count())}
            for entry in self._state.setdefault("named_sessions", {}).get(item.text(), []):
                if entry.get("url") not in existing:
                    tab = self.window.add_tab(entry.get("url", "about:blank"), False)
                    self._apply_tab_metadata(tab, entry)
            self.window.update_session_ui()
            dialog.accept()

        def open_checked() -> None:
            entries = selected_entries()
            if not entries:
                return
            for position, entry in enumerate(entries):
                tab = self.window.add_tab(entry.get("url", "about:blank"), position == len(entries) - 1)
                self._apply_tab_metadata(tab, entry)
            self.window.update_session_ui()
            dialog.accept()

        def delete_selected() -> None:
            item = listing.currentItem()
            if not item:
                return
            self._state.setdefault("named_sessions", {}).pop(item.text(), None)
            self.window.store.save()
            refresh()

        save_button.clicked.connect(save_current)
        replace_button.clicked.connect(replace_selected)
        merge_button.clicked.connect(merge_all)
        selected_button.clicked.connect(open_checked)
        delete_button.clicked.connect(delete_selected)
        listing.currentItemChanged.connect(show_preview)
        if listing.count():
            listing.setCurrentRow(0)
        dialog.exec()

    def show_bulk_tab_actions(self) -> None:
        dialog = QDialog(self.window)
        dialog.setWindowTitle("Select tabs for bulk actions")
        dialog.resize(620, 520)
        layout = QVBoxLayout(dialog)
        layout.addWidget(QLabel("Check tabs, then apply one action to the selection."))
        listing = QListWidget(dialog)
        for index in range(self.tabs.count()):
            tab = self.tabs.widget(index)
            label = tab.title().strip() or tab.url().toString() or f"Tab {index + 1}"
            item = QListWidgetItem(f"{index + 1}. {label}\n{tab.url().toString()}")
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(Qt.CheckState.Unchecked)
            item.setData(Qt.ItemDataRole.UserRole, index)
            listing.addItem(item)
        layout.addWidget(listing, 1)
        row = QHBoxLayout()
        for label in ("Pin checked", "Mute checked", "Group checked…", "Close checked"):
            row.addWidget(QPushButton(label, dialog))
        layout.addLayout(row)
        def chosen():
            return [listing.item(i).data(Qt.ItemDataRole.UserRole) for i in range(listing.count())
                    if listing.item(i).checkState() == Qt.CheckState.Checked]
        pin_button, mute_button, group_button, close_button = [row.itemAt(i).widget() for i in range(4)]
        pin_button.clicked.connect(lambda: [self.toggle_pin_current(self.tabs.widget(i)) for i in chosen() if self.tabs.widget(i)])
        mute_button.clicked.connect(lambda: [self.toggle_mute_current(self.tabs.widget(i)) for i in chosen() if self.tabs.widget(i)])
        def group_selected():
            name, accepted = QInputDialog.getText(dialog, "Group selected tabs", "Group name:")
            if accepted and name.strip():
                for index in chosen():
                    tab = self.tabs.widget(index)
                    if tab:
                        tab.setProperty("ghost_group", name.strip())
                        self.refresh_tab_presentation(tab)
        group_button.clicked.connect(group_selected)
        close_button.clicked.connect(lambda: [self.close_tab(index) for index in sorted(chosen(), reverse=True)])
        dialog.exec()

    def cycle_tabs(self, direction: int = 1) -> None:
        count = self.tabs.count()
        if count < 2:
            return
        self.tabs.setCurrentIndex((self.tabs.currentIndex() + direction) % count)

    def toggle_pin_current(self, tab=None) -> bool:
        tab = tab or self.window.current_tab()
        if tab is None:
            return False
        pinned = not bool(tab.property("ghost_pinned"))
        tab.setProperty("ghost_pinned", pinned)
        self.refresh_tab_presentation(tab)
        self.window.status.showMessage("Tab pinned" if pinned else "Tab unpinned", 1800)
        return pinned

    def set_tab_group(self, tab=None, name: str | None = None) -> None:
        tab = tab or self.window.current_tab()
        if tab is None:
            return
        current = str(tab.property("ghost_group") or "")
        if name is None:
            name, accepted = QInputDialog.getText(self.window, "Tab group", "Group name (blank removes group):", text=current)
            if not accepted:
                return
        tab.setProperty("ghost_group", (name or "").strip())
        self.refresh_tab_presentation(tab)
        self.window.status.showMessage(f"Tab group: {name.strip()}" if name.strip() else "Tab removed from group", 2200)

    def toggle_mute_current(self, tab=None) -> bool:
        tab = tab or self.window.current_tab()
        if tab is None:
            return False
        muted = not tab.page().isAudioMuted()
        tab.page().setAudioMuted(muted)
        self.refresh_tab_presentation(tab)
        self.window.status.showMessage("Tab audio muted" if muted else "Tab audio unmuted", 1800)
        return muted

    def close_tab(self, index: int) -> None:
        tab = self.tabs.widget(index)
        if tab is None:
            return
        if bool(tab.property("ghost_pinned")):
            self.window.status.showMessage("Unpin this tab before closing it", 2400)
            return
        entry = self._entry_for_tab(tab)
        if entry.get("url") and entry["url"].startswith(("http://", "https://")):
            recent = self._state.setdefault("recently_closed", [])
            recent.insert(0, entry)
            self._state["recently_closed"] = recent[:RECENT_LIMIT]
            self.window.store.save()
        self._observed.discard(id(tab))
        self._original_close_tab(index)
        self.schedule_session_checkpoint()

    def show_recently_closed(self) -> None:
        recent = self._state.setdefault("recently_closed", [])
        if not recent:
            self.window.status.showMessage("No recently closed tabs", 2200)
            return
        dialog = QDialog(self.window)
        dialog.setWindowTitle("Recently closed tabs")
        dialog.resize(600, 400)
        layout = QVBoxLayout(dialog)
        layout.addWidget(QLabel("Select a tab to reopen it."))
        listing = QListWidget(dialog)
        for entry in recent:
            title = entry.get("title") or entry.get("url", "Closed tab")
            item = QListWidgetItem(f"{title}\n{entry.get('url', '')}")
            item.setData(Qt.ItemDataRole.UserRole, entry)
            listing.addItem(item)
        layout.addWidget(listing, 1)
        row = QHBoxLayout()
        restore_button = QPushButton("Reopen selected", dialog)
        close_button = QPushButton("Close", dialog)
        row.addStretch(1)
        row.addWidget(restore_button)
        row.addWidget(close_button)
        layout.addLayout(row)

        def restore() -> None:
            item = listing.currentItem()
            if item is None:
                return
            entry = item.data(Qt.ItemDataRole.UserRole)
            tab = self.window.add_tab(entry.get("url", "about:blank"), True)
            self._apply_tab_metadata(tab, entry)
            try:
                recent.remove(entry)
            except ValueError:
                pass
            self.window.store.save()
            dialog.accept()

        restore_button.clicked.connect(restore)
        close_button.clicked.connect(dialog.reject)
        listing.itemDoubleClicked.connect(lambda _item: restore())
        listing.setCurrentRow(0)
        dialog.exec()

    def show_split_view(self, first_tab=None, second_tab=None) -> None:
        """Open a selectable two-page workspace with swap and promote actions."""
        sources = [self.tabs.widget(i) for i in range(self.tabs.count())]
        sources = [tab for tab in sources if tab is not None]
        if not sources:
            return
        labels = [tab.title().strip() or tab.url().toString() or "New tab" for tab in sources]
        first_index = self.tabs.indexOf(first_tab or self.window.current_tab())
        if first_index < 0:
            first_index = 0
        second_index = self.tabs.indexOf(second_tab) if second_tab is not None else (first_index + 1) % len(sources)
        dialog = QDialog(self.window, Qt.WindowType.Window)
        dialog.setWindowTitle("Ghost Surfer — Split workspace")
        dialog.resize(1180, 780)
        layout = QVBoxLayout(dialog)
        pickers = QHBoxLayout()
        left_pick = QComboBox(dialog)
        right_pick = QComboBox(dialog)
        left_pick.addItems(labels)
        right_pick.addItems(labels)
        left_pick.setCurrentIndex(max(0, min(first_index, len(sources) - 1)))
        right_pick.setCurrentIndex(max(0, min(second_index, len(sources) - 1)))
        swap = QPushButton("Swap sides", dialog)
        pickers.addWidget(QLabel("Left page")); pickers.addWidget(left_pick, 1)
        pickers.addWidget(QLabel("Right page")); pickers.addWidget(right_pick, 1)
        pickers.addWidget(swap)
        layout.addLayout(pickers)
        splitter = QSplitter(Qt.Orientation.Horizontal, dialog)
        clones = [type(sources[0])(self.window), type(sources[0])(self.window)]
        for clone in clones:
            splitter.addWidget(clone)
        layout.addWidget(splitter, 1)
        def load_side(side: int, source_index: int) -> None:
            source = sources[source_index]
            clones[side].setZoomFactor(source.zoomFactor())
            clones[side].page().setAudioMuted(source.page().isAudioMuted())
            clones[side].setUrl(QUrl(source.url()))
        left_pick.currentIndexChanged.connect(lambda index: load_side(0, index))
        right_pick.currentIndexChanged.connect(lambda index: load_side(1, index))
        load_side(0, left_pick.currentIndex())
        load_side(1, right_pick.currentIndex())
        def swap_sides() -> None:
            left, right = left_pick.currentIndex(), right_pick.currentIndex()
            left_pick.setCurrentIndex(right)
            right_pick.setCurrentIndex(left)
        swap.clicked.connect(swap_sides)
        controls = QHBoxLayout()
        for side, label in ((0, "Add left page as tab"), (1, "Add right page as tab")):
            promote = QPushButton(label, dialog)
            promote.clicked.connect(lambda _checked=False, pane=side: self.window.add_tab(clones[pane].url().toString(), True))
            controls.addWidget(promote)
        controls.addStretch(1)
        close_button = QPushButton("Close workspace", dialog)
        close_button.clicked.connect(dialog.accept)
        controls.addWidget(close_button)
        layout.addLayout(controls)
        self._split_dialogs.append(dialog)
        dialog.finished.connect(lambda _result, d=dialog: self._split_dialogs.remove(d) if d in self._split_dialogs else None)
        dialog.finished.connect(lambda _result, views=clones: [view.deleteLater() for view in views])
        dialog.show()

    def show_tab_context_menu(self, position) -> None:
        index = self.tabs.tabBar().tabAt(position)
        tab = self.tabs.widget(index) if index >= 0 else None
        menu = QMenu(self.window)
        menu.addAction("New tab", lambda: self.window.add_tab("https://www.startpage.com/", True))
        menu.addAction("Duplicate tab", lambda: self.window.add_tab(tab.url().toString(), True) if tab else None).setEnabled(tab is not None)
        menu.addSeparator()
        if tab:
            menu.addAction("Unpin tab" if tab.property("ghost_pinned") else "Pin tab", lambda t=tab: self.toggle_pin_current(t))
            menu.addAction("Set tab group…", lambda t=tab: self.set_tab_group(t))
            menu.addAction("Mute tab" if not tab.page().isAudioMuted() else "Unmute tab", lambda t=tab: self.toggle_mute_current(t))
            keep_action = menu.addAction("Keep active in Speed Mode")
            keep_action.setCheckable(True)
            keep_action.setChecked(bool(tab.property("ghost_keep_active")))
            keep_action.toggled.connect(lambda _checked, t=tab: self.window.toggle_tab_keep_active(t))
            menu.addAction("Split view with next tab", lambda t=tab: self.show_split_view(t))
            menu.addSeparator()
            menu.addAction("Close tab", lambda i=index: self.close_tab(i))
            menu.addAction("Close other tabs", self.window.close_other_tabs)
        menu.addSeparator()
        menu.addAction("Recently closed tabs…", self.show_recently_closed)
        menu.addAction("Save tab session…", self.save_named_session)
        menu.addAction("Manage saved sessions…", self.manage_sessions)
        menu.addAction("Restore previous session", self.restore_previous_session_now).setEnabled(bool(self._state.get("previous_session")))
        menu.exec(self.tabs.tabBar().mapToGlobal(position))
