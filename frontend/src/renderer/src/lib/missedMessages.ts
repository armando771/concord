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
  /** O que não estava na lista. */
  added: T[]
  /**
   * Do que entrou, o que é mais novo que a última mensagem que já estava na
   * lista: só isso conta como não lido (as antigas da página o usuário já viu
   * ou nunca abriu).
   */
  unseen: T[]
  /** Perdeu mais que uma página: a lista recomeça pela página nova. */
  reset: boolean
}

const time = (m: TimedMessage): number => Date.parse(m.created_at)

/**
 * `latest` é a página mais nova do servidor (da mais nova para a mais antiga,
 * como a API devolve). Dentro do intervalo da página vale o servidor (apagadas
 * somem, reações e enquetes atualizam); fora dele fica o que já estava: as
 * antigas carregadas e as que chegaram pelo WebSocket depois da busca.
 * Mensagens com o mesmo horário da borda (o Date.parse corta microssegundos)
 * ficam, para nada sumir por engano.
 */
export function mergeMissedMessages<T extends TimedMessage>(
  current: T[],
  latest: T[]
): MergedMessages<T> {
  // Página vazia: nada a acrescentar, e não dá para saber o que apagar.
  if (latest.length === 0) return { messages: current, added: [], unseen: [], reset: false }

  const page = [...latest].reverse()
  const known = new Set(current.map((m) => m.id))
  const added = page.filter((m) => !known.has(m.id))
  const newestKnown = current.length > 0 ? Math.max(...current.map(time)) : -Infinity
  const unseen = added.filter((m) => time(m) > newestKnown)

  const pageIds = new Set(page.map((m) => m.id))
  const oldest = time(page[0])
  const newest = time(page[page.length - 1])
  const outside = current.filter((m) => !pageIds.has(m.id))
  const before = outside.filter((m) => time(m) <= oldest)
  const after = outside.filter((m) => time(m) >= newest && !before.includes(m))

  const lastKnown = current.filter((m) => !after.includes(m)).at(-1)
  const reset = !!lastKnown && !pageIds.has(lastKnown.id) && time(lastKnown) < oldest
  if (reset) return { messages: [...page, ...after], added, unseen, reset }

  return { messages: [...before, ...page, ...after], added, unseen, reset: false }
}
