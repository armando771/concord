import type { BrowserWindowConstructorOptions } from 'electron'
import { findActivity } from '../shared/activities'

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

/**
 * A janela só navega dentro das origens do jogo (o resto é bloqueado). Compara
 * a origem já normalizada pelo Chromium; o limite de 512 caracteres vale só
 * para o link da sala compartilhado, não para URLs do próprio jogo.
 */
export function canNavigateActivity(activityId: string, url: string): boolean {
  const activity = findActivity(activityId)
  if (!activity) return false
  try {
    return activity.origins.includes(new URL(url).origin)
  } catch {
    return false
  }
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

/** Janela em que um clique/tecla conta como gesto para abrir link fora. */
export const EXTERNAL_GESTURE_WINDOW_MS = 1000
/** No máximo um link aberto no navegador a cada tanto. */
export const EXTERNAL_OPEN_INTERVAL_MS = 3000

/** Tipos de entrada (before-input-event) que contam como gesto da pessoa. */
export function isUserGestureInput(type: string): boolean {
  return type === 'mouseDown' || type === 'keyDown'
}

export interface ExternalOpenGate {
  recordInput(now: number): void
  /** Pode abrir no navegador agora? Consome o gesto e inicia o intervalo. */
  allow(now: number): boolean
}

/**
 * Página de terceiros (e anúncios) não abre abas no navegador sozinha: só logo
 * depois de um clique/tecla na janela, e no máximo uma a cada 3 s.
 */
export function createExternalOpenGate(): ExternalOpenGate {
  let lastInput = -Infinity
  let lastOpen = -Infinity
  return {
    recordInput(now) {
      lastInput = now
    },
    allow(now) {
      if (now - lastInput > EXTERNAL_GESTURE_WINDOW_MS) return false
      if (now - lastOpen < EXTERNAL_OPEN_INTERVAL_MS) return false
      lastOpen = now
      lastInput = -Infinity
      return true
    }
  }
}
