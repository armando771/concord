import { useCallback, useState } from 'react'
import { roomUpdate, roomValue, type RoomMap } from '../lib/roomState'

/**
 * Como o useState, mas o valor é de cada sala: trocar de sala mostra o valor
 * dela (ou `initial`), e uma resposta que chega depois só mexe na sala que
 * a pediu. `initial` tem que ser estável (null, false, 0...).
 */
export function useRoomState<T>(
  room: string,
  initial: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const [map, setMap] = useState<RoomMap<T>>({})
  const set = useCallback(
    (next: T | ((prev: T) => T)) => setMap((m) => roomUpdate(m, room, initial, next)),
    [room, initial]
  )
  return [roomValue(map, room, initial), set]
}
