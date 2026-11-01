import { create } from 'zustand'

interface CallResumeState {
  /**
   * A retomada da call depois de reabrir o app (atualização) já decidiu:
   * voltou, desistiu ou não havia o que retomar. Sem a ponte de atualizações
   * (app web) não há retomada.
   */
  settled: boolean
  markSettled: () => void
}

const hasResume = (): boolean => typeof window !== 'undefined' && !!window.api?.updates

export const useCallResumeStore = create<CallResumeState>()((set, get) => ({
  settled: !hasResume(),
  markSettled: () => {
    if (!get().settled) set({ settled: true })
  }
}))
