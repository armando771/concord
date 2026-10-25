import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.hoisted(() => ({
  state: { type: null as 'channel' | 'dm' | null, status: 'idle', endCall: vi.fn() }
}))

vi.mock('./callStore', () => ({ useCallStore: { getState: () => call.state } }))

import { useUpdateStore } from './updateStore'

const install = vi.fn()

beforeEach(() => {
  useUpdateStore.setState(useUpdateStore.getInitialState())
  call.state = { type: null, status: 'idle', endCall: vi.fn() }
  install.mockClear()
  vi.stubGlobal('window', { api: { updates: { install } } })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('updateStore', () => {
  it('seed registra a versão (e se já baixou) sem tratar como nova', () => {
    useUpdateStore.getState().seed({ version: '1.2.0', ready: true })
    expect(useUpdateStore.getState().version).toBe('1.2.0')
    expect(useUpdateStore.getState().readyVersion).toBe('1.2.0')
    useUpdateStore.getState().seed(null)
    expect(useUpdateStore.getState().version).toBe('1.2.0')
  })

  it('setAvailable só devolve true na primeira vez de cada versão', () => {
    const { setAvailable } = useUpdateStore.getState()
    expect(setAvailable('1.2.0')).toBe(true)
    expect(setAvailable('1.2.0')).toBe(false)
    expect(setAvailable('1.3.0')).toBe(true)
  })

  it('versão já vista no seed não conta como nova', () => {
    useUpdateStore.getState().seed({ version: '1.2.0', ready: false })
    expect(useUpdateStore.getState().setAvailable('1.2.0')).toBe(false)
  })

  it('versão mais nova descarta a baixada e zera o progresso', () => {
    const s = useUpdateStore.getState()
    s.setAvailable('1.2.0')
    s.setReady('1.2.0')
    s.setProgress(80)
    useUpdateStore.getState().setAvailable('1.3.0')
    const next = useUpdateStore.getState()
    expect(next.version).toBe('1.3.0')
    expect(next.readyVersion).toBeNull()
    expect(next.progress).toBe(0)
  })

  it('erro cancela o pedido de instalação', () => {
    useUpdateStore.setState({ requested: true })
    useUpdateStore.getState().setError('falhou')
    expect(useUpdateStore.getState().requested).toBe(false)
    expect(useUpdateStore.getState().error).toBe('falhou')
  })

  it('install fora de chamada: pede e instala no próximo tick', () => {
    useUpdateStore.setState({ error: 'antigo', confirming: true })
    useUpdateStore.getState().install()
    expect(useUpdateStore.getState()).toMatchObject({
      requested: true,
      error: null,
      confirming: false
    })
    expect(call.state.endCall).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(0)
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('install em chamada de canal ativa: mantém a chamada e instala na hora', () => {
    call.state = { type: 'channel', status: 'active', endCall: vi.fn() }
    useUpdateStore.getState().install()
    expect(call.state.endCall).not.toHaveBeenCalled()
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('install em DM: encerra a chamada e espera 250 ms', () => {
    call.state = { type: 'dm', status: 'active', endCall: vi.fn() }
    useUpdateStore.getState().install()
    expect(call.state.endCall).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(249)
    expect(install).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('install na web (sem window.api.updates) não faz nada', () => {
    vi.stubGlobal('window', {})
    useUpdateStore.getState().install()
    expect(useUpdateStore.getState().requested).toBe(false)
    expect(call.state.endCall).not.toHaveBeenCalled()
  })
})
