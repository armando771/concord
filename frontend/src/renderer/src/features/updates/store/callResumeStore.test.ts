import { describe, expect, it } from 'vitest'
import { useCallResumeStore } from './callResumeStore'

describe('callResumeStore', () => {
  it('sem a ponte de atualizações não há retomada a esperar', () => {
    expect(useCallResumeStore.getState().settled).toBe(true)
  })

  it('decidida, fica decidida', () => {
    useCallResumeStore.setState({ settled: false })
    useCallResumeStore.getState().markSettled()
    useCallResumeStore.getState().markSettled()
    expect(useCallResumeStore.getState().settled).toBe(true)
  })
})
