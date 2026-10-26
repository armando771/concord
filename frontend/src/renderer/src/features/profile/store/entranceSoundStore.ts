import { create } from 'zustand'
import { ApiError } from '../../../shared/api/client'
import { useAuthStore, type User } from '../../auth/store/authStore'
import { readMediaMeta } from '../../chat/lib/readMediaMeta'
import { deleteEntranceSound, uploadEntranceSound } from '../api/entranceSound'
import {
  entranceSoundDurationError,
  entranceSoundFileError,
  entranceSoundSaveError
} from '../lib/entranceSoundFile'

/**
 * Som de entrada (Configurações → Perfis): troca e remoção salvam na hora,
 * como o aniversário. O som salvo fica no usuário (authStore).
 */
interface EntranceSoundState {
  busy: 'upload' | 'remove' | null
  error: string | null
  pick: (file: File) => Promise<void>
  remove: () => Promise<void>
}

/** O status da sessão é o escolhido; a resposta também traz, mas o local manda. */
function commitUser(latest: User): void {
  const current = useAuthStore.getState().user
  useAuthStore.getState().setUser({ ...latest, status: current?.status ?? latest.status })
}

export const useEntranceSoundStore = create<EntranceSoundState>()((set, get) => {
  const save = async (busy: 'upload' | 'remove', call: () => Promise<User>): Promise<void> => {
    set({ busy, error: null })
    try {
      commitUser(await call())
    } catch (err) {
      set({ error: entranceSoundSaveError(err, err instanceof ApiError ? err.status : undefined) })
    } finally {
      set({ busy: null })
    }
  }

  return {
    busy: null,
    error: null,

    pick: async (file) => {
      if (get().busy) return
      const fileError = entranceSoundFileError(file)
      if (fileError) return set({ error: fileError })
      const { duration_ms: durationMs } = await readMediaMeta(file, 'audio')
      const durationError = entranceSoundDurationError(durationMs)
      if (durationError || !durationMs) return set({ error: durationError })
      await save('upload', () => uploadEntranceSound(file, durationMs))
    },

    remove: () => save('remove', deleteEntranceSound)
  }
})
