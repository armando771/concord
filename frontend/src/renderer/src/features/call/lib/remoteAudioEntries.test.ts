import { describe, expect, it } from 'vitest'
import { remoteAudioEntries } from './remoteAudioEntries'

const anaVoz = {} as MediaStream
const biaTela = {} as MediaStream

describe('remoteAudioEntries', () => {
  it('ensurdecer cala as vozes mas não o som da transmissão', () => {
    const entries = remoteAudioEntries({
      streams: { ana: anaVoz },
      screenAudioStreams: { bia: biaTela },
      deafened: true
    })
    expect(entries).toEqual([
      { key: 'ana', stream: anaVoz, muted: true, volumeKey: 'ana', music: false },
      { key: 'screen:bia', stream: biaTela, muted: false, volumeKey: 'screen:bia', music: false }
    ])
  })

  it('sem ensurdecer nada é mutado', () => {
    const entries = remoteAudioEntries({
      streams: { ana: anaVoz },
      screenAudioStreams: { bia: biaTela },
      deafened: false
    })
    expect(entries.every((e) => !e.muted)).toBe(true)
    expect(entries).toHaveLength(2)
  })

  it('marca a voz do Maestro como música', () => {
    const s = {} as MediaStream
    const entries = remoteAudioEntries({
      streams: { ana: s, 'bot-music:v1': s },
      screenAudioStreams: {},
      deafened: false
    })
    expect(entries.find((e) => e.key === 'ana')?.music).toBe(false)
    expect(entries.find((e) => e.key === 'bot-music:v1')?.music).toBe(true)
  })
})
