"""Background checks and verified staging for Ghost Surfer GitHub releases."""

from __future__ import annotations

from PySide6.QtCore import QThread, Signal

from github_updater import GitHubReleasesUpdater


class UpdateWorker(QThread):
    completed = Signal(object, str)
    progress = Signal(object, object)

    def __init__(self, updater: GitHubReleasesUpdater, operation: str, candidate=None, parent=None) -> None:
        super().__init__(parent)
        self.updater = updater
        self.operation = operation
        self.candidate = candidate

    def run(self) -> None:
        try:
            if self.operation == "check":
                result = self.updater.check_for_update()
            elif self.operation == "download" and self.candidate is not None:
                result = self.updater.download_and_stage(
                    self.candidate,
                    progress=lambda done, total: self.progress.emit(done, total),
                )
            else:
                raise ValueError("Unsupported update operation")
        except Exception as exc:
            self.completed.emit(None, str(exc))
        else:
            self.completed.emit(result, "")
