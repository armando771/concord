/**
 * Mover pessoas entre canais de voz (como no Discord): precisa de MOVE_MEMBERS
 * no canal em que a pessoa está e de um cargo acima do dela (o dono nunca é
 * movido por outro). Mover a si mesmo só pede a permissão.
 */
export function canMoveVoiceUser(opts: {
  meId: string | undefined
  targetId: string
  /** Você tem MOVE_MEMBERS no canal de voz em que a pessoa está. */
  canMoveMembers: boolean
  /** Você está acima dela na hierarquia (ServerAccess.canActOnMember). */
  canActOnTarget: boolean
}): boolean {
  if (!opts.meId || !opts.canMoveMembers) return false
  return opts.targetId === opts.meId || opts.canActOnTarget
}

/** Em qual canal de voz do servidor a pessoa está conectada (ou null). */
export function voiceChannelOf(
  serverCalls: Record<string, { participants: { user_id: string }[] } | undefined>,
  userId: string
): string | null {
  for (const [channelId, state] of Object.entries(serverCalls)) {
    if (state?.participants.some((p) => p.user_id === userId)) return channelId
  }
  return null
}

/** Tipo usado no arrastar e soltar de pessoas entre canais de voz. */
export const VOICE_USER_DRAG = 'application/x-concord-voice-user'
