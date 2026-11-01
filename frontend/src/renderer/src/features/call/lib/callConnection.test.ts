import { describe, expect, it } from 'vitest'
import { ConnectionError, ConnectionErrorReason, DisconnectReason } from 'livekit-client'
import {
  CALL_SLOW_MS,
  callConnectionReducer,
  callConnectionView,
  describeDisconnect,
  describeJoinError,
  describeTokenError,
  IDLE_CALL_CONNECTION,
  LK_CONNECTION_ERROR,
  LK_DISCONNECT,
  nextCallConnectionChange,
  UDP_BLOCKED_MESSAGE,
  type CallConnection,
  type CallConnectionEvent
} from './callConnection'

function run(steps: [number, CallConnectionEvent][]): CallConnection {
  return steps.reduce(
    (state, [at, event]) => callConnectionReducer(state, event, at),
    IDLE_CALL_CONNECTION
  )
}

describe('códigos do LiveKit', () => {
  it('os espelhos batem com os enums do SDK', () => {
    for (const [name, value] of Object.entries(LK_CONNECTION_ERROR)) {
      expect(ConnectionErrorReason[name as keyof typeof ConnectionErrorReason]).toBe(value)
    }
    for (const [name, value] of Object.entries(LK_DISCONNECT)) {
      expect(DisconnectReason[name as keyof typeof DisconnectReason]).toBe(value)
    }
  })
})

describe('callConnectionReducer', () => {
  it('entra: token → controle → mídia → conectada', () => {
    let state = run([[100, { type: 'start' }]])
    expect(state).toMatchObject({ phase: 'connecting', step: 'token', since: 100 })
    state = callConnectionReducer(state, { type: 'step', step: 'signal' }, 200)
    state = callConnectionReducer(state, { type: 'step', step: 'media' }, 300)
    // As etapas não reiniciam o relógio da demora.
    expect(state).toMatchObject({ phase: 'connecting', step: 'media', since: 100 })
    state = callConnectionReducer(state, { type: 'connected' }, 400)
    expect(state).toMatchObject({ phase: 'connected', step: null, since: 400 })
  })

  it('reconectando e de volta', () => {
    const state = run([
      [0, { type: 'start' }],
      [10, { type: 'connected' }],
      [20, { type: 'reconnecting' }]
    ])
    expect(state).toMatchObject({ phase: 'reconnecting', since: 20 })
    expect(callConnectionReducer(state, { type: 'reconnected' }, 30).phase).toBe('connected')
  })

  it('reconnecting só vale depois de conectada; etapa atrasada não volta a fase', () => {
    const connecting = run([[0, { type: 'start' }]])
    expect(callConnectionReducer(connecting, { type: 'reconnecting' }, 5)).toBe(connecting)
    const connected = callConnectionReducer(connecting, { type: 'connected' }, 10)
    expect(callConnectionReducer(connected, { type: 'step', step: 'media' }, 20)).toBe(connected)
  })

  it('falha guarda o motivo; tentar de novo recomeça do zero', () => {
    const failed = run([
      [0, { type: 'start' }],
      [50, { type: 'failed', error: 'x' }]
    ])
    expect(failed).toMatchObject({ phase: 'failed', error: 'x' })
    expect(callConnectionReducer(failed, { type: 'start' }, 60)).toMatchObject({
      phase: 'connecting',
      step: 'token',
      error: null,
      since: 60
    })
  })

  it('fora de chamada (idle) ignora conectada/falha atrasadas', () => {
    expect(callConnectionReducer(IDLE_CALL_CONNECTION, { type: 'connected' }, 1)).toBe(
      IDLE_CALL_CONNECTION
    )
    expect(callConnectionReducer(IDLE_CALL_CONNECTION, { type: 'failed', error: 'x' }, 1)).toBe(
      IDLE_CALL_CONNECTION
    )
  })
})

