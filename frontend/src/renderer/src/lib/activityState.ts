import {
  activityLaunchUrl,
  findActivity,
  validateActivityLink,
  type ActivityDefinition
} from '../../../shared/activities'
import { serverDisplayName } from './serverNames'

// Estado das atividades na chamada. Puro para poder testar: o activityStore só
// despacha ações (eventos do WS, estado da chamada, janela/painel do jogo).

export interface ActivityUser {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

/** Formato do backend (call:activity e `activity` no estado da chamada). */
export interface RawCallActivity {
  call_id: string
  activity_id: string
  url: string
  started_by: ActivityUser
  /** Ids de quem está jogando (o backend sempre inclui quem abriu). */
  players?: string[]
}

/** Atividade aberta na chamada (todos veem a barra "Fulano abriu …"). */
export interface CallActivity {
  callId: string
  activityId: string
  /** Link da sala; vazio = sem link (quem entra abre a página do jogo). */
  url: string
  startedBy: ActivityUser
  /** Quem está com o jogo aberto agora (selo na lista e nos tiles). */
  players: string[]
}

/** O jogo aberto neste app (janela no desktop, painel no navegador). */
export interface LocalActivity {
  activityId: string
  url: string
}

export interface ActivityState {
  callId: string | null
  shared: CallActivity | null
  local: LocalActivity | null
  /** Pedi para abrir e espero o servidor aceitar (o jogo só abre depois). */
  pending: LocalActivity | null
}

export const INITIAL_ACTIVITY_STATE: ActivityState = {
  callId: null,
  shared: null,
  local: null,
  pending: null
}

export type ActivityAction =
  /** Entrei, saí ou troquei de chamada. */
  | { type: 'call'; callId: string | null }
  /** Estado da chamada lido do backend (quem entra depois). */
  | { type: 'hydrate'; callId: string; activity: RawCallActivity | null }
  /** call:activity (meId: o eco do meu pedido abre o jogo pendente). */
  | { type: 'started'; activity: RawCallActivity; meId?: string | null }
  /** call:activity:players: quem está jogando mudou. */
  | { type: 'players'; callId: string; activityId: string; players: unknown }
  /** call:activity:stop */
  | { type: 'stopped'; callId: string; startedBy?: string }
  /** Pedi para abrir (url = o que abrir quando o servidor aceitar). */
  | { type: 'requested'; activityId: string; url: string }
  /** O servidor recusou (call:activity:error) ou não respondeu. */
  | { type: 'rejected' }
  /** Abri o jogo aqui. */
  | { type: 'opened'; activityId: string; url: string }
  /** Fechei o jogo aqui. */
  | { type: 'closed' }

/** Ids em texto, sem repetidos; quem abriu sempre conta como jogador. */
function parsePlayers(raw: unknown, starterId: string): string[] {
  const ids = new Set<string>([starterId])
  if (Array.isArray(raw)) {
    for (const id of raw) if (typeof id === 'string' && id) ids.add(id)
  }
  return [...ids]
}

function parseActivity(raw: RawCallActivity | null | undefined): CallActivity | null {
  if (!raw || typeof raw !== 'object') return null
  const { call_id: callId, activity_id: activityId, started_by: startedBy } = raw
  if (typeof callId !== 'string' || !callId || typeof activityId !== 'string') return null
  if (!findActivity(activityId) || !startedBy || typeof startedBy.id !== 'string') return null
  const link = validateActivityLink(activityId, typeof raw.url === 'string' ? raw.url : '')
  return {
    callId,
    activityId,
    url: link.ok ? link.url : '',
    startedBy: {
      id: startedBy.id,
      username: startedBy.username ?? '',
      display_name: startedBy.display_name ?? '',
      avatar_url: startedBy.avatar_url ?? null
    },
    players: parsePlayers(raw.players, startedBy.id)
  }
}

export function activityReducer(state: ActivityState, action: ActivityAction): ActivityState {
  switch (action.type) {
    case 'call':
      if (action.callId === state.callId) return state
      return { callId: action.callId, shared: null, local: null, pending: null }

    case 'hydrate': {
      if (!state.callId || action.callId !== state.callId) return state
      const shared = parseActivity(action.activity)
      if (shared && shared.callId !== state.callId) return state
      return { ...state, shared }
    }

    case 'started': {
      const shared = parseActivity(action.activity)
      if (!shared || !state.callId || shared.callId !== state.callId) return state
      const pending = state.pending
      const accepted =
        pending !== null &&
        !!action.meId &&
        shared.startedBy.id === action.meId &&
        shared.activityId === pending.activityId
      if (!accepted) return { ...state, shared }
      return { ...state, shared, local: pending, pending: null }
    }

    case 'requested':
      if (!state.callId || !findActivity(action.activityId)) return state
      return { ...state, pending: { activityId: action.activityId, url: action.url } }

    case 'rejected':
      return state.pending ? { ...state, pending: null } : state

    case 'stopped': {
      const current = state.shared
      if (!current || action.callId !== current.callId) return state
      if (action.startedBy && action.startedBy !== current.startedBy.id) return state
      return { ...state, shared: null }
    }

    case 'players': {
      const current = state.shared
      if (
        !current ||
        action.callId !== current.callId ||
        action.activityId !== current.activityId
      ) {
        return state
      }
      return {
        ...state,
        shared: { ...current, players: parsePlayers(action.players, current.startedBy.id) }
      }
    }

    case 'opened':
      if (!state.callId || !findActivity(action.activityId)) return state
      return { ...state, local: { activityId: action.activityId, url: action.url } }

    case 'closed':
      return state.local ? { ...state, local: null } : state

    default:
      return state
  }
}

export interface ActivityBanner {
  /** "Fulano abriu Krunker.io" / "Você abriu Krunker.io". */
  text: string
  activityName: string
  /** Fui eu que abri (encerrar, compartilhar link). */
  mine: boolean
  /** Já estou com o jogo aberto aqui. */
  joined: boolean
  /** Quem abriu compartilhou o link da sala. */
  hasLink: boolean
  /** O que o Entrar abre. */
  launchUrl: string
}

/**
 * Quem abriu a atividade. Numa call de canal, `nicknames` traz os apelidos
 * daquele servidor; na DM não vem (vale o nome de exibição).
 */
export function activityStarterName(
  shared: CallActivity,
  nicknames: Record<string, string> | undefined
): string {
  return serverDisplayName(
    { nickname: nicknames?.[shared.startedBy.id] },
    shared.startedBy,
    'Alguém'
  )
}

/** O que a barra da atividade mostra na chamada; null = nenhuma aberta. */
export function activityBanner(
  state: ActivityState,
  meId: string | null,
  nicknames?: Record<string, string>
): ActivityBanner | null {
  const shared = state.shared
  if (!shared) return null
  const activity = findActivity(shared.activityId)
  const launchUrl = activityLaunchUrl(shared.activityId, shared.url)
  if (!activity || !launchUrl) return null
  const mine = meId !== null && shared.startedBy.id === meId
  const who = activityStarterName(shared, nicknames)
  return {
    text: `${mine ? 'Você' : who} abriu ${activity.name}`,
    activityName: activity.name,
    mine,
    joined: state.local !== null,
    hasLink: shared.url !== '',
    launchUrl
  }
}

/** A atividade em que userId está jogando nesta chamada (selo); null = nenhuma. */
export function activityOfPlayer(state: ActivityState, userId: string): ActivityDefinition | null {
  const shared = state.shared
  if (!shared || !shared.players.includes(userId)) return null
  return findActivity(shared.activityId) ?? null
}

/**
 * Estou com o jogo da atividade aberto aqui, mas o servidor ainda não me conta
 * como jogador (abri agora, ou a atividade foi reaberta): avisar com join.
 */
export function needsJoinReport(state: ActivityState, meId: string | null): boolean {
  const { shared, local } = state
  if (!meId || !shared || !local || local.activityId !== shared.activityId) return false
  return shared.startedBy.id !== meId && !shared.players.includes(meId)
}

/** "Juntar-se à atividade" no perfil de quem está jogando (e eu ainda não). */
export function canJoinFromProfile(
  state: ActivityState,
  meId: string | null,
  userId: string
): boolean {
  if (!meId || userId === meId || state.local) return false
  return activityOfPlayer(state, userId) !== null
}

/**
 * Desktop: a janela do jogo de quem abriu entrou numa sala. Devolve o link a
 * compartilhar com a chamada, ou null (não é meu, não é a atividade aberta,
 * link fora das origens ou a mesma sala que já está lá).
 */
export function capturedRoomToShare(
  state: ActivityState,
  meId: string | null,
  activityId: string,
  url: string
): string | null {
  const { shared, local } = state
  if (!meId || !shared || shared.startedBy.id !== meId) return null
  if (shared.activityId !== activityId || local?.activityId !== activityId) return null
  const checked = validateActivityLink(activityId, url)
  if (!checked.ok || !checked.url || checked.url === shared.url) return null
  return checked.url
}
