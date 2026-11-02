"""Offline filename-risk hints for Ghost Surfer downloads.

This module only classifies the name presented to the browser. It does not scan
file contents, verify a publisher, or establish that a file is safe. Callers
should present the result as a review hint and leave any open/save decision to
the user.

Example::

    assessment = inspect_download_name("invoice.pdf.exe")
    if assessment.risky:
        print(assessment.label, assessment.reasons)
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Tuple


# Extensions that can directly launch code or invoke a Windows handler.
EXECUTABLE_EXTENSIONS = frozenset({
    ".exe", ".com", ".scr", ".pif", ".msi", ".msp", ".mst", ".dll",
    ".cpl", ".ocx", ".sys", ".drv", ".appx", ".appxbundle", ".msix",
    ".msixbundle", ".hta", ".lnk", ".url", ".scf",
})

# Script or command formats that may run through an interpreter or shell.
SCRIPT_EXTENSIONS = frozenset({
    ".bat", ".cmd", ".ps1", ".psm1", ".psd1", ".vbs", ".vbe", ".js",
    ".jse", ".wsf", ".wsh", ".hta", ".sh", ".bash", ".zsh", ".py",
    ".pyw", ".pl", ".rb", ".php", ".reg",
})

# Common document/media suffixes that can be used to disguise a later suffix.
PRESENTATION_EXTENSIONS = frozenset({
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    ".rtf", ".jpg", ".jpeg", ".png", ".gif", ".mp3", ".mp4", ".mov",
    ".zip", ".rar", ".7z",
})


@dataclass(frozen=True)
class DownloadNameAssessment:
    """A filename-only warning result suitable for a confirmation dialog.

    ``label`` is ``"High risk"`` for executable/script suffixes, ``"Review"``
    for ambiguous names, and ``"No filename warning"`` otherwise. A clean
    result is not a safety verdict; file contents are not inspected.
    """

    filename: str
    label: str
    reasons: Tuple[str, ...]
    extension: str

    @property
    def risky(self) -> bool:
        """Whether this name merits an explicit user review."""
        return bool(self.reasons)


def _basename(filename: str) -> str:
    """Normalize both Windows and URL-style separators without touching disk."""
    value = str(filename or "").replace("\\", "/").split("/")[-1]
    # Drop control characters that can make a displayed name misleading.
    return "".join(ch for ch in value if ch >= " " and ch != "\x7f").strip()


def inspect_download_name(filename: str) -> DownloadNameAssessment:
    """Return an offline warning assessment for a proposed download filename.

    The assessment flags executable and script suffixes, including names with
    a familiar document/media/archive suffix before the final executable suffix
    (for example ``invoice.pdf.exe``). It also flags trailing spaces/dots and
    right-to-left override characters because they can alter how a name appears
    in some Windows interfaces. No network request, file access, or automatic
    deletion/quarantine occurs.
    """
    original = str(filename or "")
    name = _basename(original)
    lower = name.lower()
    # Windows ignores trailing dots/spaces for many path operations. Assess the
    # effective ending while keeping the original value for user display.
    effective = lower.rstrip(" .")
    parts = [part for part in effective.split(".") if part]
    extension = f".{parts[-1]}" if len(parts) >= 2 else ""
    reasons: list[str] = []

    if any(ch in name for ch in ("\u202e", "\u202d", "\u2066", "\u2067", "\u2068", "\u2069")):
        reasons.append("Contains bidirectional text controls that can change the displayed filename order.")

    if name != effective:
        reasons.append("Ends with a dot or space, which Windows may ignore when opening the file.")

    executable = extension in EXECUTABLE_EXTENSIONS
    script = extension in SCRIPT_EXTENSIONS
    if executable:
        reasons.append(f"The final extension {extension} can launch a program or Windows handler.")
    elif script:
        reasons.append(f"The final extension {extension} can run as a script or command file.")

    if (executable or script) and any(f".{part}" in PRESENTATION_EXTENSIONS for part in parts[:-1]):
        reasons.append("A familiar document, media, or archive suffix appears before the runnable extension.")

    # A suffix with spaces or multiple dots adjacent to a runnable extension is
    # also worth a review; keep this heuristic narrow to avoid ordinary names.
    if not reasons and re.search(r"\.(?:exe|com|scr|bat|cmd|ps1|vbs|js)\s*\.[a-z0-9]{1,8}$", effective):
        reasons.append("The name contains multiple suffixes around a commonly runnable file type.")

    if executable or script:
        label = "High risk"
    elif reasons:
        label = "Review"
    else:
        label = "No filename warning"

    return DownloadNameAssessment(
        filename=name or original,
        label=label,
        reasons=tuple(reasons),
        extension=extension,
    )


__all__ = [
    "DownloadNameAssessment",
    "EXECUTABLE_EXTENSIONS",
    "SCRIPT_EXTENSIONS",
    "inspect_download_name",
]
