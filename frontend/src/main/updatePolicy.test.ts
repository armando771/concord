import { describe, expect, it } from 'vitest'
import {
  autoUpdateUnavailable,
  backgroundDownloadDelayMs,
  canDownloadUpdate,
  DOWNLOAD_JITTER_MAX_MS,
  installOnStartup
} from './updatePolicy'

describe('updatePolicy', () => {
  it('não baixa durante chamada (o upload do servidor é o mesmo da mídia)', () => {
    expect(canDownloadUpdate(true)).toBe(false)
    expect(canDownloadUpdate(false)).toBe(true)
  })

  it('instala ao abrir quando a versão já estava baixada da sessão anterior', () => {
    expect(
      installOnStartup({
        version: '0.2.0',
        verifiedBefore: '0.2.0',
        msSinceStart: 5_000,
        inCall: false
      })
    ).toBe(true)
  })

  it('download que terminou agora (mesmo rápido) só avisa — não reinicia sozinho', () => {
    expect(
      installOnStartup({
        version: '0.2.0',
        verifiedBefore: null,
        msSinceStart: 3_000,
        inCall: false
      })
    ).toBe(false)
    expect(
      installOnStartup({
        version: '0.3.0',
        verifiedBefore: '0.2.0',
        msSinceStart: 3_000,
        inCall: false
      })
    ).toBe(false)
  })

  it('com o app em uso há um tempo, só avisa', () => {
    expect(
      installOnStartup({
        version: '0.2.0',
        verifiedBefore: '0.2.0',
        msSinceStart: 10 * 60_000,
        inCall: false
      })
    ).toBe(false)
  })

  it('nunca reinicia sozinho em chamada', () => {
    expect(
      installOnStartup({
        version: '0.2.0',
        verifiedBefore: '0.2.0',
        msSinceStart: 1_000,
        inCall: true
      })
    ).toBe(false)
  })
})

describe('backgroundDownloadDelayMs', () => {
  const later = 10 * 60_000

  it('espalha o download em segundo plano entre 0 e 2 min', () => {
    expect(DOWNLOAD_JITTER_MAX_MS).toBe(120_000)
    expect(backgroundDownloadDelayMs({ force: false, msSinceStart: later, random: 0 })).toBe(0)
    expect(backgroundDownloadDelayMs({ force: false, msSinceStart: later, random: 0.5 })).toBe(
      60_000
    )
    expect(
      backgroundDownloadDelayMs({ force: false, msSinceStart: later, random: 0.999999 })
    ).toBeLessThan(120_000)
  })

  it('clicar em Atualizar não espera', () => {
    expect(backgroundDownloadDelayMs({ force: true, msSinceStart: later, random: 0.9 })).toBe(0)
  })

  it('logo ao abrir o app não espera (cada um abre numa hora; instala do cache)', () => {
    expect(backgroundDownloadDelayMs({ force: false, msSinceStart: 5_000, random: 0.9 })).toBe(0)
    expect(backgroundDownloadDelayMs({ force: false, msSinceStart: 31_000, random: 0.9 })).toBe(
      108_000
    )
  })

  it('sorteio fora de [0, 1) não passa do teto nem fica negativo', () => {
    expect(backgroundDownloadDelayMs({ force: false, msSinceStart: later, random: -1 })).toBe(0)
    expect(backgroundDownloadDelayMs({ force: false, msSinceStart: later, random: 5 })).toBe(
      120_000
    )
  })

  it('aceita outro teto', () => {
    expect(
      backgroundDownloadDelayMs({ force: false, msSinceStart: later, random: 0.5 }, 1000)
    ).toBe(500)
  })
})

describe('autoUpdateUnavailable', () => {
  it('Linux empacotado sem APPIMAGE (AppImage extraído) não atualiza sozinho', () => {
    expect(
      autoUpdateUnavailable({ platform: 'linux', isPackaged: true, appImage: undefined })
    ).toBe(true)
    expect(autoUpdateUnavailable({ platform: 'linux', isPackaged: true, appImage: '' })).toBe(true)
  })

  it('AppImage normal, Windows e dev não avisam', () => {
    expect(
      autoUpdateUnavailable({ platform: 'linux', isPackaged: true, appImage: '/home/a/S.AppImage' })
    ).toBe(false)
    expect(
      autoUpdateUnavailable({ platform: 'win32', isPackaged: true, appImage: undefined })
    ).toBe(false)
    expect(
      autoUpdateUnavailable({ platform: 'linux', isPackaged: false, appImage: undefined })
    ).toBe(false)
  })
})
