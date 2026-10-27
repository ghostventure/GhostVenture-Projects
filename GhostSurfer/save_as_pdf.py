"""Small UI helper for exporting the active Ghost Surfer page as a PDF."""

import re
from pathlib import Path

from PySide6.QtWidgets import QFileDialog, QMessageBox


def _report(parent, message: str, timeout: int = 5000) -> None:
    status = getattr(parent, "status", None)
    if status is not None and hasattr(status, "showMessage"):
        status.showMessage(message, timeout)
        return
    status_bar = getattr(parent, "statusBar", None)
    if callable(status_bar):
        status_bar().showMessage(message, timeout)


def save_current_page_as_pdf(parent, tab) -> None:
    """Prompt for a PDF path and print ``tab``'s page to that file.

    ``parent`` is normally BrowserWindow and ``tab`` is its active BrowserTab.
    Completion is reported asynchronously by Qt WebEngine's
    ``pdfPrintingFinished`` signal.
    """
    if tab is None:
        _report(parent, "There is no active page to save.")
        return

    title = (tab.title() or "Ghost Surfer page").strip()
    safe_title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", title).rstrip(" .")
    if not safe_title:
        safe_title = "Ghost Surfer page"
    suggested_path = str(Path.home() / "Downloads" / f"{safe_title}.pdf")

    file_path, _selected_filter = QFileDialog.getSaveFileName(
        parent,
        "Save page as PDF",
        suggested_path,
        "PDF files (*.pdf)",
    )
    if not file_path:
        return
    if not file_path.lower().endswith(".pdf"):
        file_path += ".pdf"

    page = tab.page()
    if page is None:
        _report(parent, "Could not access the page for PDF export.")
        return

    expected_path = str(Path(file_path).resolve())

    def finished(path: str, success: bool) -> None:
        if str(Path(path).resolve()) != expected_path:
            return
        try:
            page.pdfPrintingFinished.disconnect(finished)
        except (RuntimeError, TypeError):
            pass
        if success:
            _report(parent, f"PDF saved: {Path(path).name}", 6000)
        else:
            _report(parent, "PDF export failed. Choose a writable location and try again.", 7000)

    try:
        page.pdfPrintingFinished.connect(finished)
        page.printToPdf(file_path)
        _report(parent, "Creating PDF…", 0)
    except (RuntimeError, TypeError, OSError) as exc:
        try:
            page.pdfPrintingFinished.disconnect(finished)
        except (RuntimeError, TypeError):
            pass
        QMessageBox.warning(parent, "Could not save PDF", str(exc))
