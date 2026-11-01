interface CallLike {
  status: string
  type: string | null
  serverId: string | null
}

// Servidor da chamada de voz em que o usuário está agora (null em DM ou sem chamada).
export function voiceServerId(call: CallLike): string | null {
  return call.status !== 'idle' && call.type === 'channel' ? call.serverId : null
}

/** Quem está num canal de voz, no formato que o cartão do servidor precisa. */
export interface VoiceMember {
  id: string
  name: string
  avatarUrl: string | null
}

interface VoiceStateLike {
  participants: {
    user_id: string
    display_name?: string
    username?: string
    avatar_url?: string | null
  }[]
}

// Todo mundo conectado nos canais de voz do servidor (sem repetir a pessoa).
export function voicePeople(states: VoiceStateLike[]): VoiceMember[] {
  const byId = new Map<string, VoiceMember>()
  for (const st of states) {
    for (const p of st.participants) {
      if (byId.has(p.user_id)) continue
      byId.set(p.user_id, {
        id: p.user_id,
        name: p.display_name || p.username || 'Usuário',
        avatarUrl: p.avatar_url ?? null
      })
    }
  }
  return [...byId.values()]
}
