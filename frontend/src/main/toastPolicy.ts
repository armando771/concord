import { win32 } from 'path'

// Notificações nativas do Windows (toasts). Para um app Win32 o Windows só
// mostra o aviso se houver um atalho no Menu Iniciar com o mesmo AppUserModelID
// do processo e o mesmo ToastActivatorCLSID. Puro para poder testar.

/** Id do Concord (nome antigo): liga notificações, login e instalação ao app. */
export const APP_USER_MODEL_ID = 'com.concord.app'

/**
 * CLSID fixo do ativador de toasts. Sem ele o Electron sorteia um a cada
 * execução, que nunca bate com o do atalho. Não mudar: atalhos já gravados
 * guardam este valor.
 */
export const TOAST_ACTIVATOR_CLSID = '{34E45F99-A48A-43ED-9480-25CDDDE2227E}'

/** Atalho do instalador (electron-builder: nsis.shortcutName = productName). */
export const START_MENU_SHORTCUT = 'Salinha.lnk'

/** Atalho de instalações de quando o app se chamava Concord. */
export const LEGACY_START_MENU_SHORTCUT = 'Concord.lnk'

/** Só no Windows instalado: em dev e no portable não há atalho para cuidar. */
export function toastSetupNeeded(env: {
  platform: NodeJS.Platform
  packaged: boolean
  portable: boolean
}): boolean {
  return env.platform === 'win32' && env.packaged && !env.portable
}

export interface ShortcutInfo {
  target: string
  appUserModelId?: string
  toastActivatorClsid?: string
}

const samePath = (a: string, b: string): boolean =>
  win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase()

const sameClsid = (a = '', b = ''): boolean =>
  a.replace(/[{}]/g, '').toLowerCase() === b.replace(/[{}]/g, '').toLowerCase()

/**
 * O que fazer com o Salinha.lnk do Menu Iniciar (`current` = null se não
 * existe): criado se faltar, atualizado se o exe, o AUMID ou o CLSID não batem.
 */
export function shortcutFix(
  current: ShortcutInfo | null,
  wanted: ShortcutInfo
): 'create' | 'update' | null {
  if (!current) return 'create'
  const ok =
    samePath(current.target, wanted.target) &&
    current.appUserModelId === wanted.appUserModelId &&
    sameClsid(current.toastActivatorClsid, wanted.toastActivatorClsid)
  return ok ? null : 'update'
}

/**
 * Concord.lnk que sobrou de antes da renomeação é nosso (e vai ser apagado,
 * para só ficar "Salinha" no Menu Iniciar) se tem o nosso AUMID ou aponta
 * para a pasta de instalação atual. Atalho de outro programa fica.
 */
export function isOurLegacyShortcut(current: ShortcutInfo, execPath: string): boolean {
  if (current.appUserModelId === APP_USER_MODEL_ID) return true
  return samePath(win32.dirname(current.target), win32.dirname(execPath))
}
