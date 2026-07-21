from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_deb_package_script_installs_all_docs_and_safe_env_template() -> None:
    package_script = (ROOT / "scripts" / "package_deb.sh").read_text(encoding="utf-8")
    for name in (
        "env.example",
        "README.md",
        "WEBULL_SETUP.md",
        "HOTFIX_IMPLEMENTATION_LOG.md",
        "OPERATOR_CHECKLIST.md",
        "IMPLEMENTATION_OUTLINE.md",
        "knowledge/*.md",
    ):
        assert name in package_script


def test_installed_launcher_does_not_copy_source_secrets() -> None:
    launcher = (ROOT / "packaging" / "timmy-trader").read_text(encoding="utf-8")
    assert "SOURCE_HOME" not in launcher
    assert "conf/token.txt" not in launcher
    assert "$DOC_DIR/env.example" in launcher
    assert "chmod 600" in launcher
