import { NO_VOICE } from './callTypes'
import { effectiveAudio } from './voiceState'

describe('effectiveAudio', () => {
  it('livre: fala e ouve', () => {
    expect(effectiveAudio({ muted: false, deafened: false }, NO_VOICE, true)).toEqual({ micOn: true, listening: true })
  })

  it('mudo local desliga o microfone', () => {
    expect(effectiveAudio({ muted: true, deafened: false }, NO_VOICE, true).micOn).toBe(false)
  })

  it('fone desligado silencia o que chega e o microfone', () => {
    expect(effectiveAudio({ muted: false, deafened: true }, NO_VOICE, true)).toEqual({ micOn: false, listening: false })
  })

  it('moderador: silenciado no servidor não fala mesmo com o botão ligado', () => {
    expect(effectiveAudio({ muted: false, deafened: false }, { ...NO_VOICE, serverMuted: true }, true).micOn).toBe(false)
  })

  it('moderador: ensurdecido no servidor não ouve e não fala', () => {
    expect(effectiveAudio({ muted: false, deafened: false }, { ...NO_VOICE, serverDeafened: true }, true)).toEqual({ micOn: false, listening: false })
  })

  it('sem permissão do microfone nunca liga o microfone', () => {
    expect(effectiveAudio({ muted: false, deafened: false }, NO_VOICE, false)).toEqual({ micOn: false, listening: true })
  })
})
