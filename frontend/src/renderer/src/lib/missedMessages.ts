// Mensagens perdidas enquanto o WebSocket do chat estava fora (ex.: deploy do
// servidor): ao reconectar, o app busca a página mais nova de cada sala aberta
// e junta com o que já tinha, sem duplicar nem tocar som.

export interface TimedMessage {
  id: string
  created_at: string
}

export interface MergedMessages<T> {
  /** Lista nova da sala, da mais antiga para a mais nova. */
  messages: T[]
  /** O que não estava na lista (para as não lidas). */
  added: T[]
  /** Perdeu mais que uma página: a lista recomeça pela página nova. */
  reset: boolean
}

const time = (m: TimedMessage): number => Date.parse(m.created_at)

/**
 * `latest` é a página mais nova do servidor (da mais nova para a mais antiga,
 * como a API devolve). Dentro do intervalo da página vale o servidor (apagadas
 * somem, reações e enquetes atualizam); fora dele fica o que já estava: as
 * antigas carregadas e as que chegaram pelo WebSocket depois da busca.
 */
export function mergeMissedMessages<T extends TimedMessage>(
  current: T[],
  latest: T[]
): MergedMessages<T> {
  const page = [...latest].reverse()
  const known = new Set(current.map((m) => m.id))
  const added = page.filter((m) => !known.has(m.id))

  if (page.length === 0) return { messages: [], added: [], reset: false }

  const pageIds = new Set(page.map((m) => m.id))
  const oldest = time(page[0])
  const newest = time(page[page.length - 1])
  const after = current.filter((m) => !pageIds.has(m.id) && time(m) > newest)

  const lastKnown = current.filter((m) => !after.includes(m)).at(-1)
  const reset = !!lastKnown && !pageIds.has(lastKnown.id) && time(lastKnown) < oldest
  if (reset) return { messages: [...page, ...after], added, reset }

  const before = current.filter((m) => !pageIds.has(m.id) && time(m) < oldest)
  return { messages: [...before, ...page, ...after], added, reset: false }
}
