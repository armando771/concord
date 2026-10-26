import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ call: { serverId: 'srv-1' as string | null } }))
vi.mock('../store/callStore', () => ({
  useCallStore: (sel: (s: typeof state.call) => unknown) => sel(state.call)
}))
vi.mock('../store/voiceModStore', () => ({ useVoiceModStore: () => true }))
vi.mock('./SoundboardSoundsPanel', () => ({ default: () => <p>sons</p> }))
vi.mock('./VoiceModPanel', () => ({ default: () => <p>voz</p> }))
// Sem DOM: o portal vira o próprio conteúdo.
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { renderToStaticMarkup } from 'react-dom/server'
import SoundboardPopover from './SoundboardPopover'

function render(viewportWidth: number, anchorLeft: number): string {
  vi.stubGlobal('window', { innerWidth: viewportWidth, innerHeight: 800 })
  vi.stubGlobal('document', { body: {} })
  const anchor = {
    getBoundingClientRect: () => ({ left: anchorLeft, width: 40, top: 700 }),
    contains: () => false
  } as unknown as HTMLElement
  return renderToStaticMarkup(<SoundboardPopover anchor={anchor} onClose={() => {}} />)
}

describe('SoundboardPopover', () => {
  it('em tela larga tem 480 px, centrado no botão', () => {
    const html = render(1280, 600)
    expect(html).toContain('width:480px')
    expect(html).toContain('left:380px')
    expect(html).toContain('Mesa de Áudio · Sons')
    expect(html).toContain('sons')
  })

  it('em 360 px encolhe para caber, com margem dos dois lados', () => {
    const html = render(360, 300)
    expect(html).toContain('width:344px')
    expect(html).toContain('left:8px')
  })

  it('sem servidor não abre', () => {
    state.call.serverId = null
    expect(render(1280, 600)).toBe('')
    state.call.serverId = 'srv-1'
  })
})
