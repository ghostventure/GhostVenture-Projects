from __future__ import annotations

from pathlib import Path

KNOWLEDGE_DIRS = (
    Path(__file__).resolve().parents[1] / "knowledge",
    Path("/usr/share/doc/timmy-trader/knowledge"),
)


def search_knowledge(query: str, limit: int = 8) -> list[dict]:
    terms = [term.lower() for term in query.split() if term.strip()]
    results = []
    for path in _knowledge_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        haystack = text.lower()
        score = sum(haystack.count(term) for term in terms) if terms else 1
        if score <= 0:
            continue
        results.append({
            "file": _display_path(path),
            "title": _title(text, path),
            "score": score,
            "excerpt": _excerpt(text, terms),
        })
    return sorted(results, key=lambda item: item["score"], reverse=True)[:limit]


def list_topics() -> list[dict]:
    topics = []
    for path in _knowledge_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        topics.append({"file": _display_path(path), "title": _title(text, path)})
    return topics


def _knowledge_files() -> list[Path]:
    files: list[Path] = []
    seen: set[str] = set()
    for directory in KNOWLEDGE_DIRS:
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.md")):
            if path.name in seen:
                continue
            seen.add(path.name)
            files.append(path)
    return files


def _display_path(path: Path) -> str:
    for directory in KNOWLEDGE_DIRS:
        try:
            return str(path.relative_to(directory.parent))
        except ValueError:
            continue
    return str(path)


def _title(text: str, path: Path) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line.removeprefix("# ").strip()
    return path.stem.replace("-", " ").title()


def _excerpt(text: str, terms: list[str]) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.startswith("#")]
    if not terms:
        return " ".join(lines[:2])[:260]
    for line in lines:
        lower = line.lower()
        if any(term in lower for term in terms):
            return line[:260]
    return " ".join(lines[:2])[:260]
