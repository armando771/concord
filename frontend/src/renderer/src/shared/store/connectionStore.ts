import { create } from 'zustand'
import {
  INITIAL_WS_STATUS,
  wsStatusReducer,
  type WsStatus,
  type WsStatusEvent
} from '../lib/wsStatus'

const browserOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false

interface ConnectionState {
  /** Conexão do chat (WebSocket), para o aviso no topo. */
  ws: WsStatus
  /** navigator.onLine (eventos online/offline). */
  online: boolean
  wsEvent: (event: WsStatusEvent) => void
  setOnline: (online: boolean) => void
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  ws: INITIAL_WS_STATUS,
  online: browserOnline(),
  wsEvent: (event) => set({ ws: wsStatusReducer(get().ws, event, Date.now(), get().online) }),
  setOnline: (online) => {
    if (get().online !== online) set({ online })
  }
}))
