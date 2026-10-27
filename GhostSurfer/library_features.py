"""Bookmarks, history, and local navigation preferences for Ghost Surfer.

Integration API::

    self.library_features = LibraryFeatures(self)
    self.library_features.install()

Call ``install`` after ``build_shell`` and ``build_control_center`` but before
the first ``add_tab`` call. The controller uses the window's existing store,
address field, lists, navigation methods, and control center.
"""

from datetime import datetime
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote_plus

from PySide6.QtCore import QModelIndex, Qt
from PySide6.QtGui import QAction, QStandardItem, QStandardItemModel
from PySide6.QtWidgets import (
    QCompleter,
    QComboBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QMenu,
    QToolBar,
    QToolButton,
    QVBoxLayout,
)


URL_ROLE = int(Qt.ItemDataRole.UserRole) + 1
KIND_ROLE = int(Qt.ItemDataRole.UserRole) + 2
DAY_ROLE = int(Qt.ItemDataRole.UserRole) + 3

SEARCH_ENGINES = {
    "Startpage": "https://www.startpage.com/sp/search?query={query}",
    "DuckDuckGo": "https://duckduckgo.com/?q={query}",
    "Brave Search": "https://search.brave.com/search?q={query}",
    "Bing": "https://www.bing.com/search?q={query}",
}


def _setting(window, key: str, default=None):
    return window.store.data.setdefault("settings", {}).get(key, default)


class _AddressCompleter(QCompleter):
    """Display titles and URLs while inserting only the URL into the address bar."""

    def pathFromIndex(self, index):  # noqa: N802 - Qt virtual method name
        url = index.data(URL_ROLE)
        return str(url or index.data(Qt.ItemDataRole.DisplayRole) or "")


