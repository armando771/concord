import { create } from 'zustand'
import { ApiError } from '../../../shared/api/client'
import { fetchPendentes, responderEnquete, type Enquete } from '../api/enquete'
import { useBadgeStore } from '../../levels/store/badgeStore'
import { achaOpcao, reacaoDe, type Etapa, type Reacao } from '../lib/enquete'

interface EnqueteState {
  /** De quem é o estado abaixo: trocar de conta descarta tudo. */
  userId: string | null
  /** Pendentes; a primeira é a que está na tela. */
  pendentes: Enquete[]
  /** A carga das pendentes deste userId já deu certo: carregar de novo é no-op. */
  carregado: boolean
  /** Opção marcada na enquete atual. */
  selecao: string | null
  etapa: Etapa
  reacao: Reacao | null
  enviando: boolean
  /** O último envio falhou (rede, servidor): a confirmação continua aberta. */
  erro: boolean
  carregar: (userId: string) => Promise<void>
  selecionar: (opcaoId: string) => void
  continuar: () => void
  voltar: () => void
  confirmar: () => Promise<void>
  fecharReacao: () => void
  reset: () => void
}

const INICIAL = {
  userId: null,
  pendentes: [] as Enquete[],
  carregado: false,
  selecao: null,
  etapa: 'pergunta' as Etapa,
  reacao: null,
  enviando: false,
  erro: false
}

/** 403/409/404: o servidor já decidiu (respondeu em outro aparelho, fora do corte). */
function jaDecidido(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 404 || err.status === 409)
}

export const useEnqueteStore = create<EnqueteState>()((set, get) => ({
  ...INICIAL,

  carregar: async (userId) => {
    if (get().userId === userId && get().carregado) return
    if (get().userId !== userId) set({ ...INICIAL, userId })
    try {
      const pendentes = await fetchPendentes()
      if (get().userId === userId) set({ pendentes, carregado: true })
    } catch (err) {
      console.error('[enqueteStore] fetch failed:', err)
    }
  },

  selecionar: (opcaoId) => {
    if (achaOpcao(get().pendentes[0], opcaoId)) set({ selecao: opcaoId, erro: false })
  },

  continuar: () => {
    if (get().selecao) set({ etapa: 'confirmacao', erro: false })
  },

  voltar: () => set({ etapa: 'pergunta', erro: false }),

  confirmar: async () => {
    const { userId, enviando, selecao, pendentes } = get()
    const enquete = pendentes[0]
    const opcao = achaOpcao(enquete, selecao ?? '')
    if (!userId || enviando || !enquete || !opcao) return
    set({ enviando: true, erro: false })
    try {
      await responderEnquete(enquete.id, opcao.id)
      if (get().userId !== userId) return
      set({
        pendentes: get().pendentes.slice(1),
        selecao: null,
        etapa: 'pergunta',
        reacao: reacaoDe(opcao),
        enviando: false
      })
      // O badge já existe no servidor; não depende do aviso pelo websocket.
      if (opcao.badge) {
        useBadgeStore
          .getState()
          .ensureBadges(userId, true)
          .catch((e) => console.error('[enqueteStore] ensureBadges failed:', e))
      }
    } catch (err) {
      if (get().userId !== userId) return
      if (jaDecidido(err)) {
        set({ enviando: false, pendentes: [], carregado: false })
        await get().carregar(userId)
        return
      }
      console.error('[enqueteStore] responder failed:', err)
      set({ enviando: false, erro: true })
    }
  },

  fecharReacao: () => set({ reacao: null }),

  reset: () => set({ ...INICIAL })
}))
