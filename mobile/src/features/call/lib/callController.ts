import type { CallInfo, StartCallInput } from '../api/calls'
import { useCallNoticeStore } from '../store/callNoticeStore'
import { isInCall, useCallSessionStore } from '../store/callSessionStore'
import { useIncomingCallStore } from '../store/incomingCallStore'
import { useParticipantsStore, voiceOf } from '../store/participantsStore'
import { useSpeakingStore } from '../store/speakingStore'
import { callErrorMessage } from './callErrors'
import type { CallMedia, MediaConnection } from './callMedia'
import { effectiveAudio, type LocalControls } from './voiceState'

export interface ControllerDeps {
  api: {
    startCall: (input: StartCallInput) => Promise<CallInfo>
    getCallToken: (callId: string) => Promise<{ token: string }>
    endCallRequest: (callId: string) => Promise<unknown>
  }
  media: CallMedia
  ws: { send: (type: string, payload: unknown) => void; subscribe: (room: string) => void; unsubscribe: (room: string) => void }
  liveKitUrl: string
  /** Mudo e fone do painel do usuário (voiceControlsStore). */
  controls: () => LocalControls
  ensureMicPermission: () => Promise<boolean>
  meId?: () => string | null
}

export interface ChannelTarget {
  id: string
  name: string
  serverId: string
}

export interface DmTarget {
  id: string
  name: string
}

const session = () => useCallSessionStore.getState()
const notice = (message: string): void => useCallNoticeStore.getState().show(message)

/**
 * Orquestra a chamada: API, sala de eventos, mídia e stores. Fábrica com dependências injetadas para testar
 * com mídia e API falsas (ADR 0023); `callRuntime.ts` monta a instância real.
 */
export function createCallController(deps: ControllerDeps) {
  /** Chamada cuja mídia já foi (ou está sendo) conectada: evita conectar duas vezes. */
  let mediaCallId: string | null = null

  deps.media.onSpeakers((ids) => useSpeakingStore.getState().set(ids))
  deps.media.onConnection((state) => onMediaConnection(state))

  function onMediaConnection(state: MediaConnection): void {
    const { phase } = session()
    if (state === 'reconnecting' && phase === 'active') session().setPhase('reconnecting')
    else if (state === 'connected' && phase === 'reconnecting') session().setPhase('active')
    else if (state === 'disconnected' && isInCall({ phase }) && phase !== 'outgoing') {
      notice('A conexão com a chamada caiu.')
      void leave()
    }
  }

  async function applyAudio(): Promise<void> {
    const s = session()
    if (!s.callId || mediaCallId !== s.callId) return
    const local = deps.controls()
    const server = voiceOf(useParticipantsStore.getState().voice, deps.meId?.() ?? '')
    const { micOn, listening } = effectiveAudio(local, server, !s.micDenied)
    deps.media.setListening(listening)
    await deps.media.setMicEnabled(micOn).catch(() => {})
    deps.ws.send('call:voice', { call_id: s.callId, muted: local.muted, deafened: local.deafened })
  }

  async function connectMedia(callId: string): Promise<void> {
    if (mediaCallId === callId) return
    mediaCallId = callId
    const { token } = await deps.api.getCallToken(callId)
    await deps.media.connect(deps.liveKitUrl, token)
    if (session().callId !== callId) return void (await deps.media.disconnect())
    const permitted = await deps.ensureMicPermission()
    session().setMicDenied(!permitted)
    if (!permitted) notice('Sem permissão do microfone. Você entrou mudo.')
    session().setPhase('active')
    await applyAudio()
  }

  async function fail(err: unknown): Promise<void> {
    notice(callErrorMessage(err))
    await leave()
  }

  /** `notify: false` quando o servidor já me tirou da chamada (movido por um moderador, por exemplo). */
  async function leave(notify = true): Promise<void> {
    const s = session()
    if (s.phase === 'idle') return
    const callId = s.callId
    mediaCallId = null
    s.reset()
    useParticipantsStore.getState().reset()
    useSpeakingStore.getState().reset()
    if (callId) {
      if (notify) deps.ws.send('call:leave', { call_id: callId })
      deps.ws.unsubscribe(`call:${callId}`)
    }
    await deps.media.disconnect().catch(() => {})
  }

  async function joinChannel(channel: ChannelTarget): Promise<void> {
    const s = session()
    if (isInCall(s) && s.channelId === channel.id) return
    if (session().phase !== 'idle') await leave()
    session().begin({ callId: '', kind: 'channel', phase: 'connecting', channelId: channel.id, serverId: channel.serverId, name: channel.name })
    try {
      const call = await deps.api.startCall({ type: 'channel', channel_id: channel.id })
      session().setCallId(call.id)
      deps.ws.subscribe(`call:${call.id}`)
      await connectMedia(call.id)
    } catch (err) {
      await fail(err)
    }
  }

  async function callDm(dm: DmTarget): Promise<void> {
    if (session().phase !== 'idle') await leave()
    session().begin({ callId: '', kind: 'dm', phase: 'outgoing', conversationId: dm.id, name: dm.name })
    try {
      const call = await deps.api.startCall({ type: 'dm', conversation_id: dm.id })
      session().setCallId(call.id)
      deps.ws.subscribe(`call:${call.id}`)
    } catch (err) {
      await fail(err)
    }
  }

  /** Alguém atendeu a DM que eu iniciei (fase `connecting` sem mídia ainda): conecta. */
  async function connectIfNeeded(): Promise<void> {
    const s = session()
    if (s.phase !== 'connecting' || !s.callId) return
    try {
      await connectMedia(s.callId)
    } catch (err) {
      await fail(err)
    }
  }

  async function acceptIncoming(): Promise<void> {
    const incoming = useIncomingCallStore.getState().call
    if (!incoming) return
    if (session().phase !== 'idle') await leave()
    useIncomingCallStore.getState().clear()
    session().begin({
      callId: incoming.callId,
      kind: 'dm',
      phase: 'connecting',
      conversationId: incoming.conversationId,
      name: incoming.initiator.display_name
    })
    useParticipantsStore.getState().upsert(incoming.initiator)
    deps.ws.send('call:accept', { call_id: incoming.callId })
    deps.ws.subscribe(`call:${incoming.callId}`)
    await connectIfNeeded()
  }

  function declineIncoming(): void {
    const incoming = useIncomingCallStore.getState().call
    if (!incoming) return
    deps.ws.send('call:decline', { call_id: incoming.callId })
    useIncomingCallStore.getState().clear()
  }

  /** Um moderador me moveu: o servidor já me pôs no canal novo, então só troco a mídia. */
  async function followMove(): Promise<void> {
    const { movedTo, serverId } = session()
    if (!movedTo || !serverId) return
    await leave(false)
    await joinChannel({ id: movedTo.channelId, name: movedTo.name, serverId })
  }

  return { joinChannel, callDm, connectIfNeeded, acceptIncoming, declineIncoming, leave, applyAudio, followMove }
}

export type CallController = ReturnType<typeof createCallController>
