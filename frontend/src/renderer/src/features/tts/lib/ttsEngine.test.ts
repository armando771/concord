import { describe, expect, it, vi } from 'vitest'
import { createWebSpeechSpeaker, pickVoice } from './ttsEngine'

interface FakeVoice {
  lang: string
  name: string
  default: boolean
}

const v = (lang: string, name = lang, isDefault = false): FakeVoice => ({
  lang,
  name,
  default: isDefault
})

describe('pickVoice', () => {
  it('prefere pt-BR, depois qualquer pt, depois a padrão do sistema', () => {
    expect(pickVoice([v('en-US'), v('pt-PT'), v('pt-BR')])?.lang).toBe('pt-BR')
    expect(pickVoice([v('en-US'), v('pt_BR')])?.lang).toBe('pt_BR')
    expect(pickVoice([v('en-US'), v('pt-PT')])?.lang).toBe('pt-PT')
    expect(pickVoice([v('en-US'), v('en-GB', 'x', true)])?.name).toBe('x')
    expect(pickVoice([v('en-US')])?.lang).toBe('en-US')
  })
  it('sem voz nenhuma, null (nada toca)', () => {
    expect(pickVoice([])).toBeNull()
  })
})

class FakeUtterance {
  text: string
  voice: unknown = null
  lang = ''
  volume = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- dublê de teste
function fakeSynth(voices: FakeVoice[]) {
  return {
    spoken: [] as FakeUtterance[],
    getVoices: () => voices,
    speak(u: FakeUtterance) {
      this.spoken.push(u)
    },
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}

describe('createWebSpeechSpeaker', () => {
  it('sem speechSynthesis (navegador sem suporte), null', () => {
    expect(createWebSpeechSpeaker({ synth: undefined, Utterance: undefined, volume: () => 1 })).toBeNull()
  })

  it('fala com a voz escolhida e o volume de saída (até 100%)', async () => {
    const synth = fakeSynth([v('pt-BR')])
    const sp = createWebSpeechSpeaker({ synth: synth as never, Utterance: FakeUtterance as never, volume: () => 1.5 })!
    const onEnd = vi.fn()
    sp.speak('oi', onEnd)
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1))
    const u = synth.spoken[0]
    expect(u.text).toBe('oi')
    expect(u.lang).toBe('pt-BR')
    expect(u.volume).toBe(1)
    u.onend?.()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('sem vozes instaladas não fala, mas solta a fila', async () => {
    vi.useFakeTimers()
    const synth = fakeSynth([])
    const sp = createWebSpeechSpeaker({ synth: synth as never, Utterance: FakeUtterance as never, volume: () => 1 })!
    const onEnd = vi.fn()
    sp.speak('oi', onEnd)
    await vi.advanceTimersByTimeAsync(2000)
    expect(synth.spoken).toHaveLength(0)
    expect(onEnd).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('fala que nunca avisa o fim não trava a fila', async () => {
    vi.useFakeTimers()
    const synth = fakeSynth([v('pt-BR')])
    const sp = createWebSpeechSpeaker({ synth: synth as never, Utterance: FakeUtterance as never, volume: () => 1 })!
    const onEnd = vi.fn()
    sp.speak('oi', onEnd)
    await vi.advanceTimersByTimeAsync(30000)
    expect(onEnd).toHaveBeenCalledTimes(1)
    synth.spoken[0].onend?.()
    expect(onEnd).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
