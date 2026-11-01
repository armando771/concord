import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => [] as string[])
const effects = vi.hoisted(() => [] as (() => (() => void) | void)[])
vi.mock('react', () => ({ useEffect: (fn: () => (() => void) | void) => effects.push(fn) }))
vi.mock('../store/sessionEnd', () => ({ endSessionState: () => calls.push('sessao.encerrada') }))
vi.mock('../../chat/store/chatStore', () => ({
  useChatStore: {
    getState: () => ({
      connect: () => calls.push('chat.connect'),
      disconnect: () => calls.push('chat.disconnect')
    })
  }
}))

import { useSessionConnection } from './useSessionConnection'

// Alias: aqui o hook roda fora de um componente, de propósito (o useEffect é simulado).
const runHook: (hasToken: boolean) => void = useSessionConnection

/** Roda o hook e devolve a limpeza do efeito (o que acontece ao perder a sessão). */
function mount(hasToken: boolean): () => void {
  const before = effects.length
  runHook(hasToken)
  return effects[before]() as () => void
}

describe('useSessionConnection', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('com sessão, liga o tempo real', () => {
    mount(true)
    expect(calls).toEqual(['chat.connect'])
  })

  it('sem sessão, não liga nada', () => {
    mount(false)
    expect(calls).toEqual([])
  })

  it('ao perder a sessão (token expirou), encerra a chamada antes de fechar o WebSocket', () => {
    const cleanup = mount(true)
    calls.length = 0
    cleanup()
    expect(calls).toEqual(['sessao.encerrada', 'chat.disconnect'])
  })
})
