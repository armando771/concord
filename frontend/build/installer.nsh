; Protocolo salinha:// (links de convite: salinha://convite/<código>).
; SHCTX = HKCU na instalação por usuário (padrão), HKLM na por máquina.

!macro customInstall
  WriteRegStr SHCTX "Software\Classes\salinha" "" "URL:Salinha"
  WriteRegStr SHCTX "Software\Classes\salinha" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\salinha\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "Software\Classes\salinha\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ; Atualização roda o desinstalador antigo antes: aí o protocolo fica.
  ${ifNot} ${isUpdated}
    DeleteRegKey SHCTX "Software\Classes\salinha"
  ${endIf}
!macroend
