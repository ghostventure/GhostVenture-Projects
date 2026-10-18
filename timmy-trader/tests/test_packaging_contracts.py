from __future__ import annotations

import subprocess
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


def test_deb_package_script_rejects_path_and_control_field_injection_before_build() -> None:
    package_script = ROOT / "scripts" / "package_deb.sh"
    for invalid_version in ("../outside", "1.0/../../outside", "1.0\nArchitecture: all"):
        result = subprocess.run(
            ["bash", str(package_script), invalid_version],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 2
        assert "Invalid Debian package version" in result.stderr
        assert "build_elf.sh" not in result.stdout
