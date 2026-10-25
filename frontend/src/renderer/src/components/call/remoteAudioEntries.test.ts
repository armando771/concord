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
      { key: 'ana', stream: anaVoz, muted: true, volumeKey: 'ana' },
      { key: 'screen:bia', stream: biaTela, muted: false, volumeKey: 'screen:bia' }
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
})
