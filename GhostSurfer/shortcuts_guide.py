"""Searchable keyboard shortcut reference for Ghost Surfer."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog,
    QHeaderView,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
)


SHORTCUTS = (
    ("Navigation", "Quick access", "Ctrl+K"),
    ("Navigation", "Open or close Ghost Control", "Ctrl+,"),
    ("Navigation", "Focus address bar", "Ctrl+L"),
    ("Navigation", "Go back", "Alt+Left"),
    ("Navigation", "Go forward", "Alt+Right"),
    ("Navigation", "Stop loading", "Esc"),
    ("Tabs", "Next tab", "Ctrl+Tab"),
    ("Tabs", "Previous tab", "Ctrl+Shift+Tab"),
    ("Tabs", "Open a new tab", "Ctrl+T"),
    ("Tabs", "Close current tab", "Ctrl+W"),
    ("Tabs", "Reopen the last closed tab", "Ctrl+Shift+T"),
    ("Page", "Reload current page", "Ctrl+R"),
    ("Page", "Find text on the current page", "Ctrl+F"),
    ("Page", "Save current page as PDF", "Ctrl+P"),
    ("Page", "Toggle distraction-free view", "F11"),
    ("Library", "Bookmark current page", "Ctrl+D"),
    ("Library", "Open downloads", "Ctrl+J"),
)


def show_shortcuts_guide(parent) -> None:
    """Open a searchable, keyboard-accessible shortcut reference dialog."""
    dialog = QDialog(parent)
    dialog.setWindowTitle("Ghost Surfer keyboard shortcuts")
    dialog.setObjectName("shortcutsGuide")
    dialog.setMinimumSize(610, 500)
    dialog.resize(700, 560)

    layout = QVBoxLayout(dialog)
    layout.setContentsMargins(20, 18, 20, 18)
    layout.setSpacing(12)

    heading = QLabel("Keyboard shortcuts")
    heading.setObjectName("shortcutsHeading")
    heading.setStyleSheet("font-size: 20px; font-weight: 700;")
    layout.addWidget(heading)

    description = QLabel("Search by action, category, or key combination. Press Esc to close.")
    description.setWordWrap(True)
    layout.addWidget(description)

    search = QLineEdit()
    search.setPlaceholderText("Filter shortcuts…")
    search.setClearButtonEnabled(True)
    search.setAccessibleName("Filter keyboard shortcuts")
    layout.addWidget(search)

    table = QTableWidget(0, 3, dialog)
    table.setObjectName("shortcutsTable")
    table.setHorizontalHeaderLabels(("Area", "Action", "Shortcut"))
    table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
    table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
    table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
    table.setAlternatingRowColors(True)
    table.setWordWrap(False)
    table.verticalHeader().setVisible(False)
    table.horizontalHeader().setStretchLastSection(False)
    table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
    table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
    table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
    table.setAccessibleName("Keyboard shortcuts")
    layout.addWidget(table, 1)

    footer = QHBoxLayout()
    footer.addStretch(1)
    close_button = QPushButton("Close")
    close_button.setDefault(True)
    close_button.clicked.connect(dialog.accept)
    footer.addWidget(close_button)
    layout.addLayout(footer)

    def populate(query: str = "") -> None:
        needle = query.strip().casefold()
        matches = [row for row in SHORTCUTS if not needle or needle in " ".join(row).casefold()]
        table.setRowCount(len(matches))
        for row_index, values in enumerate(matches):
            for column, value in enumerate(values):
                cell = QTableWidgetItem(value)
                if column == 2:
                    cell.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                table.setItem(row_index, column, cell)
        if matches:
            table.selectRow(0)

    search.textChanged.connect(populate)
    search.returnPressed.connect(lambda: table.setFocus())
    close_button.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
    populate()
    search.setFocus()
    dialog.exec()
