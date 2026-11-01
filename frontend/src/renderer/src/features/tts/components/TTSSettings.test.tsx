import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { LocalTTSVoice } from '../hooks/useLocalTTSVoice'

const hooks = vi.hoisted(() => ({
  localVoice: null as LocalTTSVoice | null,
  voiceAvailable: null as boolean | null
}))
vi.mock('../hooks/useLocalTTSVoice', () => ({ useLocalTTSVoice: () => hooks.localVoice }))
vi.mock('../hooks/useTTSVoiceAvailable', () => ({
  useTTSVoiceAvailable: () => hooks.voiceAvailable
}))

import TTSSettings from './TTSSettings'

const NO_VOICE = 'Este aparelho não tem voz de leitura instalada'

describe('TTSSettings', () => {
  beforeEach(() => {
    hooks.localVoice = null
    hooks.voiceAvailable = null
  })

  it('Windows sem voz do sistema: aviso de sempre', () => {
    hooks.voiceAvailable = false
    expect(renderToStaticMarkup(<TTSSettings />)).toContain(NO_VOICE)
  })

  it('Windows com voz: sem aviso', () => {
    hooks.voiceAvailable = true
    expect(renderToStaticMarkup(<TTSSettings />)).not.toContain(NO_VOICE)
  })

  it('Linux: estado da voz baixada no lugar do aviso de voz do sistema', () => {
    hooks.voiceAvailable = false
    hooks.localVoice = { state: { status: 'downloading', percent: 10 }, prepare: vi.fn() }
    const html = renderToStaticMarkup(<TTSSettings />)
    expect(html).not.toContain(NO_VOICE)
    expect(html).toContain('Baixando a voz de leitura… 10%')
  })
})
