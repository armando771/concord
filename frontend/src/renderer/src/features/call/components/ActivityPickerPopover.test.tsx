import { describe, expect, it, vi } from 'vitest'

vi.mock('../store/callStore', () => ({
  useCallStore: (sel: (s: { callId: string }) => unknown) => sel({ callId: 'c1' })
}))
vi.mock('../../activity/store/activityStore', () => ({
  useActivityStore: (sel: (s: { start: () => void }) => unknown) => sel({ start: () => {} })
}))
// Sem DOM: o portal vira o próprio conteúdo.
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { renderToStaticMarkup } from 'react-dom/server'
import ActivityPickerPopover from './ActivityPickerPopover'

function render(viewportWidth: number, anchorLeft: number): string {
  vi.stubGlobal('window', { innerWidth: viewportWidth, innerHeight: 800 })
  vi.stubGlobal('document', { body: {} })
  const anchor = {
    getBoundingClientRect: () => ({ left: anchorLeft, width: 40, top: 700 }),
    contains: () => false
  } as unknown as HTMLElement
  return renderToStaticMarkup(<ActivityPickerPopover anchor={anchor} onClose={() => {}} />)
}

describe('ActivityPickerPopover', () => {
  it('em tela larga tem 360 px, centrado no botão', () => {
    const html = render(1280, 600)
    expect(html).toContain('width:360px')
    expect(html).toContain('left:440px')
  })

  it('em 360 px encolhe para caber, com margem dos dois lados (antes saía 8 px pela esquerda)', () => {
    const html = render(360, 300)
    expect(html).toContain('width:344px')
    expect(html).toContain('left:8px')
  })

  it('numa janela ainda mais estreita continua cabendo', () => {
    const html = render(320, 10)
    expect(html).toContain('width:304px')
    expect(html).toContain('left:8px')
  })
})
