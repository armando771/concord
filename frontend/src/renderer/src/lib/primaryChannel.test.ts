import { describe, expect, it } from 'vitest'
import { primaryChannelId } from './primaryChannel'

const channels = [
  { id: 'voz', type: 'voice' },
  { id: 'geral', type: 'text' },
  { id: 'memes', type: 'text' }
]

describe('primaryChannelId', () => {
  it('usa o canal escolhido', () => {
    expect(primaryChannelId({ primary_channel_id: 'memes' }, channels)).toBe('memes')
  })

  it('sem escolha (ou escolha inválida) é o primeiro canal de texto', () => {
    expect(primaryChannelId({}, channels)).toBe('geral')
    expect(primaryChannelId({ primary_channel_id: 'apagado' }, channels)).toBe('geral')
    expect(primaryChannelId({ primary_channel_id: 'voz' }, channels)).toBe('geral')
  })

  it('sem canal de texto não há principal', () => {
    expect(primaryChannelId({}, [{ id: 'voz', type: 'voice' }])).toBeNull()
    expect(primaryChannelId(null, [])).toBeNull()
  })
})
