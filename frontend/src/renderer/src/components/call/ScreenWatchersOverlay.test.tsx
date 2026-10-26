import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ScreenWatchersOverlay from './ScreenWatchersOverlay'
import type { CallUserInfo } from '../../store/callStore'

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
})
