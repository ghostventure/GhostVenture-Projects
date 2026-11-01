; OverHead installer preflight. Electron ships Chromium with the app, so no
; separate browser runtime is needed. We still stop before installation when
; Windows itself or the chosen folder cannot support a reliable installation.
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

!macro customInit
  ; Install Manager passes this marker only after the user has consented in
  ; the Manager flow. Direct setup still requires the installer consent prompt.
  ClearErrors
  ${GetParameters} $R8
  ClearErrors
  ${GetOptions} $R8 "/OVERHEAD_MANAGER_CONSENT=" $R9
  ${IfNot} ${Errors}
    ${If} $R9 == "1"
      Goto consentAccepted
    ${EndIf}
  ${EndIf}

  !ifdef OVERHEAD_CYLINDER_SERVER
    MessageBox MB_YESNO|MB_ICONQUESTION "Before OverHead Cylinder Server installs, please confirm what you allow:\r\n\r\n- Windows may request administrator approval to install the server application, create shortcuts, and update it.\r\n- Cylinder stores its workspace and selected customer documents locally under your Windows account.\r\n- With Auto-Check enabled, it checks the Cylinder Server release feed and downloads an update only after you consent.\r\n\r\nIt does not install browser extensions, change your Windows account, or access documents you have not selected. Select Yes to continue or No to cancel." IDYES consentAccepted
  !else
    MessageBox MB_YESNO|MB_ICONQUESTION "Before OverHead Desktop installs, please confirm what you allow:\r\n\r\n- Windows may request administrator approval to install the app, create shortcuts, and update it.\r\n- OverHead stores its workspace and selected customer documents locally on this computer.\r\n- With Auto-Check enabled, it checks GitHub for Desktop releases and downloads an update only after you consent.\r\n\r\nIt does not install browser extensions, change your Windows account, or access documents you have not selected. Select Yes to continue or No to cancel." IDYES consentAccepted
  !endif
  Abort
  consentAccepted:
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "OverHead was not installed. This release needs native x64 Windows. ARM64 and emulated x64 systems are not supported by this build."
    Abort
  ${EndIf}

  ; RunningX64 alone can report x64 emulation on ARM64 Windows. Compare the
  ; native system architecture from the 64-bit Windows environment registry.
  SetRegView 64
  ReadRegStr $R0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "PROCESSOR_ARCHITECTURE"
  ${If} $R0 != "AMD64"
    MessageBox MB_OK|MB_ICONSTOP "OverHead was not installed. This release requires native x64 Windows hardware. ARM64 is not supported by this x64 package."
    Abort
  ${EndIf}

  !ifdef OVERHEAD_CYLINDER_SERVER
  ; Cylinder Server permits Windows Server / Windows IoT server products only.
  ; Desktop keeps its separate Windows 10/11 workstation-only preflight below.
  ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "ProductName"
  ReadRegStr $R2 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  ${If} $R2 == ""
    MessageBox MB_OK|MB_ICONSTOP "OverHead Cylinder Server was not installed because Windows did not report its build number. Update Windows and try again."
    Abort
  ${EndIf}
  IntOp $R2 $R2 + 0
  ${If} $R2 < 17763
    MessageBox MB_OK|MB_ICONSTOP "OverHead Cylinder Server requires Windows Server or Windows IoT build 17763 or later."
    Abort
  ${EndIf}
  StrCpy $R3 $R1 14
  ${If} $R3 != "Windows Server"
    ReadRegStr $R4 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "EditionID"
    StrCpy $R3 $R4 3
    ${If} $R3 != "IoT"
      MessageBox MB_OK|MB_ICONSTOP "OverHead Cylinder Server supports Windows Server or Windows IoT editions only. Workstation editions must use OverHead Desktop."
      Abort
    ${EndIf}
  ${EndIf}
  ${If} $R1 == ""
    MessageBox MB_OK|MB_ICONSTOP "OverHead Cylinder Server could not verify this Windows edition. Setup stopped."
    Abort
  ${EndIf}
  !else
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "OverHead Desktop was not installed. This release needs Windows 10 or Windows 11. Please update Windows before running setup."
    Abort
  ${EndIf}

  ; Match the Manager's Windows 10 1809 (build 17763) minimum. ProductName
  ; must identify a Windows client edition so Server builds do not pass merely
  ; because they share a Windows build number. Windows 11 may retain a Windows
  ; 10 ProductName in the registry, so both client labels are accepted.
  ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "ProductName"
  ReadRegStr $R2 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  ${If} $R2 == ""
      MessageBox MB_OK|MB_ICONSTOP "OverHead Desktop was not installed because Windows did not report its build number. Update Windows and try again."
    Abort
  ${EndIf}
  ; Force an integer comparison even if the registry value is returned as text.
  IntOp $R2 $R2 + 0
  ${If} $R2 < 17763
    MessageBox MB_OK|MB_ICONSTOP "OverHead Desktop was not installed. This release needs Windows 10 build 17763 (version 1809) or later, or Windows 11."
    Abort
  ${EndIf}
  StrCpy $R3 $R1 10
  ${If} $R3 != "Windows 10"
    ${If} $R3 != "Windows 11"
      MessageBox MB_OK|MB_ICONSTOP "OverHead Desktop was not installed. This release supports Windows 10 or Windows 11 client editions only."
      Abort
    ${EndIf}
  ${EndIf}
  !endif

  ; Test the selected per-user installation location before copying app files.
  ; This catches Controlled Folder Access, antivirus interference, file locks,
  ; and missing write permission with a useful message before a partial install.
  CreateDirectory "$INSTDIR"
  ClearErrors
  FileOpen $0 "$INSTDIR\\.overhead-install-write-test" w
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "OverHead was not installed because Windows could not write to the selected folder. Windows Security, antivirus, a file lock, or folder permission may be blocking setup. Choose another folder or allow this installer, then try again."
    Abort
  ${EndIf}
  FileClose $0
  Delete "$INSTDIR\\.overhead-install-write-test"
!macroend

Function .onInstFailed
  MessageBox MB_OK|MB_ICONEXCLAMATION "OverHead was not installed completely. Windows Security or antivirus, a locked file, insufficient folder permission, or a damaged download may have blocked setup. Close any running OverHead windows, allow the installer if you trust it, then run a fresh download."
FunctionEnd
