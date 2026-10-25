// Mensagens perdidas enquanto o WebSocket do chat estava fora (ex.: deploy do
// servidor): ao reconectar, o app busca a página mais nova de cada sala aberta
// e junta com o que já tinha, sem duplicar nem tocar som. A junção em si é a
// mesma de todo o chat (mergeMessages: uma por id, em ordem (created_at, id));
// aqui só se decide o que da lista atual fica e o que conta como não lido.
import {
  compareMessages,
  compareTimestamps,
  mergeMessages,
  type OrderedMessage
} from './messageOrder'

export interface MergedMessages<T> {
  /** Lista nova da sala, em ordem (created_at, id). */
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

/** A mensagem mais nova pela ordem do chat (null numa sala vazia). */
export function newestMessage<T extends OrderedMessage>(messages: T[]): T | null {
  let newest: T | null = null
  for (const m of messages) if (!newest || compareMessages(m, newest) > 0) newest = m
  return newest
}

/**
 * `latest` é a página mais nova do servidor (em qualquer ordem; a API manda da
 * mais nova para a mais antiga). Dentro do intervalo da página vale o servidor
 * (apagadas somem, reações e enquetes atualizam); fora dele fica o que já
 * estava: as antigas carregadas e as que chegaram pelo WebSocket depois da
 * busca. Mensagens com o mesmo horário de uma borda da página ficam (podem
 * estar logo fora dela), para nada sumir por engano.
 *
 * `knownBefore`: a mensagem mais nova que a sala tinha quando a busca começou
 * (o padrão é a de `current`). Uma mensagem que chegou pelo WS durante a busca
 * não pode fazer as perdidas, mais velhas que ela, deixarem de contar.
 */
export function mergeMissedMessages<T extends OrderedMessage>(
  current: T[],
  latest: T[],
  knownBefore: T | null = newestMessage(current)
): MergedMessages<T> {
  // Página vazia: nada a acrescentar, e não dá para saber o que apagar.
  if (latest.length === 0) return { messages: current, added: [], unseen: [], reset: false }

  const page = mergeMessages([], latest)
  const known = new Set(current.map((m) => m.id))
  const added = page.filter((m) => !known.has(m.id))
  const unseen = knownBefore ? added.filter((m) => compareMessages(m, knownBefore) > 0) : added

  const pageIds = new Set(page.map((m) => m.id))
  const oldest = page[0].created_at
  const newest = page[page.length - 1].created_at
  const outside = current.filter((m) => !pageIds.has(m.id))
  const before = outside.filter((m) => compareTimestamps(m.created_at, oldest) <= 0)
  const beforeIds = new Set(before.map((m) => m.id))
  const after = outside.filter(
    (m) => !beforeIds.has(m.id) && compareTimestamps(m.created_at, newest) >= 0
  )

  // A lista atual não encosta na página: perdeu mais que uma página.
  const afterIds = new Set(after.map((m) => m.id))
  const lastKnown = newestMessage(current.filter((m) => !afterIds.has(m.id)))
  const reset =
    !!lastKnown && !pageIds.has(lastKnown.id) && compareTimestamps(lastKnown.created_at, oldest) < 0
  const kept = reset ? after : [...before, ...after]

  return { messages: mergeMessages(kept, page), added, unseen, reset }
}
