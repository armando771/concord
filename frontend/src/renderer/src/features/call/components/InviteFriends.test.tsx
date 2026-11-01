import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const friendState = {
  friends: [
    { id: 'u1', username: 'ana', display_name: 'Ana' },
    { id: 'u2', username: 'bia', display_name: '' }
  ],
  loaded: true,
  loadAll: vi.fn()
}
const chatState = { presence: { u1: true } as Record<string, boolean> }
const callState = { participants: [] as { id: string }[] }

vi.mock('../../friends/store/friendStore', () => ({
  useFriendStore: Object.assign((sel: (s: unknown) => unknown) => sel(friendState), {
    getState: () => friendState
  })
}))
vi.mock('../../chat/store/chatStore', () => ({
  useChatStore: (sel: (s: unknown) => unknown) => sel(chatState),
  usePresenceStatus: (id: string) => (chatState.presence[id] ? 'online' : 'offline')
}))
vi.mock('../store/callStore', () => ({
  useCallStore: (sel: (s: unknown) => unknown) => sel(callState)
}))
const inviteState = {
  phase: 'idle',
  results: [] as { user_id: string; status: string }[],
  error: null as string | null,
  resetSend: vi.fn()
}
vi.mock('../store/callInviteStore', () => ({
  useCallInviteStore: Object.assign((sel: (s: unknown) => unknown) => sel(inviteState), {
    getState: () => inviteState
  })
}))
vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <span /> }))
vi.mock('../../../shared/ui/Modal', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null
}))

import InviteFriendRow from './InviteFriendRow'
import FriendPickList from './FriendPickList'
import InviteFriendsForm from './InviteFriendsForm'
import InviteResultsList from './InviteResultsList'
import InviteFriendsModal from './InviteFriendsModal'

const ana = friendState.friends[0]

afterEach(() => {
  friendState.loaded = true
  callState.participants = []
  inviteState.phase = 'idle'
  inviteState.results = []
  inviteState.error = null
})

describe('InviteFriendRow', () => {
  it('mostra nome, presença e o checkbox marcado', () => {
    const html = renderToStaticMarkup(
      <InviteFriendRow friend={ana} selected disabled={false} onToggle={vi.fn()} />
    )
    expect(html).toContain('Ana')
    expect(html).toContain('Online')
    expect(html).toContain('checked')
    expect(html).toContain('min-h-12')
  })

  it('offline sem nome de exibição usa o usuário e fica desmarcado', () => {
    const html = renderToStaticMarkup(
      <InviteFriendRow
        friend={friendState.friends[1]}
        selected={false}
        disabled
        onToggle={vi.fn()}
      />
    )
    expect(html).toContain('bia')
    expect(html).toContain('Offline')
    expect(html).not.toContain('checked')
  })
})

describe('FriendPickList', () => {
  const base = { total: 2, available: 2, selected: [], disabled: false, onChange: vi.fn() }

  it('carregando, vazia e com gente', () => {
    expect(
      renderToStaticMarkup(<FriendPickList {...base} loaded={false} visible={[]} />)
    ).toContain('Carregando seus amigos')
    expect(
      renderToStaticMarkup(<FriendPickList {...base} loaded visible={[]} total={0} />)
    ).toContain('ainda não tem amigos')
    expect(renderToStaticMarkup(<FriendPickList {...base} loaded visible={[ana]} />)).toContain(
      'Ana'
    )
  })
})

describe('InviteFriendsForm', () => {
  it('lista os amigos, sem quem já está na call, com envio desabilitado sem seleção', () => {
    callState.participants = [{ id: 'u2' }]
    const html = renderToStaticMarkup(<InviteFriendsForm callId="c1" />)
    expect(html).toContain('Ana')
    expect(html).not.toContain('bia')
    expect(html).toContain('0 amigos selecionados')
    expect(html).toContain('disabled=""')
  })

  it('erro de envio aparece com alerta e o botão vira "Tentar de novo"', () => {
    inviteState.phase = 'error'
    inviteState.error = 'falhou'
    const html = renderToStaticMarkup(<InviteFriendsForm callId="c1" />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('falhou')
    expect(html).toContain('Tentar de novo')
  })

  it('enviando, o botão mostra o carregamento', () => {
    inviteState.phase = 'loading'
    expect(renderToStaticMarkup(<InviteFriendsForm callId="c1" />)).toContain('Enviando...')
  })
})

describe('InviteResultsList', () => {
  it('uma linha por pessoa com o motivo de quem não foi convidado', () => {
    const html = renderToStaticMarkup(
      <InviteResultsList
        nameOf={(id) => id}
        results={[
          { user_id: 'u1', status: 'sent' },
          { user_id: 'u2', status: 'busy' }
        ]}
      />
    )
    expect(html).toContain('1 de 2 convites enviados')
    expect(html).toContain('Convite enviado na conversa privada')
    expect(html).toContain('Está em outra call')
  })
})

describe('InviteFriendsModal', () => {
  it('fechada não renderiza nada', () => {
    expect(
      renderToStaticMarkup(<InviteFriendsModal open={false} callId="c1" onClose={vi.fn()} />)
    ).toBe('')
  })

  it('aberta mostra o formulário; depois do envio, o resultado', () => {
    const open = <InviteFriendsModal open callId="c1" onClose={vi.fn()} />
    expect(renderToStaticMarkup(open)).toContain('Enviar convites')
    inviteState.phase = 'ok'
    inviteState.results = [{ user_id: 'u1', status: 'sent' }]
    const html = renderToStaticMarkup(open)
    expect(html).toContain('Convite enviado.')
    expect(html).toContain('Convidar mais gente')
  })
})
