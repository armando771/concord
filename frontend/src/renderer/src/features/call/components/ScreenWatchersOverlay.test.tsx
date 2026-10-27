import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ScreenWatchersOverlay from './ScreenWatchersOverlay'
import type { CallUserInfo } from '../store/callStore'

// O CallAvatar lê quem fala do callStore (que puxa o áudio da call): ninguém fala aqui.
vi.mock('../store/callStore', () => ({
  useCallStore: (select: (s: { speakingIds: string[] }) => unknown) => select({ speakingIds: [] })
}))

describe('ScreenWatchersOverlay', () => {
  it('não renderiza nada se lista de watchers estiver vazia', () => {
    const html = renderToStaticMarkup(<ScreenWatchersOverlay watchers={[]} />)
    expect(html).toBe('')
  })

  it('renderiza avatares dos espectadores e contador', () => {
    const watchers: CallUserInfo[] = [
      { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null },
      { id: 'u2', username: 'bob', display_name: 'Bob', avatar_url: null }
    ]

    const html = renderToStaticMarkup(<ScreenWatchersOverlay watchers={watchers} />)

    expect(html).toContain('screen-watchers-overlay')
    expect(html).toContain('2')
    expect(html).toContain('Alice')
    expect(html).toContain('Bob')
  })

  it('exibe badge +N quando houver mais de 4 espectadores', () => {
    const watchers: CallUserInfo[] = [
      { id: 'u1', username: 'u1', display_name: 'User 1' },
      { id: 'u2', username: 'u2', display_name: 'User 2' },
      { id: 'u3', username: 'u3', display_name: 'User 3' },
      { id: 'u4', username: 'u4', display_name: 'User 4' },
      { id: 'u5', username: 'u5', display_name: 'User 5' },
      { id: 'u6', username: 'u6', display_name: 'User 6' }
    ]

    const html = renderToStaticMarkup(<ScreenWatchersOverlay watchers={watchers} />)

    expect(html).toContain('+2')
    expect(html).toContain('User 1')
  })

  it('GIF do espectador fica no quadro parado e anima com o mouse em cima', () => {
    const gif = '/api/profile-media/a_22222222-2222-2222-2222-222222222222'
    const watchers: CallUserInfo[] = [
      { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: gif }
    ]

    const html = renderToStaticMarkup(<ScreenWatchersOverlay watchers={watchers} />)

    expect(html).toContain(`${gif}/static"`)
    expect(html).toContain('group-hover:visible')
  })
})
