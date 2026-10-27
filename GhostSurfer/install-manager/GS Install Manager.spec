# -*- mode: python ; coding: utf-8 -*-
import os

manager_dir = SPECPATH
legal_pages = (
    "terms", "license", "privacy", "cookies", "acceptable-use", "refunds",
    "security", "accessibility", "copyright", "notices", "compliance",
    "support", "legal", "manager",
)
a = Analysis(
    [os.path.join(manager_dir, "gs_install_manager.py")],
    pathex=[manager_dir],
    binaries=[],
    datas=[
        (os.path.join(manager_dir, "assets", "ghost-surfer-icon.svg"), "assets"),
        *[(os.path.join(manager_dir, "assets", "legal", page + ".html"), "assets/legal") for page in legal_pages],
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="GS Install Manager",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
