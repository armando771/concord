import { app, shell } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { appendLog } from './appLog'
import {
  APP_USER_MODEL_ID,
  LEGACY_START_MENU_SHORTCUT,
  shortcutFix,
  START_MENU_SHORTCUT,
  TOAST_ACTIVATOR_CLSID,
  toastSetupNeeded,
  type ShortcutInfo
} from './toastPolicy'

// Toasts do Windows: CLSID fixo + atalho do Menu Iniciar com AUMID e CLSID.
// O instalador (electron-builder) grava só o AUMID no atalho; completamos aqui.

/** Log de notificações: %APPDATA%\\Concord\\logs\\notifications.log no Windows. */
export function logNotification(message: string): void {
  appendLog('notifications.log', message)
}

/** null = não existe; undefined = existe mas não deu para ler (não mexe). */
function readShortcut(path: string): ShortcutInfo | null | undefined {
  if (!existsSync(path)) return null
  try {
    return shell.readShortcutLink(path)
  } catch (err) {
    logNotification(`não deu para ler ${path}: ${String(err)}`)
    return undefined
  }
}

function ensureShortcut(path: string, kind: 'primary' | 'legacy'): void {
  const current = readShortcut(path)
  if (current === undefined) return
  const wanted: ShortcutInfo = {
    target: process.execPath,
    appUserModelId: APP_USER_MODEL_ID,
    toastActivatorClsid: TOAST_ACTIVATOR_CLSID
  }
  const fix = shortcutFix(current, wanted, kind)
  if (!fix) return
  const ok = shell.writeShortcutLink(path, fix, {
    ...wanted,
    cwd: dirname(process.execPath),
    // O ícone antigo pode apontar para o Concord.exe que não existe mais.
    icon: process.execPath,
    iconIndex: 0
  })
  logNotification(`atalho ${path}: ${fix} ${ok ? 'ok' : 'falhou'}`)
}

/** Chamar cedo, antes de qualquer notificação (o CLSID entra no registro). */
export function setupToasts(): void {
  const needed = toastSetupNeeded({
    platform: process.platform,
    packaged: app.isPackaged,
    portable: !!process.env.PORTABLE_EXECUTABLE_FILE
  })
  if (!needed) return
  try {
    app.setToastActivatorCLSID(TOAST_ACTIVATOR_CLSID)
  } catch (err) {
    logNotification(`setToastActivatorCLSID falhou: ${String(err)}`)
  }
  const programs = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  try {
    ensureShortcut(join(programs, START_MENU_SHORTCUT), 'primary')
    // Concord.lnk que sobrou de antes da renomeação, com o mesmo AUMID: se
    // ficar sem o CLSID o Windows pode escolher ele e o aviso não aparece.
    ensureShortcut(join(programs, LEGACY_START_MENU_SHORTCUT), 'legacy')
  } catch (err) {
    logNotification(`falha ao preparar o atalho do Menu Iniciar: ${String(err)}`)
  }
}
