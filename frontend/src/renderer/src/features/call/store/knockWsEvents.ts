// Eventos de WS da sala trancada: trancar/destrancar, pedidos de entrada
// (quem está dentro) e a resposta ao meu pedido (quem bate na porta).
import { showToast } from '../../../shared/store/toastStore'
import { deliverKnockAlert } from '../lib/knockAlert'
import { playSound } from '../lib/sounds'
import type { CallState, CallUserInfo } from './callStore'

type StateUpdate = Partial<CallState> | ((s: CallState) => Partial<CallState>)

export interface KnockEventDeps {
  get: () => CallState
  set: (update: StateUpdate) => void
}

type Payload = Record<string, unknown>

interface LockPayload {
  call_id: string
  channel_id?: string | null
  locked: boolean
  by: CallUserInfo
}

interface KnockPayload {
  call_id: string
  channel_id?: string | null
  user: CallUserInfo
}

interface KnockResolvedPayload {
  call_id: string
  user_id: string
  accepted: boolean
  reason: string
  by?: CallUserInfo | null
}

interface KnockAnswerPayload {
  call_id: string
  channel_id?: string | null
  server_id?: string | null
  reason: 'accepted' | 'declined' | 'expired' | 'unlocked' | 'ended'
  by?: CallUserInfo | null
}

/** Quanto tempo o aviso "pedido recusado" fica no canal. */
const KNOCK_DECLINED_MS = 4000

/** Limpa o aviso de pedido recusado. */
let knockDeclinedTimer: ReturnType<typeof setTimeout> | null = null

function clearDeclinedTimer(): void {
  if (knockDeclinedTimer) clearTimeout(knockDeclinedTimer)
  knockDeclinedTimer = null
}

function upsert(list: CallUserInfo[], user: CallUserInfo): CallUserInfo[] {
  return list.some((p) => p.id === user.id) ? list : [...list, user]
}

/** Marca a sala (nas listas do servidor e, se for a minha, no estado da call) como trancada ou não. */
function applyLock(s: CallState, p: LockPayload): Partial<CallState> {
  const serverCalls = { ...s.serverCalls }
  for (const [chId, entry] of Object.entries(serverCalls)) {
    if (entry.call?.id === p.call_id) {
      serverCalls[chId] = {
        ...entry,
        call: entry.call ? { ...entry.call, locked: p.locked } : null
      }
    }
  }
  return { serverCalls, locked: s.callId === p.call_id ? p.locked : s.locked }
}

function onLock({ get, set }: KnockEventDeps, payload: Payload): void {
  const p = payload as unknown as LockPayload
  set((s) => applyLock(s, p))
  if (get().callId === p.call_id) playSound(p.locked ? 'lock' : 'unlock')
}

function onKnock({ get, set }: KnockEventDeps, payload: Payload): void {
  const p = payload as unknown as KnockPayload
  if (get().callId !== p.call_id) return
  deliverKnockAlert(p.user, get())
  set((s) => ({ joinRequests: upsert(s.joinRequests, p.user) }))
}

function onKnockResolved({ get, set }: KnockEventDeps, payload: Payload): void {
  const p = payload as unknown as KnockResolvedPayload
  if (get().callId !== p.call_id) return
  set((s) => ({ joinRequests: s.joinRequests.filter((r) => r.id !== p.user_id) }))
}

function onKnockAccepted({ get, set }: KnockEventDeps, payload: Payload): void {
  const p = payload as unknown as KnockAnswerPayload
  const { knock } = get()
  if (!knock || knock.callId !== p.call_id) return
  clearDeclinedTimer()
  const chId = p.channel_id ?? knock.channelId
  set({ knock: null, admittedChannelId: chId })
  const byName = p.by?.display_name || p.by?.username
  showToast.success(
    byName ? `${byName} permitiu sua entrada na sala!` : 'Sua entrada na sala foi permitida!'
  )
  void get().joinVoiceChannel(chId)
}

function onKnockDeclined({ get, set }: KnockEventDeps, payload: Payload): void {
  const p = payload as unknown as KnockAnswerPayload
  const { knock } = get()
  if (!knock || knock.callId !== p.call_id) return
  clearDeclinedTimer()
  if (p.reason === 'ended' || p.reason === 'unlocked') {
    // A sala acabou ou destrancou: pode entrar livremente
    set({ knock: null })
    showToast.info(
      p.reason === 'ended'
        ? 'A chamada terminou. A sala agora está livre.'
        : 'A sala foi destrancada!'
    )
    return
  }
  set({ knock: { ...knock, status: 'declined' } })
  knockDeclinedTimer = setTimeout(() => {
    set((s) => (s.knock?.callId === p.call_id ? { knock: null } : {}))
  }, KNOCK_DECLINED_MS)
}

function onKnockError(_deps: KnockEventDeps, payload: Payload): void {
  showToast.error((payload.message as string) ?? 'Não foi possível solicitar entrada.')
}

/** Um handler por tipo de evento (o callStore consulta antes do seu próprio mapa). */
export function createKnockEventHandlers(
  deps: KnockEventDeps
): Record<string, (payload: Payload) => void> {
  return {
    'call:lock': (p) => onLock(deps, p),
    'call:knock': (p) => onKnock(deps, p),
    'call:knock_resolved': (p) => onKnockResolved(deps, p),
    'call:knock_accepted': (p) => onKnockAccepted(deps, p),
    'call:knock_declined': (p) => onKnockDeclined(deps, p),
    'call:knock_error': (p) => onKnockError(deps, p)
  }
}
