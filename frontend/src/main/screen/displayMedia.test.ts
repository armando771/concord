import { describe, expect, it } from 'vitest'
import { displayAudioMode, warnWindowAudioFallback } from './displayMedia'

describe('displayAudioMode', () => {
  const win = { audioRequested: true, platform: 'win32' as const }

  it('janela: só o som do app dela quando o helper conseguiu capturar', () => {
    expect(displayAudioMode({ ...win, sourceId: 'window:132456:0', windowAudioOk: true })).toBe(
      'window'
    )
  })

  it('janela: se não deu para isolar o som do app, vai SEM som (nunca o do sistema)', () => {
    expect(displayAudioMode({ ...win, sourceId: 'window:132456:0', windowAudioOk: false })).toBe(
      'none'
    )
  })

  it('tela inteira: som do sistema (sem o Concord)', () => {
    expect(displayAudioMode({ ...win, sourceId: 'screen:0:0', windowAudioOk: false })).toBe(
      'system'
    )
  })

  it('sem pedir áudio, ou fora do Windows, só vídeo', () => {
    expect(
      displayAudioMode({
        ...win,
        audioRequested: false,
        sourceId: 'screen:0:0',
        windowAudioOk: false
      })
    ).toBe('none')
    expect(
      displayAudioMode({
        audioRequested: true,
        platform: 'linux',
        sourceId: 'screen:0:0',
        windowAudioOk: false
      })
    ).toBe('none')
  })
})

describe('warnWindowAudioFallback', () => {
  const base = { sourceId: 'window:42:0', audioRequested: true, mode: 'none' as const }

  it('Windows: janela que ficou sem som avisa', () => {
    expect(warnWindowAudioFallback({ ...base, platform: 'win32' })).toBe(true)
  })

  it('Linux: nunca avisa (a tela não leva som lá)', () => {
    expect(warnWindowAudioFallback({ ...base, platform: 'linux' })).toBe(false)
  })

  it('tela inteira, som pedido não, ou som da janela funcionando: não avisa', () => {
    expect(warnWindowAudioFallback({ ...base, platform: 'win32', sourceId: 'screen:0:0' })).toBe(
      false
    )
    expect(warnWindowAudioFallback({ ...base, platform: 'win32', audioRequested: false })).toBe(
      false
    )
    expect(warnWindowAudioFallback({ ...base, platform: 'win32', mode: 'window' })).toBe(false)
  })
})
