import { useEffect, useState } from 'react'
import { getBirthday, setBirthday, type Birthday } from '../api/birthdays'
import { trySaveBirthday } from '../lib/birthday'

const EMPTY: Birthday = { day: null, month: null, year: null, announce: true }

export interface BirthdayState {
  /** null enquanto carrega. */
  birthday: Birthday | null
  /** Salva; devolve a mensagem de erro (null = salvou). */
  save: (next: Birthday) => Promise<string | null>
}

/** O aniversário da própria conta (Minha conta). Sem resposta do servidor, começa vazio. */
export function useBirthday(): BirthdayState {
  const [birthday, setLocal] = useState<Birthday | null>(null)

  useEffect(() => {
    getBirthday()
      .then(setLocal)
      .catch(() => setLocal(EMPTY))
  }, [])

  const save = async (next: Birthday): Promise<string | null> => {
    const result = await trySaveBirthday(next, setBirthday)
    if (result.saved) setLocal(result.saved)
    return result.error ?? null
  }

  return { birthday, save }
}
