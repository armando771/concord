interface CallLike {
  status: string
  type: string | null
  serverId: string | null
}

// Servidor da chamada de voz em que o usuário está agora (null em DM ou sem chamada).
export function voiceServerId(call: CallLike): string | null {
  return call.status !== 'idle' && call.type === 'channel' ? call.serverId : null
}

// Há alguém conectado em algum canal de voz do servidor?
export function hasVoiceParticipants(states: { participants: unknown[] }[]): boolean {
  return states.some((st) => st.participants.length > 0)
}
