import type { BrowserWindowConstructorOptions } from 'electron'
import { findActivity, isAllowedActivityUrl } from '../shared/activities'

// Regras da janela das atividades (jogo web de terceiros). Puras para testar.

/** O que o jogo pode pedir: mira presa ao mouse, tela cheia e copiar o link da sala. */
const ACTIVITY_PERMISSIONS = new Set(['pointerLock', 'fullscreen', 'clipboard-sanitized-write'])

/**
 * Janela própria (não iframe): sem limites de pointer lock nem frame-busting.
 * Sessão separada por jogo e nada do app exposto (sem preload nem node).
 */
export function activityWindowOptions(activityId: string): BrowserWindowConstructorOptions | null {
  const activity = findActivity(activityId)
  if (!activity) return null
  return {
    width: 1280,
    height: 760,
    minWidth: 640,
    minHeight: 400,
    resizable: true,
    frame: true,
    show: false,
    autoHideMenuBar: true,
    title: `${activity.name} — Salinha`,
    backgroundColor: '#000000',
    webPreferences: {
      partition: activity.partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // Som do jogo sem precisar de clique antes.
      autoplayPolicy: 'no-user-gesture-required'
    }
  }
}

export function activityPermissionAllowed(
  activityId: string,
  permission: string,
  requestingOrigin: string
): boolean {
  if (!ACTIVITY_PERMISSIONS.has(permission)) return false
  return canNavigateActivity(activityId, requestingOrigin)
}

/** A janela só navega dentro das origens do jogo; o resto vai para o navegador. */
export function canNavigateActivity(activityId: string, url: string): boolean {
  return isAllowedActivityUrl(activityId, url)
}

/** Mesma política da janela principal (novas janelas no navegador), só http(s). */
export function opensExternally(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * User agent de navegador comum: sem os tokens do Electron e do app, que
 * alguns jogos web tratam como cliente não suportado.
 */
export function activityUserAgent(userAgent: string): string {
  return userAgent.replace(/\s+Electron\/\S+/g, '').replace(/\s+(salinha|concord)\/\S+/gi, '')
}
