import { create } from 'zustand'
import type { CallKind, CallPhase } from '../lib/callTypes'

/** A chamada em que estou (ou que está tocando para mim). Um só lugar para fase e identificação. */
export interface CallSession {
  phase: CallPhase
  callId: string | null
  kind: CallKind | null
  channelId: string | null
  conversationId: string | null
  serverId: string | null
  /** Nome para a barra e a tela: canal de voz ou a pessoa da DM. */
  name: string
  /** Um moderador me moveu para outro canal: o ciclo de vida entra nele. */
  movedTo: { channelId: string; name: string } | null
  /** O sistema negou o microfone: a pessoa entrou, mas só ouve. */
  micDenied: boolean
}

interface CallSessionState extends CallSession {
  begin: (info: Partial<CallSession> & { callId: string; kind: CallKind; phase: CallPhase }) => void
  setCallId: (callId: string) => void
  setPhase: (phase: CallPhase) => void
  setMicDenied: (micDenied: boolean) => void
  setMovedTo: (movedTo: CallSession['movedTo']) => void
  reset: () => void
}

const IDLE: CallSession = {
  phase: 'idle',
  callId: null,
  kind: null,
  channelId: null,
  conversationId: null,
  serverId: null,
  name: '',
  movedTo: null,
  micDenied: false
}

export const useCallSessionStore = create<CallSessionState>()((set) => ({
  ...IDLE,
  begin: (info) => set({ ...IDLE, ...info }),
  setCallId: (callId) => set({ callId }),
  setPhase: (phase) => set({ phase }),
  setMicDenied: (micDenied) => set({ micDenied }),
  setMovedTo: (movedTo) => set({ movedTo }),
  reset: () => set(IDLE)
}))

export const isInCall = (s: Pick<CallSession, 'phase'>): boolean => s.phase !== 'idle' && s.phase !== 'ringing'
