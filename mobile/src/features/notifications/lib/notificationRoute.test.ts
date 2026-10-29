import { routeForNotification } from './notificationRoute'

describe('routeForNotification', () => {
  it('DM abre a conversa com nome e tipo', () => {
    expect(routeForNotification({ type: 'dm', conversation_id: 'c1', conversation_type: 'dm', name: 'Ana' })).toEqual({
      pathname: '/dm/[conversationId]',
      params: { conversationId: 'c1', name: 'Ana', type: 'dm' }
    })
  })

  it('grupo mantém o tipo group', () => {
    const r = routeForNotification({ type: 'dm', conversation_id: 'g1', conversation_type: 'group', name: 'Time' })
    expect(r?.params).toMatchObject({ type: 'group', name: 'Time' })
  })

  it('menção abre o canal com servidor e nome', () => {
    expect(routeForNotification({ type: 'mention', channel_id: 'ch1', server_id: 's1', name: 'geral' })).toEqual({
      pathname: '/canal/[channelId]',
      params: { channelId: 'ch1', name: 'geral', serverId: 's1' }
    })
  })

  it('pedido de amizade abre a tela de amigos', () => {
    expect(routeForNotification({ type: 'friend_request', username: 'ana' })).toEqual({ pathname: '/amigos' })
  })

  it('dados incompletos ou desconhecidos não navegam', () => {
    expect(routeForNotification({ type: 'dm' })).toBeNull()
    expect(routeForNotification({ type: 'mention', server_id: 's1' })).toBeNull()
    expect(routeForNotification({ type: 'outro' })).toBeNull()
    expect(routeForNotification(undefined)).toBeNull()
    expect(routeForNotification({ type: 42 })).toBeNull()
  })
})
