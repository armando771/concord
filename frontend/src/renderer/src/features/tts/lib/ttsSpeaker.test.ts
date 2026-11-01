import { describe, expect, it, vi } from 'vitest'
import { chooseTTSSpeaker } from './ttsSpeaker'
import type { TTSSpeaker } from './ttsQueue'

const webSpeaker: TTSSpeaker = { speak: vi.fn(), cancel: vi.fn() }

describe('chooseTTSSpeaker', () => {
  it('Windows, macOS e web (sem window.api.tts): Web Speech, como sempre', () => {
    const webSpeech = vi.fn(() => webSpeaker)
    expect(chooseTTSSpeaker({ local: undefined, webSpeech, play: vi.fn() })).toBe(webSpeaker)
    expect(webSpeech).toHaveBeenCalledTimes(1)
  })

  it('sem Web Speech nem voz local: null (nada toca)', () => {
    expect(chooseTTSSpeaker({ local: undefined, webSpeech: () => null, play: vi.fn() })).toBeNull()
  })

  it('app desktop no Linux: voz do Piper pelo main, sem tocar na Web Speech', async () => {
    const webSpeech = vi.fn(() => webSpeaker)
    const speak = vi.fn(async () => new Uint8Array([1]))
    const play = vi.fn(() => () => {})
    const speaker = chooseTTSSpeaker({ local: { speak }, webSpeech, play })!
    expect(webSpeech).not.toHaveBeenCalled()
    speaker.speak('oi', () => {})
    expect(speak).toHaveBeenCalledWith('oi')
    await vi.waitFor(() => expect(play).toHaveBeenCalled())
  })
})
