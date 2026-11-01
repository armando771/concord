import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ArrivalBadge, { CallArrivalBadge } from './ArrivalBadge'

// A renderização estática não enxerga o estado do zustand: o hook é simulado
// (a regra dele é testada com o store) e aqui só vê quem ele acusa como recém-chegado.
const sim = vi.hoisted(() => ({
  arrived: new Set<string>(),
  call: { type: 'channel', channelId: 'c1' } as object
}))
vi.mock('../hooks/useRecentArrival', () => ({
  useRecentArrival: (channelId: string | null | undefined, userId: string) =>
    Boolean(channelId) && sim.arrived.has(`${channelId}:${userId}`)
}))
// O callStore puxa o áudio do navegador (AudioWorklet), que o teste não tem.
vi.mock('../store/callStore', () => ({
  useCallStore: (select: (s: object) => unknown) => select(sim.call)
}))

describe('ArrivalBadge', () => {
  afterEach(() => {
    sim.arrived.clear()
    sim.call = { type: 'channel', channelId: 'c1' }
  })

  it('mostra a pílula verde "Chegou" para quem acabou de chegar', () => {
    sim.arrived.add('c1:ana')
    const html = renderToStaticMarkup(<ArrivalBadge channelId="c1" userId="ana" />)
    expect(html).toContain('Chegou')
    expect(html).toContain('bg-success-strong')
    expect(html).toContain('arrival-badge')
  })

  it('não mostra para quem não chegou agora, em outro canal ou sem canal', () => {
    sim.arrived.add('c1:ana')
    expect(renderToStaticMarkup(<ArrivalBadge channelId="c1" userId="bia" />)).toBe('')
    expect(renderToStaticMarkup(<ArrivalBadge channelId="c2" userId="ana" />)).toBe('')
    expect(renderToStaticMarkup(<ArrivalBadge channelId={null} userId="ana" />)).toBe('')
  })

  it('no tile da call usa o canal da minha call', () => {
    sim.arrived.add('c1:ana')
    expect(renderToStaticMarkup(<CallArrivalBadge userId="ana" />)).toContain('Chegou')
  })

  it('call de DM não tem selo', () => {
    sim.arrived.add('c1:ana')
    sim.call = { type: 'dm', channelId: null }
    expect(renderToStaticMarkup(<CallArrivalBadge userId="ana" />)).toBe('')
  })
})
