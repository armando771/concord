import { create } from 'zustand'
import type { ServerInvite } from '../api/invites'
import { listInvites, acceptInvite, declineInvite } from '../api/invites'
import { useAuthStore } from './authStore'
import { useServerStore } from './serverStore'

interface InviteState {
  invites: ServerInvite[]
  loading: boolean
  /** A lista já respondeu uma vez: só a primeira carga mostra o skeleton. */
  loaded: boolean
  fetchInvites: () => Promise<void>
  accept: (id: string) => Promise<void>
  decline: (id: string) => Promise<void>
  reset: () => void
}

const isSameSession = (tokenAtStart: string | null): boolean =>
  useAuthStore.getState().accessToken === tokenAtStart

const refetchOnFocus = (): void => {
  if (!useAuthStore.getState().accessToken) return
  useInviteStore.getState().fetchInvites()
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', refetchOnFocus)
}

export const useInviteStore = create<InviteState>()((set, get) => ({
  invites: [],
  loading: false,
  loaded: false,
  fetchInvites: async () => {
    const token = useAuthStore.getState().accessToken
    // Relida a cada foco da janela: com convites na tela, busca por baixo e
    // troca quando chegar (o "carregando" é só para a primeira carga).
    if (!get().loaded && get().invites.length === 0) set({ loading: true })
    try {
      const invites = await listInvites()
      if (!isSameSession(token)) return
      set({ invites: Array.isArray(invites) ? invites : [], loaded: true })
    } catch (err) {
      console.error('[inviteStore] fetchInvites error:', err)
      // Falhou: fica com o que já estava na tela.
    } finally {
      if (get().loading) set({ loading: false })
    }
  },
  accept: async (id) => {
    await acceptInvite(id)
    set({ invites: get().invites.filter((i) => i.id !== id) })
    useServerStore.getState().fetchServers()
  },
  decline: async (id) => {
    await declineInvite(id)
    set({ invites: get().invites.filter((i) => i.id !== id) })
  },
  reset: () => set({ invites: [], loading: false, loaded: false })
}))
