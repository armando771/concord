import { afterEach, describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CallAvatar from './CallAvatar'

// No render do servidor o zustand lê o estado inicial: quem fala e o segundo
// plano vêm dos mocks.
const state = vi.hoisted(() => ({ background: false, speakingIds: [] as string[] }))
vi.mock('../../../shared/store/windowActivityStore', () => ({
  useInBackground: () => state.background
}))
vi.mock('../store/callStore', () => ({
  useCallStore: (select: (s: { speakingIds: string[] }) => unknown) =>
    select({ speakingIds: state.speakingIds })
}))

const GIF = '/api/profile-media/a_33333333-3333-3333-3333-333333333333'

const render = (): string =>
  renderToStaticMarkup(<CallAvatar userId="u1" name="Ana" avatarUrl={GIF} size={24} animate="always" />)

describe('CallAvatar', () => {
  afterEach(() => {
    state.background = false
    state.speakingIds = []
  })

  it('falando, mostra o GIF animado sem depender do hover', () => {
    state.speakingIds = ['u1']
    const html = render()

    expect(html).toContain(`${GIF}"`)
    expect(html).not.toContain('/static')
    expect(html).not.toContain('group-hover')
  })

  it('calado, fica no quadro parado e anima só com o mouse/foco em cima (o animate de quem chama não vale)', () => {
    state.speakingIds = ['outra-pessoa']
    const html = render()

    expect(html).toContain(`${GIF}/static"`)
    expect(html).toContain('group-hover:visible')
    expect(html).toContain('group-focus-within:visible')
  })

  it('app em segundo plano: parado mesmo falando, sem animar no hover', () => {
    state.background = true
    state.speakingIds = ['u1']
    const html = render()

    expect(html).toContain(`${GIF}/static"`)
    expect(html).not.toContain(`${GIF}"`)
    expect(html).not.toContain('group-hover')
  })

  it('imagem comum e inicial continuam iguais', () => {
    const png = renderToStaticMarkup(
      <CallAvatar name="Ana" avatarUrl="/api/profile-media/uuid" size={24} />
    )
    const inicial = renderToStaticMarkup(<CallAvatar name="ana" size={24} />)

    expect(png).toContain('/api/profile-media/uuid"')
    expect(inicial).toContain('>A<')
  })
})
