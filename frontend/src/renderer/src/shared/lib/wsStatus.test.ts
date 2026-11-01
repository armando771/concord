import { describe, expect, it } from 'vitest'
import {
  connectionBanner,
  INITIAL_WS_STATUS,
  LOST_NOTICE_DELAY_MS,
  nextBannerChange,
  RECONNECTED_NOTICE_MS,
  RESTART_NOTICE_DELAY_MS,
  wsStatusReducer,
  type WsStatus,
  type WsStatusEvent
} from './wsStatus'

/** Aplica eventos em sequência, cada um na sua hora. */
function run(steps: [number, WsStatusEvent][], online = true): WsStatus {
  return steps.reduce(
    (status, [at, event]) => wsStatusReducer(status, event, at, online),
    INITIAL_WS_STATUS
  )
}

describe('connectionBanner', () => {
  it('sem sessão (idle) nunca avisa, nem offline', () => {
    expect(connectionBanner(INITIAL_WS_STATUS, false, 0)).toBeNull()
  })

  it('primeira conexão em andamento: sem aviso', () => {
    const status = run([[0, { type: 'connect' }]])
    expect(connectionBanner(status, true, 10_000)).toBeNull()
  })

  it('navegador offline vale mais que qualquer outro aviso', () => {
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [20, { type: 'lost', planned: true, attempt: 1 }]
    ])
    expect(connectionBanner(status, false, 20)).toEqual({ kind: 'offline' })
  })

  it('queda comum: avisa depois da tolerância, com o número da tentativa', () => {
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: false, attempt: 1 }]
    ])
    expect(connectionBanner(status, true, 100 + LOST_NOTICE_DELAY_MS - 1)).toBeNull()
    expect(connectionBanner(status, true, 100 + LOST_NOTICE_DELAY_MS)).toEqual({
      kind: 'lost',
      attempt: 1
    })
  })

  it('tentativas seguintes mantêm o início da queda e atualizam o número', () => {
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: false, attempt: 1 }],
      [1200, { type: 'lost', planned: false, attempt: 2 }],
      [3300, { type: 'lost', planned: false, attempt: 3 }]
    ])
    expect(status.lostAt).toBe(100)
    expect(connectionBanner(status, true, 3300)).toEqual({ kind: 'lost', attempt: 3 })
  })

  it('reinício do servidor (1012): só avisa "atualizando" se passar de ~3 s', () => {
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: true, attempt: 1 }]
    ])
    expect(connectionBanner(status, true, 100 + RESTART_NOTICE_DELAY_MS - 1)).toBeNull()
    expect(connectionBanner(status, true, 100 + RESTART_NOTICE_DELAY_MS)).toEqual({
      kind: 'restarting'
    })
  })

  it('volta rápida (deploy) não mostra "Reconectado"', () => {
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: true, attempt: 1 }],
      [400, { type: 'open' }]
    ])
    expect(status.reconnectedAt).toBeNull()
    expect(connectionBanner(status, true, 400)).toBeNull()
  })

  it('voltou depois de um aviso visível: "Reconectado" por um instante', () => {
    const back = 100 + LOST_NOTICE_DELAY_MS + 500
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: false, attempt: 1 }],
      [back, { type: 'open' }]
    ])
    expect(connectionBanner(status, true, back)).toEqual({ kind: 'reconnected' })
    expect(connectionBanner(status, true, back + RECONNECTED_NOTICE_MS - 1)).toEqual({
      kind: 'reconnected'
    })
    expect(connectionBanner(status, true, back + RECONNECTED_NOTICE_MS)).toBeNull()
  })

  it('a primeira conexão que falha também avisa', () => {
    const status = run([
      [0, { type: 'connect' }],
      [50, { type: 'lost', planned: false, attempt: 1 }]
    ])
    expect(connectionBanner(status, true, 50 + LOST_NOTICE_DELAY_MS)?.kind).toBe('lost')
  })

  it('stop (saiu da conta) limpa tudo; eventos atrasados não ressuscitam o aviso', () => {
    const stopped = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: false, attempt: 1 }],
      [200, { type: 'stop' }],
      [300, { type: 'lost', planned: false, attempt: 2 }]
    ])
    expect(stopped).toEqual(INITIAL_WS_STATUS)
    expect(connectionBanner(stopped, true, 10_000)).toBeNull()
  })
})

describe('nextBannerChange', () => {
  it('na queda: quando a tolerância acaba', () => {
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: false, attempt: 1 }]
    ])
    expect(nextBannerChange(status, true, 200)).toBe(100 + LOST_NOTICE_DELAY_MS)
    expect(nextBannerChange(status, true, 100 + LOST_NOTICE_DELAY_MS)).toBeNull()
  })

  it('no reinício: depois dos ~3 s', () => {
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: true, attempt: 1 }]
    ])
    expect(nextBannerChange(status, true, 100)).toBe(100 + RESTART_NOTICE_DELAY_MS)
  })

  it('"Reconectado": quando ele some', () => {
    const back = 100 + LOST_NOTICE_DELAY_MS
    const status = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }],
      [100, { type: 'lost', planned: false, attempt: 1 }],
      [back, { type: 'open' }]
    ])
    expect(nextBannerChange(status, true, back)).toBe(back + RECONNECTED_NOTICE_MS)
  })

  it('offline ou conectado sem aviso: nada a agendar', () => {
    const open = run([
      [0, { type: 'connect' }],
      [10, { type: 'open' }]
    ])
    expect(nextBannerChange(open, true, 20)).toBeNull()
    expect(nextBannerChange(open, false, 20)).toBeNull()
  })
})
