import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeakingReporter } from './speakingReporter'

describe('createSpeakingReporter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('avisa na hora quando começa a falar, uma vez só', () => {
    const send = vi.fn()
    const r = createSpeakingReporter(send)
    r.update(true)
    r.update(true)
    expect(send.mock.calls).toEqual([[true]])
  })

  it('só avisa que parou depois do silêncio', () => {
    const send = vi.fn()
    const r = createSpeakingReporter(send, 1500)
    r.update(true)
    r.update(false)
    vi.advanceTimersByTime(1000)
    expect(send.mock.calls).toEqual([[true]])
    vi.advanceTimersByTime(600)
    expect(send.mock.calls).toEqual([[true], [false]])
  })

  it('pausa curta não manda nada', () => {
    const send = vi.fn()
    const r = createSpeakingReporter(send, 1500)
    r.update(true)
    r.update(false)
    vi.advanceTimersByTime(800)
    r.update(true)
    vi.advanceTimersByTime(5000)
    expect(send.mock.calls).toEqual([[true]])
  })

  it('silêncio sem ter falado e reset não avisam', () => {
    const send = vi.fn()
    const r = createSpeakingReporter(send, 1500)
    r.update(false)
    r.update(true)
    r.reset()
    vi.advanceTimersByTime(5000)
    r.update(false)
    vi.advanceTimersByTime(5000)
    expect(send.mock.calls).toEqual([[true]])
  })
})
