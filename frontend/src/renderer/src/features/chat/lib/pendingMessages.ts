// Mensagens que eu mandei e o servidor ainda não confirmou: aparecem no fim do
// chat como "enviando…" e, se a rede falhar, como "Não enviada — tentar de
// novo". Puro: o chatStore guarda a lista por sala.

export type PendingStatus = 'sending' | 'failed'

export interface PendingMessage {
  localId: string
  content: string
  replyToId: string | null
  status: PendingStatus
  /** Motivo da falha, em português (só em 'failed'). */
  error: string | null
}

export function addPending(
  list: PendingMessage[] | undefined,
  item: PendingMessage
): PendingMessage[] {
  return [...(list ?? []), item]
}

export function updatePending(
  list: PendingMessage[] | undefined,
  localId: string,
  patch: Partial<Pick<PendingMessage, 'status' | 'error'>>
): PendingMessage[] {
  const current = list ?? []
  if (!current.some((p) => p.localId === localId)) return current
  return current.map((p) => (p.localId === localId ? { ...p, ...patch } : p))
}

export function removePending(
  list: PendingMessage[] | undefined,
  localId: string
): PendingMessage[] {
  const current = list ?? []
  return current.some((p) => p.localId === localId)
    ? current.filter((p) => p.localId !== localId)
    : current
}

/**
 * A mensagem chegou de verdade (evento do servidor) enquanto a pendente ainda
 * esperava resposta ou tinha falhado por tempo esgotado: o servidor gravou.
 * Tira a mais antiga com o mesmo texto, para não ficar duplicada na tela nem
 * ser reenviada.
 */
export function settlePending(
  list: PendingMessage[] | undefined,
  message: { content: string; author_id: string },
  meId: string | null | undefined
): PendingMessage[] {
  const current = list ?? []
  if (!meId || message.author_id !== meId || current.length === 0) return current
  const content = message.content.trim()
  const index = current.findIndex((p) => p.content === content)
  if (index === -1) return current
  return [...current.slice(0, index), ...current.slice(index + 1)]
}

/**
 * Falha que vale tentar de novo (rede caiu, sem resposta, servidor
 * reiniciando): a mensagem fica na tela com "tentar de novo". Outras (sem
 * permissão, texto inválido) não melhoram tentando.
 */
export function isRetryableSendError(err: unknown): boolean {
  // fetch() sem rede: TypeError ("Failed to fetch").
  if (err instanceof TypeError) return true
  if (!err || typeof err !== 'object') return false
  const status = (err as { status?: unknown }).status
  if (typeof status !== 'number') return false
  return status === 0 || status === 502 || status === 503 || status === 504
}

/** Texto da falha de envio que dá para tentar de novo. */
export function retryableSendErrorText(err: unknown, online: boolean): string {
  if (!online) return 'Você está sem internet.'
  if (err instanceof TypeError) return 'Sem conexão com o servidor.'
  const status = (err as { status?: unknown } | null)?.status
  if (typeof status === 'number' && status >= 500) {
    return 'O servidor está reiniciando. Tente de novo em instantes.'
  }
  return 'O servidor não respondeu a tempo.'
}
