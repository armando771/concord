import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUpdateCheckGate } from './updateCheck'

/** Checagem controlada pelo teste: só termina quando `finish()` é chamado. */
function pendingCheck(): { check: ReturnType<typeof vi.fn>; finish: () => Promise<void> } {
  let resolve: () => void = () => {}
  const check = vi.fn(
    () =>
      new Promise<void>((r) => {
        resolve = r
      })
  )
  return {
    check,
    finish: async () => {
      resolve()
      await Promise.resolve()
      await Promise.resolve()
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createUpdateCheckGate', () => {
  it('pedido de fora checa depois do debounce', () => {
    const { check } = pendingCheck()
    const gate = createUpdateCheckGate(check, 1000)
    gate.request()
    expect(check).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('rajada de pedidos vira uma checagem só', () => {
    const { check } = pendingCheck()
    const gate = createUpdateCheckGate(check, 1000)
    gate.request()
    vi.advanceTimersByTime(500)
    gate.request()
    vi.advanceTimersByTime(500)
    gate.request()
    vi.advanceTimersByTime(1000)
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('com uma checagem em andamento, pedido novo não faz nada', async () => {
    const { check, finish } = pendingCheck()
    const gate = createUpdateCheckGate(check, 1000)
    gate.run()
    gate.request()
    vi.advanceTimersByTime(5000)
    gate.run()
    expect(check).toHaveBeenCalledTimes(1)

    // Terminou: volta a aceitar.
    await finish()
    gate.request()
    vi.advanceTimersByTime(1000)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('debounce que vence durante uma checagem em andamento não empilha outra', async () => {
    const { check, finish } = pendingCheck()
    const gate = createUpdateCheckGate(check, 1000)
    gate.request()
    gate.run() // periódica começou antes do debounce vencer
    vi.advanceTimersByTime(1000)
    expect(check).toHaveBeenCalledTimes(1)
    await finish()
  })

  it('checagem que falha libera a próxima', async () => {
    const check = vi.fn(async () => {
      throw new Error('offline')
    })
    const gate = createUpdateCheckGate(check, 1000)
    gate.run()
    await Promise.resolve()
    await Promise.resolve()
    gate.run()
    expect(check).toHaveBeenCalledTimes(2)
  })
})
