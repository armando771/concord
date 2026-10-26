import { describe, expect, it } from 'vitest'
import { effectiveVoiceFlags, micBlockReason, streamBlockReason } from './voicePermissions'

describe('micBlockReason', () => {
  it('liberado quando pode falar e não foi silenciado', () => {
    expect(micBlockReason({ canSpeak: true, serverMuted: false })).toBeNull()
  })

  it('silenciado por moderador tem prioridade na explicação', () => {
    expect(micBlockReason({ canSpeak: false, serverMuted: true })).toMatch(/moderador/)
    expect(micBlockReason({ canSpeak: true, serverMuted: true })).toMatch(/moderador/)
  })

  it('sem SPEAK no canal', () => {
    expect(micBlockReason({ canSpeak: false, serverMuted: false })).toMatch(/permissão para falar/)
  })
})

describe('streamBlockReason', () => {
  it('só trava sem permissão', () => {
    expect(streamBlockReason(true)).toBeNull()
    expect(streamBlockReason(false)).toMatch(/permissão para transmitir/)
  })
})

describe('effectiveVoiceFlags', () => {
  it('soma o que a pessoa fez ao que o servidor impôs', () => {
    expect(effectiveVoiceFlags({ muted: true })).toEqual({ muted: true, deafened: false })
    expect(effectiveVoiceFlags({ serverMuted: true })).toEqual({ muted: true, deafened: false })
    expect(effectiveVoiceFlags({ deafened: true })).toEqual({ muted: false, deafened: true })
  })

  it('ensurdecido pelo servidor também aparece como mudo', () => {
    expect(effectiveVoiceFlags({ serverDeafened: true })).toEqual({ muted: true, deafened: true })
  })

  it('sem estado, nada travado', () => {
    expect(effectiveVoiceFlags(undefined)).toEqual({ muted: false, deafened: false })
    expect(effectiveVoiceFlags({})).toEqual({ muted: false, deafened: false })
  })
})
