import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  call: {
    muted: false,
    deafened: false,
    isScreenSharing: false,
    status: 'active',
    canSpeak: true,
    canStream: true,
    type: 'channel',
    localCameraStream: null as unknown,
    locked: false,
    toggleLock: vi.fn(),
    toggleMute: vi.fn(),
    toggleDeafen: vi.fn(),
    toggleCamera: vi.fn(),
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    endCall: vi.fn()
  }
}))
vi.mock('../../store/callStore', () => ({
  useCallStore: (sel: (s: typeof state.call) => unknown) => sel(state.call)
}))
vi.mock('../../store/activityStore', () => ({
  useActivityStore: (sel: (s: { shared: null; local: null }) => unknown) =>
    sel({ shared: null, local: null })
}))
vi.mock('../../store/voiceModStore', () => ({ useVoiceModStore: () => false }))
vi.mock('../../lib/voiceModPresets', () => ({ isVoiceModActive: () => false }))
// Só aparecem abertos (com a âncora); aqui bastam como stubs.
vi.mock('./SoundboardPopover', () => ({ default: () => null }))
vi.mock('./ActivityPickerPopover', () => ({ default: () => null }))
vi.mock('./AudioDeviceMenu', () => ({ default: () => null }))
vi.mock('./ScreenQualityPopover', () => ({
  default: ({ children }: { children: React.ReactNode }) => children
}))

import { renderToStaticMarkup } from 'react-dom/server'
import VoiceControls from './VoiceControls'

const render = (): string => renderToStaticMarkup(<VoiceControls />)

/** Texto do botão (aria-label) que fica logo antes da setinha `chevron`. */
const before = (html: string, chevron: string): string => {
  const i = html.indexOf(`aria-label="${chevron}"`)
  expect(i, chevron).toBeGreaterThan(-1)
  return html.slice(0, i)
}

describe('VoiceControls — setas de dispositivo (como no Discord)', () => {
  beforeEach(() => {
    state.call.status = 'active'
    state.call.localCameraStream = null
  })

  it('microfone, fone e câmera têm a seta que abre o menu', () => {
    const html = render()
    for (const label of ['Opções de entrada', 'Opções de saída', 'Opções de câmera']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(3)
    expect(html.match(/aria-expanded="false"/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('cada seta fica logo depois do botão dela', () => {
    const html = render()
    expect(before(html, 'Opções de entrada')).toMatch(/Silenciar Microfone[^]*$/)
    expect(before(html, 'Opções de saída')).toMatch(/Silenciar Audio[^]*$/)
    expect(before(html, 'Opções de câmera')).toMatch(/Ligar câmera[^]*$/)
  })

  it('a ordem do dock continua: mic, fone, câmera, tela, trancar, mesa, atividades, desconectar', () => {
    const html = render()
    const order = [
      'Silenciar Microfone',
      'Silenciar Audio',
      'Ligar câmera',
      'Compartilhar tela',
      'Trancar sala',
      'Mesa de Áudio',
      'Atividades',
      'Desconectar'
    ].map((l) => html.indexOf(l))
    expect(order.every((i) => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('com a câmera ligada o botão vira "Desligar câmera" e a seta continua lá', () => {
    state.call.localCameraStream = {}
    const html = render()
    expect(html).toContain('Desligar câmera')
    expect(html).toContain('aria-label="Opções de câmera"')
  })

  it('as setas são botões à parte (não mutam nem ligam a câmera sozinhas)', () => {
    const html = render()
    const chevrons = html.split('<button').filter((b) => b.includes('aria-haspopup="menu"'))
    expect(chevrons).toHaveLength(3)
    for (const c of chevrons) expect(c).toContain('type="button"')
  })
})
