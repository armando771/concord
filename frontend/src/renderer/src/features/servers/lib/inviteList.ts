import type { ServerInvite } from '../api/invites'

/** "26 de out. de 2026"; sem data, texto vazio. */
export function formatInviteDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/** Linha de baixo do convite: quem convidou e quando. */
export function inviteSubtitle(
  invite: Pick<ServerInvite, 'inviter_username' | 'created_at'>
): string {
  const when = invite.created_at ? ` • ${formatInviteDate(invite.created_at)}` : ''
  return `@${invite.inviter_username} convidou você${when}`
}

/** Letra do ícone quando o servidor não tem imagem. */
export function serverInitial(name?: string): string {
  return (name ?? '?').charAt(0).toUpperCase()
}

/** Rótulo do botão Aceitar enquanto o convite está sendo aceito. */
export const acceptLabel = (busy: boolean): string => (busy ? 'Entrando...' : 'Aceitar')

/** "Convites pendentes — 3"; enquanto carrega, sem número. */
export function pendingInvitesLabel(loading: boolean, count: number): string {
  return loading ? 'Convites pendentes' : `Convites pendentes — ${count}`
}
