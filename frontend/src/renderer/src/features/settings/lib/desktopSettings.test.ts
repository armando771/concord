import { describe, expect, it } from 'vitest'
import { desktopSections, type DesktopAvailability } from './desktopSettings'

const base: DesktopAvailability = {
  autostart: undefined,
  closeToTray: undefined,
  hasBackground: true,
  overlaySupported: false
}

describe('desktopSections', () => {
  it('sem app desktop não mostra nada', () => {
    const s = desktopSections({
      ...base,
      hasBackground: false,
      autostart: true,
      overlaySupported: true
    })
    expect(s).toEqual({ autostart: false, closeToTray: false, overlay: false, none: true })
  })

  it('carregando ou não suportado: sem iniciar com o sistema nem bandeja', () => {
    expect(desktopSections(base).none).toBe(true)
    expect(desktopSections({ ...base, autostart: null, closeToTray: null }).none).toBe(true)
  })

  it('Windows: iniciar com o sistema (mesmo desligado) e overlay', () => {
    const s = desktopSections({ ...base, autostart: false, overlaySupported: true })
    expect(s).toEqual({ autostart: true, closeToTray: false, overlay: true, none: false })
  })

  it('Linux: bandeja', () => {
    const s = desktopSections({ ...base, closeToTray: { enabled: true, available: false } })
    expect(s).toMatchObject({ closeToTray: true, none: false })
  })
})
