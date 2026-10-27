"""Compact, reusable Find in Page dialog for Ghost Surfer."""

from PySide6.QtCore import Qt
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWebEngineCore import QWebEnginePage
from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QVBoxLayout,
)


class FindInPageDialog(QDialog):
    """Reusable find bar that operates on the active tab returned by a callback.

    Example::

        self.find_dialog = FindInPageDialog(self, self.current_tab)
        self.find_dialog.open_find()
    """

    def __init__(self, parent, get_current_tab) -> None:
        super().__init__(parent, Qt.WindowType.Tool)
        self.get_current_tab = get_current_tab
        self._highlighted_page = None
        self.setWindowTitle("Find in page")
        self.setObjectName("findInPageDialog")
        self.setMinimumWidth(440)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 12, 14, 12)
        layout.setSpacing(9)

        row = QHBoxLayout()
        row.setSpacing(7)
        self.query = QLineEdit(self)
        self.query.setPlaceholderText("Find on this page")
        self.query.setClearButtonEnabled(True)
        self.query.setAccessibleName("Find text on page")
        row.addWidget(self.query, 1)

        self.previous_button = QPushButton("Previous", self)
        self.previous_button.setToolTip("Find previous match (Shift+Enter)")
        row.addWidget(self.previous_button)
        self.next_button = QPushButton("Next", self)
        self.next_button.setToolTip("Find next match (Enter)")
        self.next_button.setDefault(True)
        row.addWidget(self.next_button)
        layout.addLayout(row)

        options = QHBoxLayout()
        self.case_sensitive = QCheckBox("Match case", self)
        options.addWidget(self.case_sensitive)
        options.addStretch(1)
        self.result_label = QLabel("Type to find", self)
        self.result_label.setObjectName("findResultLabel")
        self.result_label.setAccessibleName("Find result")
        options.addWidget(self.result_label)
        layout.addLayout(options)

        self.query.textChanged.connect(self.find_next)
        self.query.returnPressed.connect(self.find_next)
        self.previous_button.clicked.connect(self.find_previous)
        self.next_button.clicked.connect(self.find_next)
        self.case_sensitive.toggled.connect(self._repeat_current)

        previous_shortcut = QShortcut(QKeySequence("Shift+Return"), self)
        previous_shortcut.activated.connect(self.find_previous)
        previous_shortcut_alt = QShortcut(QKeySequence("Shift+Enter"), self)
        previous_shortcut_alt.activated.connect(self.find_previous)

    def open_find(self) -> None:
        """Show the dialog and focus its query field for immediate typing."""
        self.show()
        self.raise_()
        self.activateWindow()
        self.query.setFocus(Qt.FocusReason.ShortcutFocusReason)
        self.query.selectAll()
        if self.query.text():
            self.find_next()

    def _active_page(self):
        tab = self.get_current_tab() if callable(self.get_current_tab) else None
        return tab.page() if tab is not None and hasattr(tab, "page") else None

    def _clear_highlight(self) -> None:
        page = self._highlighted_page
        self._highlighted_page = None
        if page is not None:
            try:
                page.findText("")
            except RuntimeError:
                pass

    def _repeat_current(self, *_args) -> None:
        if self.query.text().strip():
            self.find_next()

    def _find(self, backwards: bool) -> None:
        text = self.query.text()
        if not text:
            self._clear_highlight()
            self.result_label.setText("Type to find")
            return

        page = self._active_page()
        if page is None:
            self.result_label.setText("No active tab")
            return

        if self._highlighted_page is not None and self._highlighted_page is not page:
            self._clear_highlight()
        self._highlighted_page = page

        flags = QWebEnginePage.FindFlag(0)
        if backwards:
            flags |= QWebEnginePage.FindFlag.FindBackward
        if self.case_sensitive.isChecked():
            flags |= QWebEnginePage.FindFlag.FindCaseSensitively

        self.result_label.setText("Searching…")

        def report(found: bool) -> None:
            self.result_label.setText("Match found" if found else "No matches")

        try:
            page.findText(text, flags, report)
        except RuntimeError:
            self.result_label.setText("Page is no longer available")

    def find_next(self) -> None:
        self._find(backwards=False)

    def find_previous(self) -> None:
        self._find(backwards=True)

    def closeEvent(self, event) -> None:
        self._clear_highlight()
        super().closeEvent(event)
