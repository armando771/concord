// Estado do campo de mensagem separado por sala. O ServerView e o GroupChat
// reaproveitam o mesmo ChatPane ao trocar de canal ou grupo: o que for estado
// da sala (rascunho, "enviando…", menção aberta) não pode passar para a outra.

export type RoomMap<T> = Readonly<Record<string, T>>

/** O valor da sala, ou `initial` se ela ainda não tem. */
export function roomValue<T>(map: RoomMap<T>, room: string, initial: T): T {
  return room in map ? map[room] : initial
}

/**
 * Grava `next` (valor ou função do valor atual) só na sala pedida. Voltar ao
 * valor inicial tira a sala do mapa; sem mudança, devolve o mesmo mapa.
 */
export function roomUpdate<T>(
  map: RoomMap<T>,
  room: string,
  initial: T,
  next: T | ((prev: T) => T)
): RoomMap<T> {
  const prev = roomValue(map, room, initial)
  const value = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
  if (Object.is(value, prev)) return map
  if (Object.is(value, initial)) {
    const rest = { ...map }
    delete rest[room]
    return rest
  }
  return { ...map, [room]: value }
}
