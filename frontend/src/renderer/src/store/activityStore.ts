import { create } from 'zustand'
import type { WsEvent } from '../api/ws'
import { activityLaunchUrl, findActivity, validateActivityLink } from '../../../shared/activities'
import {
  activityReducer,
  INITIAL_ACTIVITY_STATE,
  type ActivityAction,
  type ActivityState,
  type RawCallActivity
} from '../lib/activityState'
import { IS_WEB } from '../lib/config'
import { useAuthStore } from './authStore'
import { useChatStore } from './chatStore'
import { showToast } from './toastStore'

// Atividades da chamada. O estado compartilhado vem do backend (call:activity);
// o jogo aberto aqui é uma janela própria no desktop e um painel com iframe no
// navegador (ActivityPanel). A voz segue no app enquanto isso.

interface ActivityStoreState extends ActivityState {
  /** Navegador: painel do jogo minimizado (o iframe continua rodando). */
  panelMinimized: boolean
  /** Abre a atividade na chamada. Devolve a mensagem de erro, ou null. */
  start: (callId: string, activityId: string, link: string) => Promise<string | null>
  /** Entra na atividade aberta por outra pessoa (ou volta para o jogo). */
  join: () => Promise<void>
  /** Quem abriu: compartilha (ou troca) o link da sala. Devolve erro ou null. */
  shareLink: (link: string) => string | null
  /** Quem abriu: encerra a atividade para todos. */
  stop: () => void
  /** Fecha o jogo aqui (quem abriu, ao fechar, encerra para todos). */
  closeLocal: () => void
  setPanelMinimized: (minimized: boolean) => void
  /** Chamada atual (callStore). */
  setCall: (callId: string | null) => void
  /** Estado da chamada lido do backend. */
  hydrate: (callId: string, activity: RawCallActivity | null) => void
  handleWsEvent: (event: WsEvent) => void
}

/** Sem eco do servidor nesse prazo, o pedido de abrir é descartado. */
const PENDING_TIMEOUT_MS = 8000

function meId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

/** Desktop: janela própria. Navegador: o painel aparece pelo estado `local`. */
async function openGame(activityId: string, url: string): Promise<boolean> {
  if (IS_WEB) return true
  const api = window.api?.activities
  if (!api) return false
  try {
    return await api.open(activityId, url)
  } catch {
    return false
  }
}

function closeGame(): void {
  if (!IS_WEB) window.api?.activities?.close()
}

