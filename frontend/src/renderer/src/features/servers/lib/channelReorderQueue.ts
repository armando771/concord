import type { ChannelType } from '../api/channels'

// Reordenação de canais: uma fila por seção (servidor + tipo). Os pedidos saem
// um de cada vez, então um mais novo nunca é ultrapassado por um mais antigo.

export interface ReorderSection {
  /** Último pedido da fila (o próximo espera ele terminar). */
  queue: Promise<unknown>
  /** Pedidos ainda sem resposta. */
  inFlight: number
  /** Conta as reordenações locais; falha só desfaz se nenhuma veio depois. */
  generation: number
  /** Chegou ordem de outra pessoa no meio: buscar a lista ao terminar. */
  stale: boolean
}

const sectionKey = (serverId: string, type: ChannelType): string => `${serverId}:${type}`

const reorderSections = new Map<string, ReorderSection>()

/** A seção do servidor+tipo; cria vazia na primeira vez. */
export function reorderSection(serverId: string, type: ChannelType): ReorderSection {
  const key = sectionKey(serverId, type)
  let section = reorderSections.get(key)
  if (!section) {
    section = { queue: Promise.resolve(), inFlight: 0, generation: 0, stale: false }
    reorderSections.set(key, section)
  }
  return section
}

/** A seção, sem criar: quem nunca reordenou não tem fila. */
export function findReorderSection(serverId: string, type: ChannelType): ReorderSection | undefined {
  return reorderSections.get(sectionKey(serverId, type))
}

/** request_id das nossas reordenações, para ignorar o eco pelo WS. */
const ownReorderRequests = new Set<string>()
const OWN_REQUEST_TTL_MS = 60_000

const newRequestId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Novo request_id de uma reordenação nossa; vale por um minuto para o eco. */
export function trackOwnReorderRequest(): string {
  const requestId = newRequestId()
  ownReorderRequests.add(requestId)
  setTimeout(() => ownReorderRequests.delete(requestId), OWN_REQUEST_TTL_MS)
  return requestId
}

/** O evento de ordem que chegou é o eco de um pedido nosso? (consome o id) */
export function isOwnReorderEcho(requestId: string | null | undefined): boolean {
  return Boolean(requestId) && ownReorderRequests.delete(requestId as string)
}
