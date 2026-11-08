Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
Name "WEXPCeasy 0.1.1"
OutFile "@@OUTPUT@@"
InstallDir "$LOCALAPPDATA\WEXPCeasy"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "WEXPCeasy"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "安装 WEXPCeasy。程序安装位置与公共数据目录分别选择。卸载和重新安装默认保留你的数据。"
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ValidateInstallDirectory
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\WEXPCeasy.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_TEXT "安装完成。首次启动可创建独立数据目录，或接回已有 WEX 数据目录。"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Function ValidateInstallDirectory
 IfFileExists "$INSTDIR\." 0 +2
 GetFullPathName $INSTDIR "$INSTDIR"
 StrCpy $R9 "drive_root"
 StrCmp $INSTDIR "" invalid
 ${GetRoot} "$INSTDIR" $R0
 StrCmp $R0 "" invalid
 StrCmp $INSTDIR $R0 invalid
 StrCpy $R2 "$R0\"
 StrCmp $INSTDIR $R2 invalid
 StrCpy $R9 "other_installation"
 ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "InstallLocation"
 StrCmp $R0 "" registry_ok
 IfFileExists "$R0\." 0 +2
 GetFullPathName $R0 "$R0"
 StrCmp $R0 $INSTDIR registry_ok invalid
 registry_ok:
 StrCpy $R9 "reparse_installation"
 System::Call 'kernel32::GetFileAttributesW(w "$INSTDIR") i .r0'
 IntCmp $0 -1 folder_ok
 IntOp $1 $0 & 0x400
 IntCmp $1 0 +2
 Goto invalid
 folder_ok:
 StrCpy $R9 "data_directory"
 IfFileExists "$INSTDIR\.wex-root.json" invalid
 StrCpy $R9 "nonempty_unrecognized_directory"
 FindFirst $R0 $R1 "$INSTDIR\*"
 scan:
 StrCmp $R1 "" empty
 StrCmp $R1 "." next
 StrCmp $R1 ".." next
 ReadINIStr $R2 "$INSTDIR\.wex-install.ini" "WEX" "Product"
 StrCmp $R2 "WEXPCeasy" 0 found_invalid
 ReadINIStr $R2 "$INSTDIR\.wex-install.ini" "WEX" "Format"
 StrCmp $R2 "1" recognized found_invalid
 next:
 FindNext $R0 $R1
 Goto scan
 found_invalid:
 FindClose $R0
 Goto invalid
 recognized:
 FindClose $R0
 Call ValidatePayloadPaths
 Call VerifyApplicationStopped
 Return
 empty:
 FindClose $R0
 Call ValidatePayloadPaths
 Call VerifyApplicationStopped
 Return
 invalid:
 FileOpen $R8 "$TEMP\WEXPCeasy-install.log" a
 FileSeek $R8 0 END
 FileWrite $R8 "$R9|$INSTDIR|attributes=$0|reparse=$1$\r$\n"
 FileClose $R8
 FileOpen $R8 "$TEMP\WEXPCeasy-install-utf16.log" a
 FileSeek $R8 0 END $R6
 IntCmp $R6 0 0 +2 +2
 FileWriteWord $R8 0xFEFF
 FileWriteUTF16LE $R8 "$R9|$INSTDIR|attributes=$0|reparse=$1$\r$\n"
 FileClose $R8
 IfSilent +2
 MessageBox MB_OK|MB_ICONSTOP "请选择空的程序安装目录，或已有的 WEXPCeasy 安装目录。不可安装到数据目录、磁盘根目录或重解析目录；更换安装位置前请先卸载旧程序。"
 SetErrorLevel 2
 Abort
FunctionEnd

Function ValidatePayloadPaths
@@VERIFY_PATHS@@
 Return
FunctionEnd

Function VerifyApplicationStopped
@@VERIFY_STOPPED@@
FunctionEnd

Function un.VerifyApplicationStopped
@@VERIFY_STOPPED@@
FunctionEnd

Function un.ValidatePayloadPaths
@@VERIFY_PATHS@@
 Return
FunctionEnd

Section "WEXPCeasy"
 Call ValidateInstallDirectory
 SetShellVarContext current
@@INSTALL_FILES@@
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateShortcut "$SMPROGRAMS\WEXPCeasy.lnk" "$INSTDIR\WEXPCeasy.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "DisplayName" "WEXPCeasy"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "DisplayVersion" "0.1.1"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "NoRepair" 1
SectionEnd

Function un.onInit
 ReadINIStr $R0 "$INSTDIR\.wex-install.ini" "WEX" "Product"
 StrCmp $R0 "WEXPCeasy" +3
 SetErrorLevel 2
 Abort
 Call un.ValidatePayloadPaths
 Call un.VerifyApplicationStopped
 GetFullPathName $INSTDIR "$INSTDIR"
FunctionEnd

Section "Uninstall"
 SetShellVarContext current
@@REMOVE_FILES@@
 Delete "$INSTDIR\.wex-launch.json"
 Delete "$INSTDIR\Uninstall.exe"
 Delete "$SMPROGRAMS\WEXPCeasy.lnk"
 ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy" "InstallLocation"
 IfFileExists "$R0\." 0 +2
 GetFullPathName $R0 "$R0"
 StrCmp $R0 $INSTDIR 0 +2
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WEXPCeasy"
 RMDir "$INSTDIR"
SectionEnd
