import type { CallStateResponse } from '../api/calls'

// Selo LIVE na lista do canal de voz: quem está transmitindo, atualizado na
// hora pelo evento call:live (o polling de 10 s continua corrigindo).

export interface LivePayload {
  call_id: string
  user_id: string
  active: boolean
}

/** Atualiza `screen_sharing` da entrada da chamada do evento; chamada desconhecida → mesmo mapa. */
export function applyLiveEvent(
  serverCalls: Record<string, CallStateResponse>,
  p: LivePayload
): Record<string, CallStateResponse> {
  const channelId = Object.keys(serverCalls).find((id) => serverCalls[id].call?.id === p.call_id)
  if (!channelId) return serverCalls
  const entry = serverCalls[channelId]
  const others = (entry.screen_sharing ?? []).filter((id) => id !== p.user_id)
  return {
    ...serverCalls,
    [channelId]: { ...entry, screen_sharing: p.active ? [...others, p.user_id] : others }
  }
}

/** Quem mostra o selo: o que o servidor diz ∪ quem transmite na minha chamada (nesse canal). */
export function liveUserIds(
  entry: CallStateResponse | undefined,
  localSharers: string[]
): Set<string> {
  return new Set([...(entry?.screen_sharing ?? []), ...localSharers])
}
