import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_BADGE_MS,
  EMPTY_ARRIVALS,
  REJOIN_IGNORE_MS,
  STALE_SNAPSHOT_MS,
  ingestSnapshot,
  isArrivalActive,
  nextExpiry,
  pruneExpired,
  recordJoin,
  recordLeave,
  resetBaseline,
  voiceMembers
} from './recentArrivals'

const ME = 'eu'
const T0 = 1_000_000

describe('voiceMembers', () => {
  it('lê quem está em cada canal de voz', () => {
    const calls = {
      c1: { call: null, participants: [{ user_id: 'ana' }, { user_id: 'bia' }] },
      c2: { call: null, participants: [] }
    }
    expect(voiceMembers(calls as never)).toEqual({ c1: ['ana', 'bia'], c2: [] })
  })
})

describe('ingestSnapshot', () => {
  it('a primeira lista é só a base: ninguém ganha selo', () => {
    const s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: ['ana', 'bia'] }, ME, T0)
    expect(s.arrivals).toEqual({})
    expect(s.snapshot?.members).toEqual({ c1: ['ana', 'bia'] })
  })

  it('quem aparece numa lista seguinte ganha selo por 5 s', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: ['ana'] }, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: ['ana', 'bia'] }, ME, T0 + 10_000)
    expect(s.arrivals).toEqual({ c1: { bia: T0 + 10_000 + ARRIVAL_BADGE_MS } })
  })

  it('canal de voz que acabou de ganhar a primeira pessoa também conta', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', {}, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: ['ana'] }, ME, T0 + 5000)
    expect(isArrivalActive(s.arrivals, 'c1', 'ana', T0 + 5000)).toBe(true)
  })

  it('eu mesmo nunca ganho selo', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: [] }, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: [ME] }, ME, T0 + 5000)
    expect(s.arrivals).toEqual({})
  })

  it('quem troca de canal de voz chegou no canal novo', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: ['ana'], c2: ['bia'] }, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: [], c2: ['bia', 'ana'] }, ME, T0 + 5000)
    expect(isArrivalActive(s.arrivals, 'c2', 'ana', T0 + 5000)).toBe(true)
    expect(isArrivalActive(s.arrivals, 'c1', 'ana', T0 + 5000)).toBe(false)
  })

  it('trocar de servidor recomeça a base: ninguém ganha selo', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv1', { c1: ['ana'] }, ME, T0)
    s = ingestSnapshot(s, 'srv2', { c9: ['bia', 'cai'] }, ME, T0 + 5000)
    expect(s.arrivals).toEqual({})
  })

  it('lista velha demais (aba parada, computador dormiu) vira nova base', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: ['ana'] }, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: ['ana', 'bia'] }, ME, T0 + STALE_SNAPSHOT_MS + 1)
    expect(s.arrivals).toEqual({})
  })

  it('depois de resetBaseline (websocket reconectou) a próxima lista é base', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: ['ana'] }, ME, T0)
    s = resetBaseline(s)
    s = ingestSnapshot(s, 'srv', { c1: ['ana', 'bia'] }, ME, T0 + 2000)
    expect(s.arrivals).toEqual({})
    s = ingestSnapshot(s, 'srv', { c1: ['ana', 'bia', 'cai'] }, ME, T0 + 12_000)
    expect(isArrivalActive(s.arrivals, 'c1', 'cai', T0 + 12_000)).toBe(true)
  })

  it('quem sai e volta ao mesmo canal logo em seguida não ganha selo', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: ['ana', 'bia'] }, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: ['ana'] }, ME, T0 + 3000)
    s = ingestSnapshot(s, 'srv', { c1: ['ana', 'bia'] }, ME, T0 + 6000)
    expect(s.arrivals).toEqual({})
  })

  it('volta depois da janela de reconexão: ganha selo', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: ['ana', 'bia'] }, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: ['ana'] }, ME, T0 + 3000)
    const back = T0 + 3000 + REJOIN_IGNORE_MS + 1
    s = ingestSnapshot(s, 'srv', { c1: ['ana', 'bia'] }, ME, back)
    expect(isArrivalActive(s.arrivals, 'c1', 'bia', back)).toBe(true)
  })

  it('quem saiu perde o selo que ainda tinha', () => {
    let s = ingestSnapshot(EMPTY_ARRIVALS, 'srv', { c1: [] }, ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: ['ana'] }, ME, T0 + 1000)
    s = ingestSnapshot(s, 'srv', { c1: [] }, ME, T0 + 2000)
    expect(isArrivalActive(s.arrivals, 'c1', 'ana', T0 + 2000)).toBe(false)
  })

  it('não renova o selo de quem já o tem', () => {
    let s = recordJoin(EMPTY_ARRIVALS, 'c1', 'ana', ME, T0)
    s = ingestSnapshot(s, 'srv', { c1: [] }, ME, T0 + 1000)
    s = ingestSnapshot(s, 'srv', { c1: ['ana'] }, ME, T0 + 2000)
    expect(s.arrivals.c1.ana).toBe(T0 + ARRIVAL_BADGE_MS)
  })
})

