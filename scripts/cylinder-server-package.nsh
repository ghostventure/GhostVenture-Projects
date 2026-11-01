!macro customInstall
  ${ifNot} ${isUpdated}
    IfSilent cylinderClientPackageDone
    MessageBox MB_YESNO|MB_ICONQUESTION "Also include the optional Cylinder Workstation Client deployment package? It contains a signed Windows 10/11 client installer and a script for staging or installing it on authorized VPN-connected workstations." IDNO cylinderClientPackageDone
    CreateDirectory "$INSTDIR\Cylinder Client Package"
    SetOutPath "$INSTDIR\Cylinder Client Package"
    File /oname=OverHead-Cylinder-Client-Setup.exe "${BUILD_RESOURCES_DIR}\cylinder-client-package\OverHead-Cylinder-Client-Setup.exe"
    File /oname=Deploy-Cylinder-Clients.ps1 "${BUILD_RESOURCES_DIR}\cylinder-client-package\Deploy-Cylinder-Clients.ps1"
    File /oname=SHA256SUMS.txt "${BUILD_RESOURCES_DIR}\cylinder-client-package\SHA256SUMS.txt"
    cylinderClientPackageDone:
  ${endIf}
!macroend
