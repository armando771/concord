import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../Toggle', () => ({
  Toggle: ({ title, checked }: { title: string; checked: boolean }) => (
    <i data-toggle={title} data-on={String(checked)} />
  )
}))
vi.mock('../../../activity/store/presenceActivityStore', () => ({
  usePresenceActivityStore: (sel: (s: unknown) => unknown) =>
    sel({ enabled: true, setEnabled: () => {} })
}))
vi.mock('../../../activity/store/listeningStore', () => ({
  useListeningStore: (sel: (s: unknown) => unknown) => sel({ enabled: false, setEnabled: () => {} })
}))

import { ActivityPrivacy } from './ActivityPrivacy'

const withApi = (api: unknown): void => {
  vi.stubGlobal('window', { api })
}

afterEach(() => vi.unstubAllGlobals())

describe('ActivityPrivacy', () => {
  it('navegador (sem window.api): nada', () => {
    withApi(undefined)
    expect(renderToStaticMarkup(<ActivityPrivacy />)).toBe('')
  })

  it('desktop: a opção do jogo e a da música, cada uma com o seu estado', () => {
    withApi({ games: {}, music: {} })
    const html = renderToStaticMarkup(<ActivityPrivacy />)
    expect(html).toContain('data-toggle="Mostrar o jogo que estou jogando" data-on="true"')
    expect(html).toContain('data-toggle="Mostrar a música que estou ouvindo" data-on="false"')
  })

  it('app antigo sem detecção de música: só a do jogo', () => {
    withApi({ games: {} })
    expect(renderToStaticMarkup(<ActivityPrivacy />)).not.toContain('música')
  })
})
