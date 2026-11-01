import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: toast }))
const sounds = vi.hoisted(() => ({ playSound: vi.fn() }))
vi.mock('../lib/sounds', () => sounds)

import { createKnockEventHandlers } from './knockWsEvents'
import type { CallState } from './callStore'

function setup(knock: CallState['knock']) {
  let state = { knock } as CallState
  const set = (u: Partial<CallState> | ((s: CallState) => Partial<CallState>)): void => {
    state = { ...state, ...(typeof u === 'function' ? u(state) : u) }
  }
  const handlers = createKnockEventHandlers({ get: () => state, set })
  return { handlers, state: () => state }
}

const pending = { channelId: 'c1', callId: 'call-1', status: 'pending' as const }

describe('call:knock_declined (resposta ao meu pedido)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('recusado: marca o pedido e limpa o aviso depois de alguns segundos', () => {
    const { handlers, state } = setup(pending)
    handlers['call:knock_declined']({ call_id: 'call-1', reason: 'declined' })
    expect(state().knock?.status).toBe('declined')
    vi.advanceTimersByTime(4000)
    expect(state().knock).toBeNull()
  })

  it('sala destrancada: pedido some na hora e avisa que a sala está livre', () => {
    const { handlers, state } = setup(pending)
    handlers['call:knock_declined']({ call_id: 'call-1', reason: 'unlocked' })
    expect(state().knock).toBeNull()
    expect(toast.info).toHaveBeenCalledWith('A sala foi destrancada!')
  })

  it('chamada encerrada: avisa que a sala está livre', () => {
    const { handlers } = setup(pending)
    handlers['call:knock_declined']({ call_id: 'call-1', reason: 'ended' })
    expect(toast.info).toHaveBeenCalledWith('A chamada terminou. A sala agora está livre.')
  })

  it('resposta de outra chamada é ignorada', () => {
    const { handlers, state } = setup(pending)
    handlers['call:knock_declined']({ call_id: 'outra', reason: 'declined' })
    expect(state().knock?.status).toBe('pending')
  })
})

describe('call:knock_error', () => {
  it('mostra a mensagem do servidor, ou uma padrão', () => {
    const { handlers } = setup(null)
    handlers['call:knock_error']({ message: 'Sem permissão' })
    handlers['call:knock_error']({})
    expect(toast.error).toHaveBeenCalledWith('Sem permissão')
    expect(toast.error).toHaveBeenCalledWith('Não foi possível solicitar entrada.')
  })
})

describe('call:lock (trancar/destrancar a sala em que estou)', () => {
  beforeEach(() => vi.clearAllMocks())

  function inCall(over: Partial<CallState>) {
    let state = {
      callId: 'call-1',
      locked: false,
      serverCalls: {},
      muted: false,
      deafened: false,
      ...over
    } as CallState
    const set = (u: Partial<CallState> | ((s: CallState) => Partial<CallState>)): void => {
      state = { ...state, ...(typeof u === 'function' ? u(state) : u) }
    }
    return { handlers: createKnockEventHandlers({ get: () => state, set }), state: () => state }
  }
  const lock = {
    call_id: 'call-1',
    locked: true,
    by: { id: 'u2', display_name: 'Ana', username: 'ana' }
  }

  it('ouvindo e com o microfone aberto: toca o som e marca a sala', () => {
    const { handlers, state } = inCall({})
    handlers['call:lock'](lock)
    expect(sounds.playSound).toHaveBeenCalledWith('lock')
    expect(state().locked).toBe(true)
  })

  it('mutado: marca a sala, mas não toca o som de trancar nem o de destrancar (#360)', () => {
    const { handlers, state } = inCall({ muted: true })
    handlers['call:lock'](lock)
    handlers['call:lock']({ ...lock, locked: false })
    expect(sounds.playSound).not.toHaveBeenCalled()
    expect(state().locked).toBe(false)
  })

  it('ensurdecido: não toca o som', () => {
    const { handlers } = inCall({ deafened: true })
    handlers['call:lock'](lock)
    expect(sounds.playSound).not.toHaveBeenCalled()
  })
})
