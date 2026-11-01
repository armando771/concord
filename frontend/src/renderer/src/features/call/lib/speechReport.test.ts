import { describe, expect, it } from 'vitest'
import { createSpeechReporter, isSelfSpeaking, SPEECH_REPORT_EVERY_MS, type SpeechView } from './speechReport'

const speaking: SpeechView = { callId: 'c1', status: 'active', meId: 'eu', muted: false, speakingIds: ['ana', 'eu'] }

describe('isSelfSpeaking', () => {
  it('só conta a própria fala, numa call ativa e sem mute', () => {
    expect(isSelfSpeaking(speaking)).toBe(true)
    expect(isSelfSpeaking({ ...speaking, speakingIds: ['ana'] })).toBe(false)
    expect(isSelfSpeaking({ ...speaking, muted: true })).toBe(false)
    expect(isSelfSpeaking({ ...speaking, status: 'ringing' })).toBe(false)
    expect(isSelfSpeaking({ ...speaking, callId: null })).toBe(false)
    expect(isSelfSpeaking({ ...speaking, meId: null })).toBe(false)
  })
})

describe('createSpeechReporter', () => {
  function setup(): { sent: string[]; observe: (v: SpeechView) => void; at: (ms: number) => void } {
    const sent: string[] = []
    let now = 0
    const reporter = createSpeechReporter({ send: (callId) => sent.push(callId), now: () => now })
    return { sent, observe: reporter.observe, at: (ms) => (now = ms) }
  }

  it('avisa ao começar a falar e no máximo um a cada 15 s', () => {
    const { sent, observe, at } = setup()
    observe(speaking)
    at(SPEECH_REPORT_EVERY_MS - 1)
    observe(speaking)
    expect(sent).toEqual(['c1'])
    at(SPEECH_REPORT_EVERY_MS)
    observe(speaking)
    expect(sent).toEqual(['c1', 'c1'])
  })

  it('calado não avisa nada', () => {
    const { sent, observe } = setup()
    observe({ ...speaking, speakingIds: [] })
    observe({ ...speaking, muted: true })
    expect(sent).toEqual([])
  })

  it('trocou de call: avisa a nova na hora', () => {
    const { sent, observe, at } = setup()
    observe(speaking)
    at(1000)
    observe({ ...speaking, callId: 'c2' })
    expect(sent).toEqual(['c1', 'c2'])
  })
})
