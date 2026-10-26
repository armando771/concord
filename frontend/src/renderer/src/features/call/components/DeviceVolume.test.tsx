import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  voice: {
    inputVolume: 0.8,
    outputVolume: 1.3,
    setInputVolume: vi.fn(),
    setOutputVolume: vi.fn()
  }
}))
vi.mock('../store/voiceAudioStore', () => ({
  useVoiceAudioStore: (sel: (s: typeof state.voice) => unknown) => sel(state.voice)
}))

import { renderToStaticMarkup } from 'react-dom/server'
import DeviceVolume from './DeviceVolume'

describe('DeviceVolume', () => {
  it('entrada usa o volume de entrada', () => {
    const html = renderToStaticMarkup(<DeviceVolume kind="input" />)
    expect(html).toContain('Volume de entrada')
    expect(html).toContain('80%')
  })

  it('saída usa o volume de saída', () => {
    const html = renderToStaticMarkup(<DeviceVolume kind="output" />)
    expect(html).toContain('Volume de saída')
    expect(html).toContain('130%')
  })
})
