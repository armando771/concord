import type { AppNotification } from '../../notifications/lib/notifications'
import type { InviteResultStatus, InviteUpdateStatus } from '../api/callInvites'

/**
 * Todos os textos do convite de amigos para a call, num lugar só (para o
 * Hugo aprovar ou trocar sem caçar pelos componentes).
 */
export const INVITE_COPY = {
  buttonLabel: 'Convidar amigos',
  modalTitle: 'Convidar amigos para a call',
  searchLabel: 'Buscar amigos',
  searchPlaceholder: 'Buscar amigo',
  loadingFriends: 'Carregando seus amigos...',
  noFriends: 'Você ainda não tem amigos para convidar.',
  noMatches: 'Nenhum amigo encontrado.',
  allInCall: 'Todos os seus amigos já estão na call.',
  online: 'Online',
  offline: 'Offline',
  selectedCount: (n: number): string =>
    n === 1 ? '1 amigo selecionado' : `${n} amigos selecionados`,
  send: 'Enviar convites',
  sending: 'Enviando...',
  sentAll: (n: number): string => (n === 1 ? 'Convite enviado.' : `${n} convites enviados.`),
  sentSome: (ok: number, total: number): string =>
    `${ok} de ${total} convites enviados. Veja abaixo quem não pôde ser convidado.`,
  sentNone: 'Nenhum convite foi enviado.',
  requestFailed: 'Não foi possível enviar os convites. Tente de novo.',
  retry: 'Tentar de novo',
  close: 'Fechar',
  inviteMore: 'Convidar mais gente',
  cardTitle: (name: string): string => `${name} te convidou para a call`,
  cardPlace: (channel: string, server: string): string =>
    server ? `${channel} em ${server}` : channel,
  fallbackChannel: 'um canal de voz',
  accept: 'Aceitar',
  decline: 'Recusar',
  acceptFailed: 'Não foi possível entrar na call. O convite pode ter expirado.',
  declineFailed: 'Não foi possível recusar o convite.',
  notificationBody: 'Clique para ver o convite'
} as const

const RESULT_TEXT: Record<InviteResultStatus, string> = {
  sent: 'Convite enviado',
  already_invited: 'Já tem um convite pendente',
  already_in_call: 'Já está na call',
  not_friend: 'Não é seu amigo',
  blocked: 'Não pode ser convidado',
  offline: 'Está offline',
  busy: 'Está em outra call',
  no_access: 'Sem acesso a este canal de voz',
  cooldown: 'Recusou há pouco, tente daqui a pouco'
}

const UPDATE_TEXT: Record<InviteUpdateStatus, string> = {
  accepted: 'Aceitou o convite',
  declined: 'Recusou o convite',
  expired: 'O convite expirou',
  cancelled: 'Convite cancelado (a call acabou)'
}

export function resultText(status: InviteResultStatus | string): string {
  return RESULT_TEXT[status as InviteResultStatus] ?? 'Não foi possível convidar'
}

export function updateText(status: InviteUpdateStatus | string): string {
  return UPDATE_TEXT[status as InviteUpdateStatus] ?? ''
}

/** Aviso do sistema quando chega um convite (clicar abre o servidor/canal). */
export function inviteNotification(invite: {
  by: { display_name?: string; username?: string }
  server_id?: string | null
  channel_id?: string | null
}): AppNotification {
  const name = invite.by.display_name || invite.by.username || 'Alguém'
  return {
    kind: 'call',
    title: INVITE_COPY.cardTitle(name),
    body: INVITE_COPY.notificationBody,
    route:
      invite.server_id && invite.channel_id
        ? `/servers/${invite.server_id}/channels/${invite.channel_id}`
        : '/',
    urgent: true
  }
}
