import { describe, expect, it } from 'vitest'
import { resolveServerChannel } from './serverChannel'

const ch = (
  id: string,
  server_id: string,
  type = 'text',
  created_at = '2026-01-01T00:00:00Z'
): { id: string; server_id: string; type: string; created_at: string } => ({
  id,
  server_id,
  type,
  created_at
})

describe('resolveServerChannel', () => {
  const a = [ch('a1', 'A')]
  const b = [
    ch('b-voz', 'B', 'voice'),
    ch('b1', 'B'),
    ch('b2', 'B', 'text', '2026-02-01T00:00:00Z')
  ]

  it('ignora canais de outro servidor (lista ainda do servidor anterior)', () => {
    expect(resolveServerChannel('B', { id: 'B' }, a)).toBeNull()
  })

  it('usa o último visitado quando ele ainda existe', () => {
    expect(resolveServerChannel('B', { id: 'B' }, b, 'b2')).toBe('b2')
  })

  it('descarta último visitado inexistente, de voz ou de outro servidor', () => {
    expect(resolveServerChannel('B', { id: 'B' }, b, 'gone')).toBe('b1')
    expect(resolveServerChannel('B', { id: 'B' }, b, 'b-voz')).toBe('b1')
    expect(resolveServerChannel('B', { id: 'B' }, [...a, ...b], 'a1')).toBe('b1')
  })

  it('sem histórico usa o canal principal, senão o primeiro de texto', () => {
    expect(resolveServerChannel('B', { id: 'B', primary_channel_id: 'b2' }, b)).toBe('b2')
    expect(resolveServerChannel('B', { id: 'B' }, b)).toBe('b1')
  })

  it('ignora o canal principal de um servidor que ainda é o anterior', () => {
    expect(resolveServerChannel('B', { id: 'A', primary_channel_id: 'a1' }, b)).toBe('b1')
  })

  it('servidor só com voz não tem canal de texto', () => {
    expect(resolveServerChannel('B', { id: 'B' }, [ch('v', 'B', 'voice')])).toBeNull()
  })
})
