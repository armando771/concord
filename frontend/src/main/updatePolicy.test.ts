import { describe, expect, it } from 'vitest'
import { canDownloadUpdate, installOnStartup } from './updatePolicy'

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
