import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GuestInvitesState } from '../hooks/useGuestInvites'

vi.mock('../../../shared/ui/Modal', () => ({
  default: ({
    open,
    title,
    children
  }: {
    open: boolean
    title: string
    children: React.ReactNode
  }) => (open ? <div data-title={title}>{children}</div> : null)
}))

const hookState: { current: GuestInvitesState } = { current: null as never }
vi.mock('../hooks/useGuestInvites', () => ({ useGuestInvites: () => hookState.current }))

const access = { perms: 0 }
vi.mock('../../servers/hooks/useServerAccess', () => ({
  useServerAccess: () => ({ channelPerms: () => access.perms })
}))

import GuestInviteModal from './GuestInviteModal'
import GuestInviteForm from './GuestInviteForm'
import GuestInviteList from './GuestInviteList'
import GuestInviteEntry from './GuestInviteEntry'
import GuestBadge from './GuestBadge'
import { Perm } from '../../servers/lib/permissions'

function state(over: Partial<GuestInvitesState> = {}): GuestInvitesState {
  return {
    invites: [],
    link: null,
    creating: false,
    create: vi.fn(),
    revoke: vi.fn(),
    remove: vi.fn(),
    clearLink: vi.fn(),
    ...over
  }
}

const future = new Date(Date.now() + 2 * 3600_000 + 60_000).toISOString()

describe('Convidar visitante', () => {
  it('o modal começa com duração, permissões e o botão de gerar', () => {
    hookState.current = state()
    const html = renderToStaticMarkup(<GuestInviteModal open channelId="c" onClose={() => {}} />)
    expect(html).toContain('Convidar visitante para a call')
    for (const label of [
      '2 horas',
      '6 horas',
      '12 horas',
      '1 dia',
      'Falar',
      'Câmera e tela',
      'Gerar link'
    ]) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Nenhum link ativo nesta call.')
  })

  it('com o link gerado, mostra para copiar', () => {
    hookState.current = state({ link: 'https://app/visitante/tok' })
    const html = renderToStaticMarkup(<GuestInviteModal open channelId="c" onClose={() => {}} />)
    expect(html).toContain('value="https://app/visitante/tok"')
    expect(html).toContain('Copiar link')
    expect(html).not.toContain('Gerar link<')
  })

  it('gerando: botão travado', () => {
    const html = renderToStaticMarkup(<GuestInviteForm state={state({ creating: true })} />)
    expect(html).toContain('Gerando...')
    expect(html).toContain('disabled')
  })

  it('lista os links ativos com quem entrou, revogar e expulsar', () => {
    const html = renderToStaticMarkup(
      <GuestInviteList
        state={state({
          invites: [
            {
              id: 'i1',
              server_id: 's',
              channel_id: 'c',
              created_by: 'm',
              expires_at: future,
              can_speak: true,
              can_stream: false,
              guests: [
                { user_id: 'g1', display_name: 'Visita' },
                { user_id: 'g2', display_name: 'Saiu Já', ended_at: future }
              ]
            },
            {
              id: 'i2',
              server_id: 's',
              channel_id: 'c',
              created_by: 'm',
              expires_at: future,
              can_speak: false,
              can_stream: false,
              guests: []
            }
          ]
        })}
      />
    )
    expect(html).toContain('Termina em 2 h')
    expect(html).toContain('Visita')
    expect(html).toContain('Expulsar')
    expect(html).toContain('Acesso encerrado')
    expect(html).toContain('Revogar link')
    expect(html).toContain('Ninguém entrou ainda.')
  })

  it('o botão na call só aparece com a permissão', () => {
    access.perms = 0
    expect(renderToStaticMarkup(<GuestInviteEntry channelId="c" />)).toBe('')
    access.perms = Perm.INVITE_GUESTS
    hookState.current = state()
    expect(renderToStaticMarkup(<GuestInviteEntry channelId="c" />)).toContain(
      'aria-label="Convidar visitante"'
    )
  })

  it('selo Visitante', () => {
    expect(renderToStaticMarkup(<GuestBadge />)).toContain('Visitante')
  })
})
