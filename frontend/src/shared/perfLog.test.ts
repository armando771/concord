import { describe, expect, it } from 'vitest'
import { normalizeRoute, parsePerfEvent } from './perfLog'

describe('normalizeRoute', () => {
  it('troca UUIDs e números por :id', () => {
    expect(normalizeRoute('/channels/3f2c9a10-1b2c-4d3e-8f90-a1b2c3d4e5f6/42')).toBe(
      '/channels/:id/:id'
    )
  })

  it('mantém segmentos fixos', () => {
    expect(normalizeRoute('/servers')).toBe('/servers')
  })

  it('descarta query e hash', () => {
    expect(normalizeRoute('/friends?x=1#topo')).toBe('/friends')
  })

  // Tabela das rotas reais de app/router.tsx: nenhum identificador pode sobrar.
  it.each([
    ['/', '/'],
    ['/friends', '/friends'],
    ['/proposals', '/proposals'],
    ['/changelog', '/changelog'],
    ['/login', '/login'],
    ['/reset-password', '/reset-password'],
    ['/verify-email', '/verify-email'],
    ['/dm/3f2c9a10-1b2c-4d3e-8f90-a1b2c3d4e5f6', '/dm/:id'],
    ['/dm/c/3f2c9a10-1b2c-4d3e-8f90-a1b2c3d4e5f6', '/dm/c/:id'],
    ['/servers/42', '/servers/:id'],
    ['/servers/42/channels/7', '/servers/:id/channels/:id']
  ])('rota real %s vira %s', (route, expected) => {
    expect(normalizeRoute(route)).toBe(expected)
  })

  it.each(['K7PQ4XMD', 'ABCDEFGH', 'xyz', 'a1'])(
    'código de convite %s (8 caracteres, com ou sem dígito) nunca sobra',
    (code) => {
      expect(normalizeRoute(`/convite/${code}`)).toBe('/convite/:id')
    }
  )

  it('rota desconhecida falha para o lado seguro: o segmento vira :id', () => {
    expect(normalizeRoute('/segredo/maria-da-silva')).toBe('/:id/:id')
  })

  it('é idempotente', () => {
    expect(normalizeRoute('/channels/:id')).toBe('/channels/:id')
  })
})

describe('parsePerfEvent', () => {
  const ctx = { route: '/channels/42', inCall: true, sharing: false, watching: false }

  it('aceita um relatório válido e normaliza a rota', () => {
    const loaf = { count: 1, maxMs: 80, totalMs: 80 }
    expect(parsePerfEvent({ kind: 'report', ctx, fps: 59.5, loaf })).toEqual({
      kind: 'report',
      ctx: { ...ctx, route: '/channels/:id' },
      fps: 59.5,
      loaf
    })
  })

  it('fps e loaf inválidos viram null, sem rejeitar o relatório', () => {
    const parsed = parsePerfEvent({ kind: 'report', ctx, fps: -1, loaf: { count: 'x' } })
    expect(parsed).toMatchObject({ kind: 'report', fps: null, loaf: null })
  })

  it('aceita o marco usable', () => {
    expect(parsePerfEvent({ kind: 'mark', name: 'usable' })).toEqual({
      kind: 'mark',
      name: 'usable'
    })
  })

  it.each([
    null,
    'texto',
    {},
    { kind: 'mark', name: 'outro' },
    { kind: 'report' },
    { kind: 'report', ctx: { route: 1 } }
  ])('rejeita %j', (raw) => {
    expect(parsePerfEvent(raw)).toBeNull()
  })

  it('corta rotas enormes', () => {
    const parsed = parsePerfEvent({ kind: 'report', ctx: { ...ctx, route: '/c'.repeat(300) } })
    expect(parsed?.kind === 'report' && parsed.ctx.route.length).toBe(200)
  })
})
