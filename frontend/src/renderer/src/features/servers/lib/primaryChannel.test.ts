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

  it('sem escolha vale o canal de texto mais antigo, não o primeiro da barra', () => {
    // "memes" foi arrastado para o topo, mas "geral" é mais antigo.
    const reordered = [
      // Formato do Go: fração sem zeros à direita e fuso -03:00.
      { id: 'memes', type: 'text', created_at: '2026-01-01T10:00:00.5-03:00' },
      { id: 'geral', type: 'text', created_at: '2026-01-01T10:00:00.123456-03:00' }
    ]
    expect(primaryChannelId({}, reordered)).toBe('geral')
    expect(primaryChannelId({ primary_channel_id: 'apagado' }, reordered)).toBe('geral')
  })

  it('sem canal de texto não há principal', () => {
    expect(primaryChannelId({}, [{ id: 'voz', type: 'voice' }])).toBeNull()
    expect(primaryChannelId(null, [])).toBeNull()
  })
})
