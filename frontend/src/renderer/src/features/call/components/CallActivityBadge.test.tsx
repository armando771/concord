import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CallActivityBadge from './CallActivityBadge'

const sim = vi.hoisted(() => ({ activity: null as { name: string; accent: string } | null }))
vi.mock('../../activity/lib/activityState', () => ({ activityOfPlayer: () => sim.activity }))
vi.mock('../../activity/store/activityStore', () => ({
  useActivityStore: (select: (s: object) => unknown) => select({})
}))
vi.mock('./ActivityPickerPopover', () => ({ ActivityGlyph: () => <i data-glyph="" /> }))
vi.mock('./ArrivalBadge', () => ({ CallArrivalBadge: () => <b data-arrival="" /> }))

describe('CallActivityBadge', () => {
  afterEach(() => {
    sim.activity = null
  })

  it('sem atividade mostra só o "Chegou" (quando vale)', () => {
    const html = renderToStaticMarkup(<CallActivityBadge userId="ana" />)
    expect(html).toContain('data-arrival')
    expect(html).not.toContain('data-glyph')
  })

  it('com atividade mostra o ícone do jogo e a dica "Jogando …"', () => {
    sim.activity = { name: 'Xadrez', accent: '#fff' }
    const html = renderToStaticMarkup(<CallActivityBadge userId="ana" />)
    expect(html).toContain('data-glyph')
    expect(html).toContain('Jogando Xadrez')
    expect(html).toContain('data-arrival')
  })

  it('arrival={false}: sem o "Chegou" (a lista do canal tem o seu)', () => {
    sim.activity = { name: 'Xadrez', accent: '#fff' }
    const html = renderToStaticMarkup(<CallActivityBadge userId="ana" arrival={false} />)
    expect(html).not.toContain('data-arrival')
    expect(html).toContain('data-glyph')
  })
})