class _NetscapeBookmarkParser(HTMLParser):
    """Read Netscape bookmark HTML, including simple nested folders."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
        self.folders = []
        self.pending_folder = None
        self.in_folder_title = False
        self.current_link = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == "h3":
            self.in_folder_title = True
            self.pending_folder = ""
        elif tag.lower() == "dl":
            if self.pending_folder is not None:
                self.folders.append(self.pending_folder)
                self.pending_folder = None
        elif tag.lower() == "a" and attrs.get("href"):
            self.current_link = {"url": attrs["href"], "title": ""}

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "h3":
            self.in_folder_title = False
        elif tag == "dl" and self.folders:
            self.folders.pop()
        elif tag == "a" and self.current_link is not None:
            link = self.current_link
            link["title"] = link["title"].strip() or link["url"]
            link["folder"] = self.folders[-1] if self.folders else ""
            self.items.append(link)
            self.current_link = None

    def handle_data(self, data):
        if self.in_folder_title and self.pending_folder is not None:
            self.pending_folder += data.strip()
        if self.current_link is not None:
            self.current_link["title"] += data


class LibraryFeatures:
    """Install the bookmark/history tools and navigation preferences."""

    def __init__(self, window):
        self.window = window
        self.store = window.store
        self.settings = self.store.data.setdefault("settings", {})
        self._installed = False
        self._first_tab_pending = False
        self._attached_tabs = set()
        self._original_refresh = None
        self._original_normalize = None
        self._original_go_home = None
        self._original_add_tab = None
        self.completion_model = QStandardItemModel(window)

    def install(self) -> None:
        if self._installed:
            return
        self._installed = True
        self.settings.setdefault("search_engine", "Startpage")
        self.settings.setdefault("home_page_url", "https://duckduckgo.com/")
        self.settings.setdefault("startup_page", "restore_session")
        self._normalize_saved_records()
        self._install_autocomplete()
        self._install_navigation_preferences()
        self._install_history_capture()
        self._install_control_center()
        self._install_bookmark_toolbar()
        self._wrap_refresh_lists()
        self.refresh_views()
        self.store.save()

    def _normalize_saved_records(self) -> None:
        for item in self.store.data.setdefault("bookmarks", []):
            item.setdefault("title", item.get("url", "Bookmark"))
            item.setdefault("folder", "")
        for item in self.store.data.setdefault("history", []):
            item.setdefault("title", item.get("url", "History"))
            item.setdefault("visited_at", "")

    def _install_autocomplete(self) -> None:
        address = self.window.address
        completer = _AddressCompleter(self.completion_model, address)
        completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        completer.setFilterMode(Qt.MatchFlag.MatchContains)
        completer.setCompletionRole(Qt.ItemDataRole.DisplayRole)
        completer.setCompletionColumn(0)
        completer.setMaxVisibleItems(12)
        address.setCompleter(completer)
        address.textEdited.connect(self._show_completions)
        completer.activated[QModelIndex].connect(self._open_completion_index)
        self.completer = completer

    def _show_completions(self, text: str) -> None:
        if text.strip() and self.completion_model.rowCount() and self.window.address.hasFocus():
            self.completer.setCompletionPrefix(text.strip())
            self.completer.complete()

    def _open_completion(self, text: str) -> None:
        value = str(text or "").strip()
        if not value:
            return
        self.window.address.setText(value)
        self.window.navigate_from_address()

    def _open_completion_index(self, index: QModelIndex) -> None:
        self._open_completion(str(index.data(URL_ROLE) or index.data(Qt.ItemDataRole.DisplayRole) or ""))

    def _install_navigation_preferences(self) -> None:
        self._original_normalize = self.window.normalized_url

        def normalize(text):
            value = (text or "").strip()
            if value.lower() == "about:blank":
                return "about:blank"
            if value.startswith(("http://", "https://", "file://")):
                return self._original_normalize(value)
            if "." in value and " " not in value:
                return self._original_normalize(value)
            engine = _setting(self.window, "search_engine", "Startpage")
            template = SEARCH_ENGINES.get(engine, SEARCH_ENGINES["Startpage"])
            return template.format(query=quote_plus(value))

        self.window.normalized_url = normalize
        self._original_go_home = self.window.go_home

        def go_home():
            tab = self.window.current_tab()
            if tab:
                self.window.navigate(tab, self._home_url())

        self.window.go_home = go_home
        self._original_add_tab = self.window.add_tab
        self._first_tab_pending = self.window.tabs.count() == 0

        def add_tab(url, switch=True):
            if self._first_tab_pending:
                self._first_tab_pending = False
                url = self._startup_url()
            tab = self._original_add_tab(url, switch)
            self._attach_history_capture(tab)
            return tab

        self.window.add_tab = add_tab

    def _home_url(self) -> str:
        raw = str(_setting(self.window, "home_page_url", "https://duckduckgo.com/") or "").strip()
        if not raw:
            return "https://duckduckgo.com/"
        if raw.startswith(("http://", "https://")):
            return raw
        if "." in raw and " " not in raw:
            return "https://" + raw
        return self._original_normalize(raw) if self._original_normalize else raw

    def _startup_url(self) -> str:
        mode = _setting(self.window, "startup_page", "start_page")
        if mode == "home_page":
            return self._home_url()
        if mode == "blank":
            return "about:blank"
        return "ghostsurfer://dashboard"

    def _install_history_capture(self) -> None:
        self.window.tabs.currentChanged.connect(self._attach_current_tab)
        for index in range(self.window.tabs.count()):
            self._attach_history_capture(self.window.tabs.widget(index))

    def _attach_current_tab(self, _index: int) -> None:
        self._attach_history_capture(self.window.current_tab())

    def _attach_history_capture(self, tab) -> None:
        if tab is None or id(tab) in self._attached_tabs:
            return
        self._attached_tabs.add(id(tab))
        tab.loadFinished.connect(lambda _ok, source=tab: self._stamp_history(source))

    def _stamp_history(self, tab) -> None:
        url = self.window.display_url(tab.url())
        if not url.startswith(("http://", "https://")):
            return
        entry = next((row for row in self.store.data.get("history", []) if row.get("url") == url), None)
        if entry is None:
            return
        if not entry.get("visited_at"):
            entry["visited_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
            self.store.save()
            self.refresh_history()

    def _install_control_center(self) -> None:
        page_layouts = getattr(self.window, "control_page_layouts", {})
        general_root = page_layouts.get("General")
        workspace_root = page_layouts.get("Tabs & Data")
        if general_root is None or workspace_root is None:
            return

        navigation = QGroupBox("Search & Startup")
        form = QVBoxLayout(navigation)
        self.engine_combo = QComboBox()
        self.engine_combo.addItems(SEARCH_ENGINES.keys())
        engine = _setting(self.window, "search_engine", "Startpage")
        self.engine_combo.setCurrentText(engine if engine in SEARCH_ENGINES else "Startpage")
        form.addWidget(QLabel("Search engine for address-bar queries"))
        form.addWidget(self.engine_combo)
        self.home_edit = QLineEdit(str(_setting(self.window, "home_page_url", "https://duckduckgo.com/")))
        self.home_edit.setPlaceholderText("https://example.com/")
        form.addWidget(QLabel("Home page"))
        form.addWidget(self.home_edit)
        self.startup_combo = QComboBox()
        self.startup_combo.addItem("Ghost Surfer start page", "start_page")
        self.startup_combo.addItem("Open home page", "home_page")
        self.startup_combo.addItem("Open blank page", "blank")
        self.startup_combo.addItem("Restore previous session", "restore_session")
        startup = _setting(self.window, "startup_page", "restore_session")
        startup_index = self.startup_combo.findData(startup)
        self.startup_combo.setCurrentIndex(max(0, startup_index))
        form.addWidget(QLabel("On launch"))
        form.addWidget(self.startup_combo)
        save_preferences = QPushButton("Save navigation preferences")
        save_preferences.setObjectName("panelButton")
        save_preferences.clicked.connect(self.save_navigation_preferences)
        form.addWidget(save_preferences)
        general_root.insertWidget(0, navigation)

        self._install_library_controls(workspace_root)

    def save_navigation_preferences(self) -> None:
        engine = self.engine_combo.currentText()
        if engine not in SEARCH_ENGINES:
            engine = "Startpage"
        raw_home = self.home_edit.text().strip()
        if not raw_home:
            QMessageBox.warning(self.window, "Home page required", "Enter a website address for the home page.")
            return
        home = raw_home if raw_home.startswith(("http://", "https://")) else ("https://" + raw_home if "." in raw_home and " " not in raw_home else "")
        if not home:
            QMessageBox.warning(self.window, "Enter a website address", "Use a full website address, such as https://example.com/.")
            return
        self.settings["search_engine"] = engine
        self.settings["home_page_url"] = home
        self.settings["startup_page"] = self.startup_combo.currentData()
        self.store.save()
        self.window.status.showMessage("Search and startup preferences saved", 3500)

    def _install_library_controls(self, root) -> None:
        controls = QGroupBox("Library Tools")
        row = QVBoxLayout(controls)
        row.setSpacing(8)
        for label, callback in (
            ("Manage bookmarks", self.show_bookmark_manager),
            ("Import HTML", self.import_bookmarks),
            ("Export HTML", self.export_bookmarks),
        ):
            button = QPushButton(label)
            button.setObjectName("panelButton")
            button.clicked.connect(callback)
            row.addWidget(button)
        root.insertWidget(1, controls)

        self.bookmark_search = QLineEdit()
        self.bookmark_search.setPlaceholderText("Filter bookmarks…")
        self.bookmark_search.textChanged.connect(lambda _text: self.refresh_bookmarks())
        self._insert_search_before(self.window.bookmark_list, self.bookmark_search)
        manage_button = QPushButton("Manage / organize bookmarks")
        manage_button.setObjectName("panelButton")
        manage_button.clicked.connect(self.show_bookmark_manager)
        self._insert_after(self.window.bookmark_list, manage_button)

        self.history_search = QLineEdit()
        self.history_search.setPlaceholderText("Search history…")
        self.history_search.textChanged.connect(lambda _text: self.refresh_history())
        self._insert_search_before(self.window.history_list, self.history_search)
        self.window.history_list.setSelectionMode(QListWidget.SelectionMode.ExtendedSelection)
        remove_history = QPushButton("Remove selected history entries")
        remove_history.setObjectName("panelButton")
        remove_history.clicked.connect(self.remove_selected_history)
        self._insert_after(self.window.history_list, remove_history)

    @staticmethod
    def _insert_search_before(list_widget, widget) -> None:
        group = list_widget.parentWidget()
        layout = group.layout() if group is not None else None
        if layout is not None:
            layout.insertWidget(0, widget)

    @staticmethod
    def _insert_after(list_widget, widget) -> None:
        group = list_widget.parentWidget()
        layout = group.layout() if group is not None else None
        if layout is not None:
            index = layout.indexOf(list_widget)
            layout.insertWidget(index + 1 if index >= 0 else layout.count(), widget)

    def _install_bookmark_toolbar(self) -> None:
        self.bookmarks_toolbar = QToolBar("Bookmarks", self.window)
        self.bookmarks_toolbar.setObjectName("bookmarksToolbar")
        self.bookmarks_toolbar.setMovable(False)
        self.bookmarks_toolbar.setFloatable(False)
        self.window.addToolBar(Qt.ToolBarArea.TopToolBarArea, self.bookmarks_toolbar)
        self.refresh_bookmark_toolbar()

    def _wrap_refresh_lists(self) -> None:
        self._original_refresh = self.window.refresh_lists

        def refresh_lists(*args, **kwargs):
            result = self._original_refresh(*args, **kwargs)
            self.refresh_views()
            return result

        self.window.refresh_lists = refresh_lists

    def refresh_views(self) -> None:
        self.refresh_bookmarks()
        self.refresh_history()
        self.refresh_bookmark_toolbar()
        self.refresh_autocomplete()

    def refresh_bookmarks(self) -> None:
        listing = getattr(self.window, "bookmark_list", None)
        if listing is None:
            return
        needle = self.bookmark_search.text().strip().casefold() if hasattr(self, "bookmark_search") else ""
        listing.clear()
        for row in self.store.data.get("bookmarks", []):
            title = row.get("title") or row.get("url", "Bookmark")
            folder = row.get("folder", "")
            label = f"{folder}  /  {title}" if folder else title
            if needle and needle not in f"{label} {row.get('url', '')}".casefold():
                continue
            item = QListWidgetItem(label)
            item.setData(Qt.ItemDataRole.UserRole, row.get("url", ""))
            item.setData(KIND_ROLE, "bookmark")
            item.setToolTip(row.get("url", ""))
            listing.addItem(item)
        self.refresh_bookmark_toolbar()
        self.refresh_autocomplete()

    def refresh_history(self) -> None:
        listing = getattr(self.window, "history_list", None)
        if listing is None:
            return
        needle = self.history_search.text().strip().casefold() if hasattr(self, "history_search") else ""
        rows = self.store.data.get("history", [])
        groups = {}
        for row in rows:
            visited = row.get("visited_at", "")
            try:
                day = datetime.fromisoformat(visited).astimezone().strftime("%A, %B %d, %Y") if visited else "Earlier history"
            except (TypeError, ValueError):
                day = "Earlier history"
            groups.setdefault(day, []).append(row)

        listing.clear()
        for day, day_rows in groups.items():
            visible = [
                row for row in day_rows
                if not needle or needle in f"{row.get('title', '')} {row.get('url', '')}".casefold()
            ]
            if not visible:
                continue
            heading = QListWidgetItem(day)
            heading.setData(KIND_ROLE, "day")
            heading.setFlags(Qt.ItemFlag.NoItemFlags)
            heading.setData(DAY_ROLE, day)
            listing.addItem(heading)
            for row in visible:
                item = QListWidgetItem(row.get("title") or row.get("url", "History"))
                item.setData(Qt.ItemDataRole.UserRole, row.get("url", ""))
                item.setData(KIND_ROLE, "history")
                item.setData(DAY_ROLE, day)
                item.setToolTip(row.get("url", ""))
                listing.addItem(item)

    def refresh_bookmark_toolbar(self) -> None:
        toolbar = getattr(self, "bookmarks_toolbar", None)
        if toolbar is None:
            return
        toolbar.clear()
        bookmarks = self.store.data.get("bookmarks", [])
        folders = {}
        for row in bookmarks:
            folder = str(row.get("folder", "") or "").strip()
            if folder:
                folders.setdefault(folder, []).append(row)
            else:
                action = QAction(row.get("title") or row.get("url", "Bookmark"), toolbar)
                action.setToolTip(row.get("url", ""))
                action.triggered.connect(lambda _checked=False, url=row.get("url", ""): self._open_url(url))
                toolbar.addAction(action)
        for folder, rows in sorted(folders.items(), key=lambda pair: pair[0].casefold()):
            menu = QMenu(folder, self.window)
            folder_button = QToolButton(toolbar)
            folder_button.setText(folder)
            folder_button.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextOnly)
            folder_button.setMenu(menu)
            folder_button.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
            toolbar.addWidget(folder_button)
            for row in rows:
                child = menu.addAction(row.get("title") or row.get("url", "Bookmark"))
                child.setToolTip(row.get("url", ""))
                child.triggered.connect(lambda _checked=False, url=row.get("url", ""): self._open_url(url))
        toolbar.setVisible(bool(bookmarks))

    def refresh_autocomplete(self) -> None:
        if not hasattr(self, "completion_model"):
            return
        self.completion_model.clear()
        seen = set()
        for kind, rows in (("Bookmark", self.store.data.get("bookmarks", [])), ("Recent", self.store.data.get("history", []))):
            for row in rows:
                url = row.get("url", "")
                if not url or url in seen:
                    continue
                seen.add(url)
                title = row.get("title") or url
                item = QStandardItem(f"{title}  ·  {url}  ({kind})")
                item.setData(url, URL_ROLE)
                self.completion_model.appendRow(item)

    def _open_url(self, url: str) -> None:
        tab = self.window.current_tab()
        if tab:
            self.window.navigate(tab, url)

    def show_bookmark_manager(self) -> None:
        from PySide6.QtWidgets import QDialog

        dialog = QDialog(self.window)
        dialog.setWindowTitle("Manage bookmarks")
        dialog.resize(720, 500)
        outer = QHBoxLayout(dialog)
        left = QVBoxLayout()
        right = QVBoxLayout()
        outer.addLayout(left, 1)
        outer.addLayout(right, 2)
        search = QLineEdit()
        search.setPlaceholderText("Search bookmarks by title, folder, or URL")
        left.addWidget(search)
        listing = QListWidget()
        left.addWidget(listing, 1)
        title_edit = QLineEdit()
        folder_combo = QComboBox()
        folder_combo.setEditable(True)
        url_edit = QLineEdit()
        url_edit.setReadOnly(True)
        right.addWidget(QLabel("Title"))
        right.addWidget(title_edit)
        right.addWidget(QLabel("Folder (leave blank for the toolbar)"))
        right.addWidget(folder_combo)
        right.addWidget(QLabel("Address"))
        right.addWidget(url_edit)
        right.addStretch(1)
        buttons = QHBoxLayout()
        save_button = QPushButton("Save changes")
        new_folder_button = QPushButton("New folder")
        delete_button = QPushButton("Delete bookmark")
        close_button = QPushButton("Done")
        for button in (save_button, new_folder_button, delete_button, close_button):
            buttons.addWidget(button)
        right.addLayout(buttons)

        selected_url = {"value": ""}

        def folders():
            return sorted({str(row.get("folder", "")).strip() for row in self.store.data.get("bookmarks", []) if row.get("folder")}, key=str.casefold)

        def fill_folders(current=""):
            folder_combo.clear()
            folder_combo.addItems(folders())
            folder_combo.setCurrentText(current)

        def populate(_query=""):
            needle = search.text().strip().casefold()
            listing.clear()
            for row in self.store.data.get("bookmarks", []):
                title = row.get("title") or row.get("url", "Bookmark")
                folder = row.get("folder", "")
                label = f"{folder}  /  {title}" if folder else title
                if needle and needle not in f"{label} {row.get('url', '')}".casefold():
                    continue
                item = QListWidgetItem(label)
                item.setData(Qt.ItemDataRole.UserRole, row.get("url", ""))
                listing.addItem(item)

        def select_item(item):
            url = item.data(Qt.ItemDataRole.UserRole) if item else ""
            row = next((entry for entry in self.store.data.get("bookmarks", []) if entry.get("url") == url), None)
            selected_url["value"] = url if row else ""
            title_edit.setText(row.get("title", "") if row else "")
            url_edit.setText(url or "")
            fill_folders(row.get("folder", "") if row else "")
            enabled = row is not None
            title_edit.setEnabled(enabled)
            folder_combo.setEnabled(enabled)
            save_button.setEnabled(enabled)
            delete_button.setEnabled(enabled)

        def save_selected():
            row = next((entry for entry in self.store.data.get("bookmarks", []) if entry.get("url") == selected_url["value"]), None)
            if not row:
                return
            title = title_edit.text().strip()
            if not title:
                QMessageBox.warning(dialog, "Title required", "Enter a title for this bookmark.")
                return
            row["title"] = title
            row["folder"] = folder_combo.currentText().strip()
            self.store.save()
            populate()
            self.refresh_views()
            self.window.status.showMessage("Bookmark updated", 2500)

        def delete_selected():
            url = selected_url["value"]
            if not url:
                return
            answer = QMessageBox.question(dialog, "Delete bookmark?", "Remove this bookmark?", QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes, QMessageBox.StandardButton.Cancel)
            if answer != QMessageBox.StandardButton.Yes:
                return
            self.store.data["bookmarks"] = [row for row in self.store.data.get("bookmarks", []) if row.get("url") != url]
            self.store.save()
            selected_url["value"] = ""
            title_edit.clear()
            folder_combo.setCurrentText("")
            url_edit.clear()
            populate()
            self.refresh_views()

        def new_folder():
            name, accepted = QInputDialog.getText(dialog, "New bookmark folder", "Folder name:")
            name = name.strip()
            if accepted and name:
                fill_folders(name)
                folder_combo.setFocus()

        search.textChanged.connect(populate)
        listing.currentItemChanged.connect(lambda item, _previous: select_item(item))
        listing.itemDoubleClicked.connect(lambda item: self._open_url(item.data(Qt.ItemDataRole.UserRole)))
        save_button.clicked.connect(save_selected)
        delete_button.clicked.connect(delete_selected)
        new_folder_button.clicked.connect(new_folder)
        close_button.clicked.connect(dialog.accept)
        fill_folders()
        populate()
        select_item(listing.item(0))
        dialog.exec()

    def import_bookmarks(self) -> None:
        path, _filter = QFileDialog.getOpenFileName(self.window, "Import bookmarks", str(Path.home()), "Bookmark HTML (*.html *.htm);;All files (*.*)")
        if not path:
            return
        try:
            parser = _NetscapeBookmarkParser()
            parser.feed(Path(path).read_text(encoding="utf-8", errors="replace"))
        except OSError as exc:
            QMessageBox.warning(self.window, "Import failed", str(exc))
            return
        bookmarks = self.store.data.setdefault("bookmarks", [])
        known = {item.get("url") for item in bookmarks}
        imported = 0
        for item in parser.items:
            url = item.get("url", "").strip()
            if not url.startswith(("http://", "https://")) or url in known:
                continue
            bookmarks.append({"title": item.get("title") or url, "url": url, "folder": item.get("folder", "")})
            known.add(url)
            imported += 1
        self.store.save()
        self.refresh_views()
        self.window.status.showMessage(f"Imported {imported} bookmark{'s' if imported != 1 else ''}", 4500)

    def export_bookmarks(self) -> None:
        path, _filter = QFileDialog.getSaveFileName(self.window, "Export bookmarks", str(Path.home() / "Ghost Surfer Bookmarks.html"), "Bookmark HTML (*.html)")
        if not path:
            return
        if not path.lower().endswith((".html", ".htm")):
            path += ".html"
        grouped = {}
        for item in self.store.data.get("bookmarks", []):
            grouped.setdefault(str(item.get("folder", "") or ""), []).append(item)
        lines = [
            "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
            '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
            "<TITLE>Ghost Surfer Bookmarks</TITLE>",
            "<H1>Ghost Surfer Bookmarks</H1>",
            "<DL><p>",
        ]
        for folder, rows in grouped.items():
            if folder:
                lines.extend([f"  <DT><H3>{escape(folder)}</H3>", "  <DL><p>"])
            indent = "    " if folder else "  "
            for item in rows:
                lines.append(f'{indent}<DT><A HREF="{escape(item.get("url", ""), quote=True)}">{escape(item.get("title") or item.get("url", ""))}</A>')
            if folder:
                lines.append("  </DL><p>")
        lines.append("</DL><p>")
        try:
            Path(path).write_text("\n".join(lines), encoding="utf-8")
        except OSError as exc:
            QMessageBox.warning(self.window, "Export failed", str(exc))
            return
        self.window.status.showMessage(f"Exported {len(self.store.data.get('bookmarks', []))} bookmarks", 4000)

    def remove_selected_history(self) -> None:
        listing = self.window.history_list
        selected = listing.selectedItems()
        urls = {item.data(Qt.ItemDataRole.UserRole) for item in selected if item.data(KIND_ROLE) == "history" and item.data(Qt.ItemDataRole.UserRole)}
        if not urls:
            self.window.status.showMessage("Select one or more history entries to remove", 3000)
            return
        self.store.data["history"] = [row for row in self.store.data.get("history", []) if row.get("url") not in urls]
        self.store.save()
        self.refresh_views()
        self.window.status.showMessage(f"Removed {len(urls)} history entr{'y' if len(urls) == 1 else 'ies'}", 3500)


__all__ = ["LibraryFeatures", "SEARCH_ENGINES"]
