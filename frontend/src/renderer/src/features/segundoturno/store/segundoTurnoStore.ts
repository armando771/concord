import { create } from 'zustand'
import { ApiError } from '../../../shared/api/client'
import {
  fetchSegundoTurno,
  responderSegundoTurno,
  type SegundoTurnoEstado
} from '../api/segundoTurno'
import { useBadgeStore } from '../../levels/store/badgeStore'
import { gravarDispensa, lerDispensa, type Reacao } from '../lib/segundoTurno'

interface SegundoTurnoState {
  /** De quem é o estado abaixo: trocar de conta descarta tudo. */
  userId: string | null
  estado: SegundoTurnoEstado | null
  dispensado: boolean
  reacao: Reacao | null
  enviando: boolean
  /** O último envio falhou (rede, servidor): o banner continua aberto. */
  erro: boolean
  carregar: (userId: string) => Promise<void>
  responder: (fezOL: boolean) => Promise<void>
  dispensar: () => void
  reabrir: () => void
  fecharReacao: () => void
  reset: () => void
}

const INICIAL = {
  userId: null,
  estado: null,
  dispensado: false,
  reacao: null,
  enviando: false,
  erro: false
}

/** 403/409: o servidor já decidiu (respondeu em outro aparelho, fora do corte). */
function jaDecidido(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 409)
}

export const useSegundoTurnoStore = create<SegundoTurnoState>()((set, get) => ({
  ...INICIAL,

  carregar: async (userId) => {
    if (get().userId === userId && get().estado) return
    set({ ...INICIAL, userId, dispensado: lerDispensa(userId) })
    try {
      const estado = await fetchSegundoTurno()
      if (get().userId === userId) set({ estado })
    } catch (err) {
      console.error('[segundoTurnoStore] fetch failed:', err)
    }
  },

  responder: async (fezOL) => {
    const { userId, enviando } = get()
    if (!userId || enviando) return
    set({ enviando: true, erro: false })
    try {
      const estado = await responderSegundoTurno(fezOL)
      if (get().userId !== userId) return
      set({ estado, enviando: false, reacao: fezOL ? 'sim' : 'nao' })
      // O badge já existe no servidor; não depende do aviso pelo websocket.
      if (fezOL) void useBadgeStore.getState().ensureBadges(userId, true)
    } catch (err) {
      if (get().userId !== userId) return
      if (jaDecidido(err)) {
        set({ enviando: false, estado: null })
        await get().carregar(userId)
        return
      }
      console.error('[segundoTurnoStore] responder failed:', err)
      set({ enviando: false, erro: true })
    }
  },

  dispensar: () => {
    const { userId } = get()
    if (userId) gravarDispensa(userId)
    set({ dispensado: true, erro: false })
  },

  // Só nesta sessão: ao abrir o app de novo o banner volta a ficar no botão.
  reabrir: () => set({ dispensado: false }),

  fecharReacao: () => set({ reacao: null }),

  reset: () => set({ ...INICIAL })
}))