describe('recordJoin / recordLeave (eventos da minha call)', () => {
  it('quem entra na minha call ganha selo', () => {
    const s = recordJoin(EMPTY_ARRIVALS, 'c1', 'ana', ME, T0)
    expect(isArrivalActive(s.arrivals, 'c1', 'ana', T0 + ARRIVAL_BADGE_MS - 1)).toBe(true)
  })

  it('eu não ganho selo', () => {
    expect(recordJoin(EMPTY_ARRIVALS, 'c1', ME, ME, T0).arrivals).toEqual({})
  })

  it('saiu e voltou rápido (queda de rede): sem selo', () => {
    let s = recordLeave(EMPTY_ARRIVALS, 'c1', 'ana', T0)
    s = recordJoin(s, 'c1', 'ana', ME, T0 + 4000)
    expect(s.arrivals).toEqual({})
  })

  it('sair tira o selo', () => {
    let s = recordJoin(EMPTY_ARRIVALS, 'c1', 'ana', ME, T0)
    s = recordLeave(s, 'c1', 'ana', T0 + 1000)
    expect(s.arrivals).toEqual({})
  })

  it('esquece saídas antigas', () => {
    let s = recordLeave(EMPTY_ARRIVALS, 'c1', 'ana', T0)
    s = recordLeave(s, 'c2', 'bia', T0 + REJOIN_IGNORE_MS + 1)
    expect(s.departures).toEqual({ c2: { bia: T0 + REJOIN_IGNORE_MS + 1 } })
  })
})

describe('validade', () => {
  it('isArrivalActive: vale até o fim da janela, depois não', () => {
    const s = recordJoin(EMPTY_ARRIVALS, 'c1', 'ana', ME, T0)
    expect(isArrivalActive(s.arrivals, 'c1', 'ana', T0 + ARRIVAL_BADGE_MS)).toBe(false)
    expect(isArrivalActive(s.arrivals, 'c2', 'ana', T0)).toBe(false)
  })

  it('pruneExpired remove os vencidos e o canal vazio', () => {
    let s = recordJoin(EMPTY_ARRIVALS, 'c1', 'ana', ME, T0)
    s = recordJoin(s, 'c1', 'bia', ME, T0 + 3000)
    s = pruneExpired(s, T0 + ARRIVAL_BADGE_MS)
    expect(s.arrivals).toEqual({ c1: { bia: T0 + 3000 + ARRIVAL_BADGE_MS } })
    s = pruneExpired(s, T0 + 3000 + ARRIVAL_BADGE_MS)
    expect(s.arrivals).toEqual({})
  })

  it('nextExpiry: o vencimento mais próximo, ou null', () => {
    expect(nextExpiry({})).toBeNull()
    let s = recordJoin(EMPTY_ARRIVALS, 'c1', 'ana', ME, T0)
    s = recordJoin(s, 'c2', 'bia', ME, T0 + 1000)
    expect(nextExpiry(s.arrivals)).toBe(T0 + ARRIVAL_BADGE_MS)
  })
})
