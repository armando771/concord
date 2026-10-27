import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  StreamContextMenu,
  MaestroContextMenu,
  FriendMenuItems
} from './UserContextMenuSections'

describe('UserContextMenuSections', () => {
  it('StreamContextMenu renderiza volume', () => {
    const html = renderToStaticMarkup(
      <StreamContextMenu
        target={{ name: 'Streamer' }}
        left={10}
        top={20}
        menuRef={{ current: null }}
        renderVolumeControls={(label) => <div>{label}</div>}
      />
    )
    expect(html).toContain('Transmissão de Streamer')
    expect(html).toContain('Volume da transmissão')
  })

  it('MaestroContextMenu renderiza perfil e opção de remover para o dono', () => {
    const html = renderToStaticMarkup(
      <MaestroContextMenu
        target={{ userId: 'maestro-id', name: 'Maestro', x: 0, y: 0 }}
        left={10}
        top={20}
        server={{ id: 's1', owner_id: 'dono-id' }}
        meId="dono-id"
        itemClass="btn"
        menuRef={{ current: null }}
        close={vi.fn()}
        renderVolumeControls={() => <div>Volume</div>}
      />
    )
    expect(html).toContain('Perfil')
    expect(html).toContain('Remover Maestro')
  })

  it('FriendMenuItems renderiza estados de amizade (amigo, pedido enviado, bloqueado, nenhum)', () => {
    const friendHtml = renderToStaticMarkup(
      <FriendMenuItems
        relationship="friend"
        username="user1"
        callIdle={true}
        call={vi.fn()}
        addFriend={vi.fn()}
        acceptRequest={vi.fn()}
        askRemove={vi.fn()}
        askBlock={vi.fn()}
        doUnblock={vi.fn()}
        itemClass="btn"
      />
    )
    expect(friendHtml).toContain('Ligar')
    expect(friendHtml).toContain('Remover amigo')

    const outgoingHtml = renderToStaticMarkup(
      <FriendMenuItems
        relationship="outgoing"
        callIdle={true}
        call={vi.fn()}
        addFriend={vi.fn()}
        acceptRequest={vi.fn()}
        askRemove={vi.fn()}
        askBlock={vi.fn()}
        doUnblock={vi.fn()}
        itemClass="btn"
      />
    )
    expect(outgoingHtml).toContain('Pedido de amizade enviado')

    const blockedHtml = renderToStaticMarkup(
      <FriendMenuItems
        relationship="blocked"
        callIdle={true}
        call={vi.fn()}
        addFriend={vi.fn()}
        acceptRequest={vi.fn()}
        askRemove={vi.fn()}
        askBlock={vi.fn()}
        doUnblock={vi.fn()}
        itemClass="btn"
      />
    )
    expect(blockedHtml).toContain('Desbloquear')
  })
})
