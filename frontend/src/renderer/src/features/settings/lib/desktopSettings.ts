// Configurações → Aplicativo: o que existe em cada plataforma. Puro.

/** Linux: null = sem bandeja (ou outra plataforma); undefined = carregando. */
export interface CloseToTrayState {
  enabled: boolean
  available: boolean
}

export interface DesktopAvailability {
  /** undefined = carregando; null = não suportado nesta plataforma. */
  autostart: boolean | null | undefined
  closeToTray: CloseToTrayState | null | undefined
  /** Há app desktop (preload) com a ponte de segundo plano. */
  hasBackground: boolean
  /** O overlay de jogo é suportado (só Windows). */
  overlaySupported: boolean
}

export interface DesktopSections {
  autostart: boolean
  closeToTray: boolean
  overlay: boolean
  /** Nada para mostrar nesta plataforma. */
  none: boolean
}

export function desktopSections(a: DesktopAvailability): DesktopSections {
  const autostart = a.hasBackground && typeof a.autostart === 'boolean'
  const closeToTray = a.hasBackground && Boolean(a.closeToTray)
  const overlay = a.hasBackground && a.overlaySupported
  return { autostart, closeToTray, overlay, none: !autostart && !closeToTray && !overlay }
}
