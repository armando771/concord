import type { CallInvite } from '../../chat/api/messages'
import { INVITE_COPY } from './callInviteCopy'

// Regras do cartão de convite para a call que aparece na DM (sem React).

/** O que se sabe da call do convite: ainda não sei, existe ou acabou. */
export type InviteValidity = 'unknown' | 'valid' | 'invalid'

/** "Servidor - canal" da linha de cima (cai para o que houver). */
export function invitePlace(invite: CallInvite): string {
  const channel = invite.channel_name?.trim()
  const server = invite.server_name?.trim()
  if (server && channel) return `${server} - ${channel}`
  return channel || server || INVITE_COPY.fallbackPlace
}

export type CardView =
  | { kind: 'invalid' }
  | {
      kind: 'valid'
      title: string
      place: string
      /** Botão "Abrir": só para quem recebeu, e só depois de saber que a call existe. */
      button: 'none' | 'loading' | 'open'
    }

/** O que o cartão mostra para quem está vendo (autor do convite ou convidado). */
export function cardView(input: {
  invite: CallInvite
  authorName: string
  isMine: boolean
  validity: InviteValidity
}): CardView {
  const { invite, authorName, isMine, validity } = input
  if (validity === 'invalid') return { kind: 'invalid' }
  let button: 'none' | 'loading' | 'open' = 'open'
  if (isMine) button = 'none'
  else if (validity === 'unknown') button = 'loading'
  return {
    kind: 'valid',
    title: isMine ? INVITE_COPY.cardTitleForAuthor : INVITE_COPY.cardTitleForGuest(authorName),
    place: invitePlace(invite),
    button
  }
}
