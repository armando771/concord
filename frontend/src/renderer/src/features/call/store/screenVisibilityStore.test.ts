import { beforeEach, describe, expect, it } from 'vitest'
import { useScreenVisibilityStore } from './screenVisibilityStore'

describe('screenVisibilityStore', () => {
  beforeEach(() => useScreenVisibilityStore.setState({ elements: {} }))

  it('registra cada <video> de live, atualiza e esquece ao desmontar', () => {
    const store = useScreenVisibilityStore.getState()
    store.report('v1', 'bia', true)
    const before = useScreenVisibilityStore.getState().elements
    store.report('v1', 'bia', true)
    expect(useScreenVisibilityStore.getState().elements).toBe(before)
    store.report('v1', 'bia', false)
    expect(useScreenVisibilityStore.getState().elements).toEqual({
      v1: { userId: 'bia', visible: false }
    })
    store.remove('v1')
    store.remove('v1')
    expect(useScreenVisibilityStore.getState().elements).toEqual({})
  })
})
