import { create } from 'zustand'
import { useCallStore } from '../../call/store/callStore'

/**
 * Estado da atualização do app (Electron). Fica num store, e não no
 * componente, para sobreviver à troca entre a sidebar de amigos e a de
 * servidor — o download em andamento não some da tela.
 */
interface UpdateState {
  /** Versão nova encontrada (ainda baixando ou já pronta). */
  version: string | null
  /** Versão baixada e verificada. */
  readyVersion: string | null
  /** A pessoa clicou em Atualizar. */
  requested: boolean
  progress: number
  error: string | null
  confirming: boolean
  /** Estado que o main já tinha ao abrir; não conta como "versão nova". */
  seed(status: { version: string; ready: boolean } | null): void
  /** `true` se a versão é diferente da que já estava no store. */
  setAvailable(version: string): boolean
  setReady(version: string): void
  setProgress(percent: number): void
  setError(message: string): void
  setConfirming(value: boolean): void
  install(): void
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  version: null,
  readyVersion: null,
  requested: false,
  progress: 0,
  error: null,
  confirming: false,

  seed: (status) => {
    if (!status) return
    set({ version: status.version, readyVersion: status.ready ? status.version : null })
  },

  setAvailable: (version) => {
    if (get().version === version) return false
    // Versão mais nova substitui a que já estava pronta.
    set({ version, readyVersion: null, progress: 0 })
    return true
  },

  setReady: (version) => set({ version, readyVersion: version }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ requested: false, error }),
  setConfirming: (confirming) => set({ confirming }),

  install: () => {
    const updates = typeof window === 'undefined' ? undefined : window.api?.updates
    if (!updates) return
    set({ error: null, confirming: false, requested: true })
    const call = useCallStore.getState()
    // Canal: mantém a chamada durante o download e preserva o snapshot até
    // o main gravá-lo imediatamente antes de instalar. DM não é retomada.
    if (call.type === 'channel' && call.status === 'active') {
      updates.install()
      return
    }
    const wasInCall = call.status !== 'idle'
    call.endCall()
    setTimeout(() => updates.install(), wasInCall ? 250 : 0)
  }
}))