export const useActivityStore = create<ActivityStoreState>()((set, get) => {
  const snapshot = (): ActivityState => {
    const { callId, shared, local, pending } = get()
    return { callId, shared, local, pending }
  }

  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  const clearPendingTimer = (): void => {
    if (pendingTimer) clearTimeout(pendingTimer)
    pendingTimer = null
  }

  /**
   * Aplica a ação. Se o jogo aberto aqui sumiu do estado, fecha a janela; se o
   * servidor aceitou o meu pedido (eco do call:activity), abre o jogo agora.
   */
  const dispatch = (action: ActivityAction): void => {
    const prev = snapshot()
    const next = activityReducer(prev, action)
    if (next === prev) return
    set({ ...next, ...(next.local ? {} : { panelMinimized: false }) })
    if (!next.pending) clearPendingTimer()
    const accepted = prev.pending !== null && next.pending === null && next.local === prev.pending
    if (accepted && next.local) {
      set({ panelMinimized: false })
      const { activityId, url } = next.local
      void openGame(activityId, url).then((ok) => {
        if (ok) return
        showToast.error('Não foi possível abrir a atividade.')
        // O servidor já mostra para todos: encerra para não ficar "aberta" sem ninguém.
        get().stop()
      })
      return
    }
    if (prev.local && !next.local) closeGame()
  }

  const isMine = (): boolean => {
    const { shared } = get()
    const me = meId()
    return !!shared && !!me && shared.startedBy.id === me
  }

  const openHere = async (activityId: string, url: string): Promise<boolean> => {
    const ok = await openGame(activityId, url)
    if (!ok) {
      showToast.error('Não foi possível abrir a atividade.')
      return false
    }
    dispatch({ type: 'opened', activityId, url })
    set({ panelMinimized: false })
    return true
  }

  return {
    ...INITIAL_ACTIVITY_STATE,
    panelMinimized: false,

    start: async (callId, activityId, link) => {
      const activity = findActivity(activityId)
      const checked = validateActivityLink(activityId, link)
      if (!activity) return 'Atividade desconhecida.'
      if (!checked.ok) return checked.error
      if (get().callId !== callId) return 'Entre em uma chamada para abrir uma atividade.'
      const launchUrl = activityLaunchUrl(activityId, checked.url) ?? activity.homeUrl
      // O jogo só abre quando o servidor aceitar (eco do call:activity); se ele
      // recusar (call:activity:error) ou não responder, nada fica aberto.
      dispatch({ type: 'requested', activityId, url: launchUrl })
      clearPendingTimer()
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        if (!get().pending) return
        dispatch({ type: 'rejected' })
        showToast.error('O servidor não respondeu. Tente abrir a atividade de novo.')
      }, PENDING_TIMEOUT_MS)
      useChatStore.getState().sendEvent('call:activity', {
        call_id: callId,
        activity_id: activityId,
        url: checked.url
      })
      return null
    },

    join: async () => {
      const { shared, local } = get()
      if (!shared) return
      if (local && IS_WEB) {
        set({ panelMinimized: false })
        return
      }
      const url = local?.url ?? activityLaunchUrl(shared.activityId, shared.url)
      if (url) await openHere(shared.activityId, url)
    },

    shareLink: (link) => {
      const { shared } = get()
      if (!shared || !isMine()) return 'Só quem abriu a atividade pode compartilhar o link.'
      const checked = validateActivityLink(shared.activityId, link)
      if (!checked.ok) return checked.error
      useChatStore.getState().sendEvent('call:activity', {
        call_id: shared.callId,
        activity_id: shared.activityId,
        url: checked.url
      })
      return null
    },

    stop: () => {
      const { shared } = get()
      if (shared && isMine()) {
        useChatStore.getState().sendEvent('call:activity:stop', { call_id: shared.callId })
      }
      dispatch({ type: 'closed' })
    },

    closeLocal: () => {
      // Quem abriu e fechou o jogo encerrou a atividade.
      if (isMine()) {
        get().stop()
        return
      }
      dispatch({ type: 'closed' })
    },

    setPanelMinimized: (panelMinimized) => set({ panelMinimized }),

    setCall: (callId) => dispatch({ type: 'call', callId }),

    hydrate: (callId, activity) => dispatch({ type: 'hydrate', callId, activity }),

    handleWsEvent: (event) => {
      const payload = (event.payload ?? {}) as Record<string, unknown>
      switch (event.type) {
        case 'call:activity': {
          const before = get().shared
          dispatch({
            type: 'started',
            activity: payload as unknown as RawCallActivity,
            meId: meId()
          })
          const after = get().shared
          // Aviso para os outros só quando a atividade é nova (não troca de link).
          const isNew =
            after &&
            (!before ||
              before.activityId !== after.activityId ||
              before.startedBy.id !== after.startedBy.id)
          if (isNew && after.startedBy.id !== meId()) {
            const name = findActivity(after.activityId)?.name ?? 'uma atividade'
            const who = after.startedBy.display_name || after.startedBy.username || 'Alguém'
            showToast.info(`${who} abriu ${name} na chamada.`)
          }
          return
        }
        case 'call:activity:stop':
          dispatch({
            type: 'stopped',
            callId: String(payload.call_id ?? ''),
            startedBy: typeof payload.started_by === 'string' ? payload.started_by : undefined
          })
          return
        case 'call:activity:error':
          dispatch({ type: 'rejected' })
          showToast.error(
            typeof payload.message === 'string' && payload.message
              ? payload.message
              : 'Não foi possível abrir a atividade.'
          )
          return
        default:
          return
      }
    }
  }
})

// Desktop: a janela do jogo fechou (X da janela ou o app fechou).
if (typeof window !== 'undefined') {
  window.api?.activities?.onClosed((activityId) => {
    if (useActivityStore.getState().local?.activityId === activityId) {
      useActivityStore.getState().closeLocal()
    }
  })
}
