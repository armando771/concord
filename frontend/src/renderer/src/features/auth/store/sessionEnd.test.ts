import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => [] as string[])
const track = (name: string) => (): void => {
  calls.push(name)
}
vi.mock('../../call/store/callStore', () => ({
  useCallStore: { getState: () => ({ endCall: track('call.endCall') }) }
}))
vi.mock('../../chat/store/searchStore', () => ({
  useSearchStore: { getState: () => ({ close: track('search.close') }) }
}))
vi.mock('../../chat/store/draftStore', () => ({
  useDraftStore: { getState: () => ({ clear: track('drafts.clear') }) }
}))

import { endSessionState } from './sessionEnd'

describe('endSessionState', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('encerra a chamada, fecha a busca e apaga os rascunhos da conta que saiu', () => {
    endSessionState()
    expect(calls).toEqual(['call.endCall', 'search.close', 'drafts.clear'])
  })

  it('a chamada é a primeira coisa: o aviso de saída ainda precisa do WebSocket aberto', () => {
    endSessionState()
    expect(calls[0]).toBe('call.endCall')
  })

  it('pode rodar duas vezes (logout e perda do token) sem problema', () => {
    endSessionState()
    expect(() => endSessionState()).not.toThrow()
  })
})
