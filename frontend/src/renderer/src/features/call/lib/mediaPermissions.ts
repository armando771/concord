/**
 * O que o LiveKit deixa a pessoa publicar na sala. O servidor monta isso a
 * partir das permissões do canal (SPEAK → microfone, STREAM → câmera e tela) e
 * pode mudar no meio da chamada (cargo novo, "silenciar no servidor").
 */

export type PublishSource = 'microphone' | 'camera' | 'screen_share' | 'screen_share_audio'

// TrackSource do protocolo do LiveKit.
const PROTO_SOURCE: Record<PublishSource, number> = {
  camera: 1,
  microphone: 2,
  screen_share: 3,
  screen_share_audio: 4
}

export interface PublishPermission {
  canPublish?: boolean
  canPublishSources?: number[]
}

/**
 * Pode publicar essa fonte? Sem permissões conhecidas (ainda não chegaram)
 * assume que sim — se o servidor recusar, a publicação falha e o app avisa.
 */
export function canPublishSource(
  perms: PublishPermission | undefined | null,
  source: PublishSource
): boolean {
  if (!perms) return true
  if (perms.canPublish === false) return false
  const allowed = perms.canPublishSources
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(PROTO_SOURCE[source])
}
