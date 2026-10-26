import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  call: { status: 'active' },
  mod: {
    preset: 'normal',
    customized: false,
    pitch: 0,
    timbre: 0,
    intensity: 1,
    available: true,
    monitoring: false,
    selectPreset: () => {},
    setPitch: () => {},
    setTimbre: () => {},
    setIntensity: () => {},
    setMonitoring: () => {}
  }
}))
vi.mock('../store/callStore', () => ({
  useCallStore: (sel: (s: typeof state.call) => unknown) => sel(state.call)
}))
vi.mock('../store/voiceModStore', () => ({
  useVoiceModStore: (sel: (s: typeof state.mod) => unknown) => sel(state.mod)
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { PRESET_ORDER, VOICE_MOD_PRESETS } from '../lib/voiceModPresets'
import VoiceModPanel from './VoiceModPanel'

const render = (): string => renderToStaticMarkup(<VoiceModPanel />)

describe('VoiceModPanel', () => {
  beforeEach(() => {
    state.call.status = 'active'
    Object.assign(state.mod, {
      preset: 'normal',
      customized: false,
      pitch: 0,
      available: true,
      monitoring: false
    })
  })

  it('mostra um botão por preset, com o escolhido marcado', () => {
    state.mod.preset = 'caverna'
    const html = render()
    expect(html.match(/role="radio"/g)).toHaveLength(PRESET_ORDER.length)
    for (const id of PRESET_ORDER) expect(html).toContain(`>${VOICE_MOD_PRESETS[id].label}<`)
    expect(html).toMatch(/aria-checked="true"[^>]*>Caverna</)
  })

  it('grade em 3 colunas no estreito e 4 quando o painel tem espaço', () => {
    const html = render()
    expect(html).toContain('@container')
    expect(html).toMatch(/grid-cols-3 [^"]*@xs:grid-cols-4/)
  })

  it('sem o worklet: avisa e desabilita presets e o monitor', () => {
    state.mod.available = false
    const html = render()
    expect(html).toContain('O voice mod não carregou neste PC')
    expect(html.match(/disabled=""/g)).toHaveLength(PRESET_ORDER.length + 1)
  })

  it('personalizado e tom positivo com sinal', () => {
    Object.assign(state.mod, { customized: true, pitch: 3 })
    const html = render()
    expect(html).toContain('Personalizado')
    expect(html).toContain('+3 st')
  })

  it('fora da chamada não dá para ouvir a própria voz', () => {
    state.call.status = 'idle'
    const html = render()
    expect(html).toContain('Entre numa chamada para ouvir.')
    expect(html).toMatch(/disabled=""[^>]*>Ouvir minha voz</)
  })

  it('ouvindo: o botão vira parar', () => {
    state.mod.monitoring = true
    const html = render()
    expect(html).toContain('Parar de ouvir')
    expect(html).toContain('Use fone para evitar eco.')
  })
})
