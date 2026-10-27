import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <span /> }))
import FriendInviteCard from './FriendInviteCard'

const invite = {
  call_id: 'call-1',
  channel_id: 'c1',
  server_id: 's1',
  channel_name: 'Geral',
  server_name: 'Salinha',
  by: { id: 'ana', username: 'ana', display_name: 'Ana' },
  expires_at: '2099-01-01T00:00:00Z'
}

function render(busy = false): string {
  return renderToStaticMarkup(
    <FriendInviteCard
      invite={invite}
      busy={busy}
      onAccept={vi.fn()}
      onDecline={vi.fn()}
      onExpire={vi.fn()}
    />
  )
}

describe('FriendInviteCard', () => {
  it('diz quem convidou e qual call', () => {
    const html = render()
    expect(html).toContain('Ana te convidou para a call')
    expect(html).toContain('Geral em Salinha')
  })

  it('tem Aceitar e Recusar com alvo de toque de 40 px', () => {
    const html = render()
    expect(html).toContain('Aceitar')
    expect(html).toContain('Recusar')
    expect(html).toContain('min-h-10')
  })

  it('respondendo, os botões ficam desabilitados', () => {
    expect(render(true).match(/disabled=""/g)).toHaveLength(2)
  })
})
