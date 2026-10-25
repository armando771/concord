/**
 * Mover pessoas entre canais de voz (como no Discord): só o dono e os
 * moderadores do servidor; moderador não move o dono.
 */
export function canMoveVoiceUser(opts: {
  meId: string | undefined
  ownerId: string | undefined
  /** Você é moderador ou dono do servidor. */
  isModerator: boolean
  targetId: string
}): boolean {
  if (!opts.meId || !opts.isModerator) return false
  if (opts.targetId === opts.ownerId && opts.meId !== opts.ownerId) return false
  return true
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