describe('callConnectionView', () => {
  it('conectando: fase clara, sem botões no começo', () => {
    const state = run([[0, { type: 'start' }]])
    expect(callConnectionView(state, 1000, true)).toEqual({
      heading: 'Conectando à chamada…',
      tone: 'pending',
      detail: null,
      offerRetry: false
    })
  })

  it('passou de ~10 s: diz por quê conforme a etapa e oferece tentar de novo / sair', () => {
    const base = run([[0, { type: 'start' }]])
    const at = (step: 'token' | 'signal' | 'media'): ReturnType<typeof callConnectionView> =>
      callConnectionView(callConnectionReducer(base, { type: 'step', step }, 1), CALL_SLOW_MS, true)
    expect(callConnectionView(base, CALL_SLOW_MS, true).detail).toMatch(/servidor está demorando/)
    expect(at('signal').detail).toMatch(/servidor de voz não responde/)
    expect(at('media').detail).toMatch(/UDP/)
    expect(at('media').offerRetry).toBe(true)
  })

  it('offline: avisa logo, sem esperar os 10 s', () => {
    const state = run([[0, { type: 'start' }]])
    expect(callConnectionView(state, 100, false).detail).toMatch(/sem internet/)
  })

  it('reconectando: estado visível; depois de ~10 s explica e oferece sair', () => {
    const state = run([
      [0, { type: 'start' }],
      [1, { type: 'connected' }],
      [1000, { type: 'reconnecting' }]
    ])
    expect(callConnectionView(state, 2000, true)).toMatchObject({
      heading: 'Reconectando à chamada…',
      detail: null,
      offerRetry: false
    })
    expect(callConnectionView(state, 1000 + CALL_SLOW_MS, true)).toMatchObject({
      offerRetry: true,
      detail: expect.stringMatching(/instável/)
    })
  })

  it('falhou: mostra o erro e as ações', () => {
    const state = run([
      [0, { type: 'start' }],
      [5, { type: 'failed', error: UDP_BLOCKED_MESSAGE }]
    ])
    expect(callConnectionView(state, 6, true)).toEqual({
      heading: 'Falha na conexão de voz',
      tone: 'error',
      detail: UDP_BLOCKED_MESSAGE,
      offerRetry: true
    })
  })

  it('idle (mídia ainda não começou): conectando, sem contar como lento', () => {
    expect(callConnectionView(IDLE_CALL_CONNECTION, 1_000_000, true)).toMatchObject({
      heading: 'Conectando à chamada…',
      detail: null,
      offerRetry: false
    })
  })

  it('conectada: "Voz conectada"', () => {
    const state = run([
      [0, { type: 'start' }],
      [5, { type: 'connected' }]
    ])
    expect(callConnectionView(state, 60_000, true)).toMatchObject({
      heading: 'Voz conectada',
      tone: 'ok',
      offerRetry: false
    })
  })
})

describe('nextCallConnectionChange', () => {
  it('agenda a virada para "lento" só enquanto conecta/reconecta', () => {
    const connecting = run([[100, { type: 'start' }]])
    expect(nextCallConnectionChange(connecting, 200)).toBe(100 + CALL_SLOW_MS)
    expect(nextCallConnectionChange(connecting, 100 + CALL_SLOW_MS)).toBeNull()
    const connected = callConnectionReducer(connecting, { type: 'connected' }, 300)
    expect(nextCallConnectionChange(connected, 300)).toBeNull()
  })
})

describe('describeJoinError', () => {
  it('conexão WebRTC que não abre (UDP bloqueado)', () => {
    const err = ConnectionError.internal('could not establish pc connection')
    expect(describeJoinError(err, true)).toBe(UDP_BLOCKED_MESSAGE)
  })

  it('servidor inalcançável, tempo esgotado e recusa', () => {
    expect(
      describeJoinError(
        ConnectionError.serverUnreachable('could not establish signal connection'),
        true
      )
    ).toMatch(/alcançar o servidor de voz/)
    expect(describeJoinError(ConnectionError.timeout('t'), true)).toMatch(/demorou demais/)
    expect(describeJoinError(ConnectionError.notAllowed('n', 401), true)).toMatch(/recusou/)
  })

  it('cancelado por nós (saiu / tentou de novo): nada a mostrar', () => {
    expect(describeJoinError(ConnectionError.cancelled('c'), true)).toBeNull()
  })

  it('servidor pediu para sair durante a entrada: usa o motivo', () => {
    const err = ConnectionError.leaveRequest('l', DisconnectReason.DUPLICATE_IDENTITY)
    expect(describeJoinError(err, true)).toMatch(/outra janela/)
  })

  it('sem internet: diz isso, em vez de um erro genérico', () => {
    expect(describeJoinError(new Error('x'), false)).toBe('Você está sem internet.')
    expect(describeJoinError(new Error('x'), true)).toMatch(/Não foi possível conectar/)
  })
})

describe('describeDisconnect', () => {
  it('traduz os motivos comuns', () => {
    expect(describeDisconnect(DisconnectReason.DUPLICATE_IDENTITY, true)).toMatch(/outra janela/)
    expect(describeDisconnect(DisconnectReason.SERVER_SHUTDOWN, true)).toMatch(/reiniciou/)
    expect(describeDisconnect(DisconnectReason.ROOM_DELETED, true)).toMatch(/encerrada/)
    expect(describeDisconnect(DisconnectReason.JOIN_FAILURE, true)).toBe(UDP_BLOCKED_MESSAGE)
    expect(describeDisconnect(DisconnectReason.SIGNAL_CLOSE, true)).toMatch(/caiu e não voltou/)
    expect(describeDisconnect(undefined, false)).toMatch(/sem internet/)
  })
})

describe('describeTokenError', () => {
  it('sem resposta, sem acesso, chamada acabou', () => {
    expect(describeTokenError(0, true)).toMatch(/não respondeu/)
    expect(describeTokenError(403, true)).toMatch(/não tem mais acesso/)
    expect(describeTokenError(404, true)).toMatch(/já terminou/)
    expect(describeTokenError(500, false)).toBe('Você está sem internet.')
  })
})
