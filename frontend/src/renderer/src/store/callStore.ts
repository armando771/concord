import { create } from 'zustand'
import type { WsEvent } from '../api/ws'
import {
  startCall as startCallApi,
  endCall as endCallApi,
  getCallState,
  getCallToken,
  type CallStateResponse
} from '../api/calls'
import { ApiError } from '../api/client'
import { getAudioStream, getCameraStream, getDisplayStream } from '../lib/rtc'
import type { MicHandle } from '../lib/noiseSuppression'
import { CallMedia, type RemoteMedia } from '../lib/livekit'
import { watchLocalSpeaking } from '../lib/localSpeaking'
import { mergeLocalSpeaking, sameIds } from '../lib/voiceActivity'
import { LIVEKIT_URL } from '../lib/config'
import { retry } from '../lib/retry'
import { addWatched, miniPlayerOnly, pruneWatched, resolveFocus } from '../lib/screenWatch'
import {
  applyLiveEvent,
  LIVE_GRACE_MS,
  reapplyRecentLive,
  type LivePayload,
  type LiveRecord
} from '../lib/liveBadge'
import { callNotification, notifyDesktop } from '../lib/notifications'
import { playSound, setSoundOutput } from '../lib/sounds'
import {
  abortWindowAudio,
  resetWindowAudio,
  takeWindowAudio,
  type WindowAudio
} from '../lib/windowAudio'
import { loadAudioPrefs, resolveDeviceId, saveAudioPrefs } from '../lib/audioDevices'
import { useChatStore } from './chatStore'
import { useAuthStore } from './authStore'
import { showToast } from './toastStore'

import type { CallResume } from '../../../shared/callResume'

import { useSoundboardStore } from './soundboardStore'
import { stopAllSoundboardAudio } from '../lib/soundboardPlayer'


export type CallStatus = 'idle' | 'ringing' | 'outgoing' | 'active'
export type CallKind = 'dm' | 'channel'

export interface CallUserInfo {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

interface InvitePayload {
  call_id: string
  type: string
  initiator: CallUserInfo
  conversation_id?: string | null
}

interface RingPayload {
  call_id: string
  callee: CallUserInfo
}

interface ResponsePayload {
  call_id: string
  user: CallUserInfo
}

interface StatePayload {
  call_id: string
  user: CallUserInfo
}

interface ScreenSharePayload {
  call_id: string
  user: CallUserInfo
  active: boolean
}

interface VoicePayload {
  call_id: string
  user_id: string
  muted: boolean
  deafened: boolean
}

export interface VoiceState {
  muted: boolean
  deafened: boolean
}

interface EndedPayload {
  call_id: string
}

function upsertParticipant(list: CallUserInfo[], user: CallUserInfo): CallUserInfo[] {
  return list.some((p) => p.id === user.id) ? list : [...list, user]
}

interface CallState {
  status: CallStatus
  callId: string | null
  type: CallKind | null
  conversationId: string | null
  channelId: string | null
  /** servidor do canal de voz da chamada (rota de volta da miniatura) */
  serverId: string | null
  participants: CallUserInfo[]
  isInitiator: boolean
  /** userId -> microfone remoto */
  streams: Record<string, MediaStream>
  /** userId -> stream de tela remota (Fase 3) */
  screenStreams: Record<string, MediaStream>
  /** userId -> som da tela remota (jogo, vídeo…) */
  screenAudioStreams: Record<string, MediaStream>
  /** stream de tela local enquanto isScreenSharing (reativo p/ preview) */
  localScreenStream: MediaStream | null
  isScreenSharing: boolean
  /** userId -> stream de câmera remota (Fase 4, DM) */
  videoStreams: Record<string, MediaStream>
  /** userId -> nome de quem está na sala de mídia (LiveKit), mesmo fora da lista do backend */
  mediaPeers: Record<string, string>
  /** userIds remotos com tela publicada na sala de mídia (assistida ou não) */
  availableScreens: string[]
  /** telas remotas que estou assistindo (só essas são baixadas); zera ao sair da call */
  watchedScreenIds: string[]
  /** palco da call (CallStage) montado = tela da call visível; senão a miniatura aparece */
  stageVisible: boolean
  /** chamada de DM minimizada (barrinha sobre o chat) */
  dmMinimized: boolean
  /** stream da câmera local enquanto ligada (reativo p/ preview espelhado) */
  localCameraStream: MediaStream | null
  /** quem está compartilhando tela segundo o backend (registry) */
  screenSharers: string[]
  /** microfone e saída escolhidos ('' = padrão do sistema) */
  inputDeviceId: string
  outputDeviceId: string
  /** userId -> mudo/ensurdecido dos outros participantes (evento call:voice) */
  voiceStates: Record<string, VoiceState>
  /**
   * userIds falando agora: os outros pela detecção do LiveKit (servidor); o
   * próprio usuário pela detecção local do microfone publicado (sem o atraso
   * da ida e volta ao servidor), ou pelo servidor se a local não carregar.
   */
  speakingIds: string[]
  /** tela em foco no layout expandido (estilo Go Live) */
  focusedScreenUserId: string | null
  muted: boolean
  deafened: boolean
  startedAt: number | null
  /** Mute de antes de ensurdecer — volta a ele ao desensurdecer. */
  mutedBeforeDeafen: boolean
  /** incrementa a cada evento call:* relevante — usado pela UI p/ revalidar listas */
  listVersion: number
  /** chamadas ativas por canal do servidor aberto (polling da sidebar) */
  serverCalls: Record<string, CallStateResponse>

  startDMCall: (conversationId: string, peer: CallUserInfo) => Promise<void>
  startChannelCall: (channelId: string, resume?: CallResume, signal?: AbortSignal) => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => void
  endCall: () => void
  toggleMute: () => void
  toggleDeafen: () => void
  setInputDevice: (deviceId: string) => Promise<void>
  setOutputDevice: (deviceId: string) => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
  toggleCamera: () => Promise<void>
  setFocusedScreenUser: (userId: string | null) => void
  /** Começa a baixar e assistir a transmissão de alguém (e foca nela). */
  watchScreen: (userId: string) => void
  /** Fecha a transmissão: para de baixar e volta ao card "Assistir transmissão". */
  stopWatchingScreen: (userId: string) => void
  setStageVisible: (visible: boolean) => void
  setDmMinimized: (minimized: boolean) => void
  /** Clique na miniatura: põe em destaque uma transmissão que estou assistindo. */
  focusWatchedScreen: (userId: string) => void
  setServerCalls: (map: Record<string, CallStateResponse>) => void
  joinVoiceChannel: (channelId: string) => Promise<void>
  /** WS de chat reconectou: volta a se registrar na chamada de canal, se houver. */
  handleWsReconnect: () => void
  handleWsEvent: (event: WsEvent) => void
}

/** Microfone da chamada (o stream processado + o que precisa ser fechado). */
let localMic: MicHandle | null = null
let transitioning = false
let callGeneration = 0
/** Reentrada na chamada de canal em andamento (ver resyncChannelCall). */
let resyncing = false
/** Conexão com o servidor de mídia (LiveKit) da chamada atual. */
let media: CallMedia | null = null

/** Quem está falando segundo o servidor (ActiveSpeakersChanged). */
let serverSpeakers: string[] = []
/** Fala do próprio usuário detectada aqui; null = sem detecção local. */
let localSpeaking: boolean | null = null
/** Detecção local em andamento (identifica callbacks de uma já parada). */
let speakingWatch: { stop: () => void } | null = null

// Compartilhamento de tela (não-reativo; o estado reativo é localScreenStream)
let localScreenStream: MediaStream | null = null
// Som só da janela compartilhada (Windows), quando o helper nativo captura
let windowAudio: WindowAudio | null = null
// Câmera local (não-reativa; o estado reativo é localCameraStream)
let localCameraStream: MediaStream | null = null

/** call:live recentes, reaplicados sobre o polling da lista do servidor. */
let recentLive: LiveRecord[] = []

const TOKEN_ATTEMPTS = 10
const TOKEN_RETRY_DELAY_MS = 400

/** Tira o stream da sala (se houver) e só então para as tracks. */
function releaseStream(stream: MediaStream): void {
  const stop = (): void => stream.getTracks().forEach((t) => t.stop())
  if (!media) {
    stop()
    return
  }
  void media
    .unpublish(stream)
    .catch(() => {})
    .finally(stop)
}

function stopLocalStream(): void {
  localMic?.stop()
  localMic = null
}

const EMPTY_MEDIA: RemoteMedia = {
  streams: {},
  screenStreams: {},
  screenAudioStreams: {},
  videoStreams: {},
  mediaPeers: {},
  availableScreens: []
}

export const useCallStore = create<CallState>()((set, get) => {
  const bumpList = (): void => {
    set((s) => ({ listVersion: s.listVersion + 1 }))
  }

  /** Junta servidor (os outros) e detecção local (eu); mudo nunca está falando. */
  const publishSpeaking = (): void => {
    const meId = useAuthStore.getState().user?.id ?? null
    const local = localSpeaking === null ? null : localSpeaking && !get().muted
    const next = mergeLocalSpeaking(serverSpeakers, meId, local)
    if (!sameIds(get().speakingIds, next)) set({ speakingIds: next })
  }

  const stopLocalSpeaking = (): void => {
    speakingWatch?.stop()
    speakingWatch = null
    localSpeaking = null
  }

  /** (Re)inicia a detecção local na track do microfone da chamada. */
  const startLocalSpeaking = (): void => {
    stopLocalSpeaking()
    const track = localMic?.stream.getAudioTracks()[0]
    if (!track) return
    const watch = { stop: () => {} }
    speakingWatch = watch
    localSpeaking = false
    watch.stop = watchLocalSpeaking(track, {
      onChange: (speaking) => {
        if (speakingWatch !== watch) return
        localSpeaking = speaking
        publishSpeaking()
      },
      onUnavailable: () => {
        if (speakingWatch !== watch) return
        localSpeaking = null
        publishSpeaking()
      }
    })
    publishSpeaking()
  }

  const applyRemoteMedia = ({ reconnecting, ...remote }: RemoteMedia): void => {
    set((s) => {
      const meId = useAuthStore.getState().user?.id ?? null
      const availableScreens = remote.availableScreens ?? []
      // Parou de transmitir: deixa de ser assistida (se voltar, começa pausada).
      // Reconectando, as telas somem só por um instante: mantém o que assisto.
      const watchedScreenIds = reconnecting
        ? s.watchedScreenIds
        : pruneWatched(s.watchedScreenIds, availableScreens)
      // Nada ganha foco sozinho; o foco só muda se a tela em foco acabou. Uma
      // assistida cujo vídeo ainda não chegou continua em foco.
      const focusedScreenUserId = resolveFocus(
        s.focusedScreenUserId,
        watchedScreenIds,
        s.isScreenSharing ? meId : null
      )
      return {
        ...remote,
        mediaPeers: remote.mediaPeers ?? {},
        availableScreens,
        watchedScreenIds,
        focusedScreenUserId
      }
    })
  }

  /**
   * Entra na sala de mídia da chamada. O callee de DM pode pedir o token antes
   * do backend processar o call:accept (403) — por isso o retry curto.
   */
  const connectMedia = async (callId: string): Promise<void> => {
    if (media || !localMic) return
    const mic = localMic.stream.getAudioTracks()[0]
    if (!mic) return

    const connection = new CallMedia({
      onRemoteMedia: (remote) => {
        if (media === connection) applyRemoteMedia(remote)
      },
      onConnectionLost: () => {
        if (media !== connection) return
        showToast.error('Conexão com o servidor de voz perdida.')
        get().endCall()
      },
      onReconnecting: () => {
        if (media === connection) showToast.info('Reconectando a chamada…')
      },
      onReconnected: () => {
        if (media === connection) showToast.info('Chamada reconectada.')
      },
      onActiveSpeakers: (userIds) => {
        if (media !== connection) return
        serverSpeakers = userIds
        publishSpeaking()
      }
    })
    media = connection
    // Mesma track que vai ser publicada; sobrevive à troca de sala (resync).
    if (!speakingWatch) startLocalSpeaking()

    try {
      const { token } = await retry(() => getCallToken(callId), {
        attempts: TOKEN_ATTEMPTS,
        delayMs: TOKEN_RETRY_DELAY_MS,
        shouldRetry: (err) => err instanceof ApiError && err.status === 403
      })
      if (media !== connection || get().callId !== callId) return
      await connection.connect(LIVEKIT_URL, token, mic, get().muted)
    } catch {
      if (media !== connection) return
      showToast.error('Não foi possível conectar ao servidor de voz.')
      get().endCall()
      return
    }
    if (media !== connection) return

    // O microfone pode ter sido trocado enquanto a sala conectava.
    const currentMic = localMic?.stream.getAudioTracks()[0]
    if (currentMic && currentMic !== mic) await connection.replaceMic(currentMic).catch(() => {})

    // O mute pode ter mudado durante a conexão (antes disso não há o que mutar).
    void connection.setMicMuted(get().muted).catch(() => {})
    sendVoiceState()

    // Tela/câmera ligadas antes da sala conectar (ex.: logo após aceitar). Uma
    // falha aqui desliga só aquela mídia, não a chamada.
    const screen = localScreenStream
    if (screen) {
      try {
        await connection.publishScreen(screen)
      } catch {
        showToast.error('Não foi possível transmitir a tela.')
        if (localScreenStream === screen) get().stopScreenShare()
      }
    }
    const camera = localCameraStream
    if (camera) {
      try {
        await connection.publishCamera(camera)
      } catch {
        showToast.error('Não foi possível transmitir a câmera.')
        if (localCameraStream === camera) void get().toggleCamera()
      }
    }
  }

  /**
   * Lê o estado da chamada no backend. `replace` troca a lista inteira (usado
   * ao reentrar, quando a lista local pode ter ficado velha); senão só soma
   * quem faltava (eventos call:joined podem ter chegado antes).
   */
  const loadCallState = async (callId: string, replace: boolean): Promise<void> => {
    const meId = useAuthStore.getState().user?.id
    if (!meId) return
    try {
      const state = await getCallState(callId)
      if (get().callId !== callId) return
      const others = state.participants
        .filter((p) => p.user_id && p.user_id !== meId)
        .map((p) => ({
          id: p.user_id,
          username: p.username ?? '',
          display_name: p.display_name ?? p.username ?? 'Usuário',
          avatar_url: p.avatar_url ?? null
        }))
      const sharing = state.screen_sharing ?? []
      set((s) => ({
        screenSharers: sharing,
        voiceStates: {
          ...Object.fromEntries(
            state.participants.map((p) => [
              p.user_id,
              { muted: p.muted ?? false, deafened: p.deafened ?? false }
            ])
          ),
          ...(replace ? {} : s.voiceStates)
        },
        focusedScreenUserId: s.focusedScreenUserId,
        participants: replace
          ? others
          : [...s.participants, ...others.filter((p) => !s.participants.some((q) => q.id === p.id))]
      }))
    } catch {
      // estado indisponível: a lista se forma pelos eventos call:joined
    }
  }

  /**
   * O backend tira da chamada quem fica com o WS de chat caído além da
   * tolerância, mas a mídia (LiveKit) segue conectada — a pessoa continua
   * falando/transmitindo e some da lista de todo mundo. Ao reconectar (ou ao
   * saber que foi tirado), volta a se registrar na chamada do canal.
   */
  const resyncChannelCall = async (): Promise<void> => {
    const { status, type, channelId, callId } = get()
    if (status !== 'active' || type !== 'channel' || !channelId || !callId || resyncing) return
    resyncing = true
    try {
      // Idempotente: se ainda estou na chamada, nada muda no backend.
      const call = await startCallApi({ type: 'channel', channel_id: channelId })
      if (get().callId !== callId) return
      if (call.id !== callId) {
        // A chamada antiga acabou enquanto eu estava fora: segue na nova.
        useChatStore.getState().unsubscribeRoom(`call:${callId}`)
        useChatStore.getState().subscribeRoom(`call:${call.id}`)
        media?.disconnect()
        media = null
        serverSpeakers = []
        set({ callId: call.id, participants: [], ...EMPTY_MEDIA, watchedScreenIds: [] })
        publishSpeaking()
        void connectMedia(call.id)
      }
      await loadCallState(call.id, true)
      if (get().callId !== call.id) return
      sendVoiceState()
      if (localScreenStream) {
        useChatStore.getState().sendEvent('call:screen', { call_id: call.id, active: true })
      }
      bumpList()
    } catch {
      // segue com a mídia; a próxima reconexão tenta de novo
    } finally {
      resyncing = false
    }
  }

  const cleanup = (): void => {
    callGeneration++
    const callId = get().callId
    if (callId) useChatStore.getState().unsubscribeRoom(`call:${callId}`)
    media?.disconnect()
    media = null
    stopLocalSpeaking()
    serverSpeakers = []
    stopLocalStream()
    localScreenStream?.getTracks().forEach((t) => t.stop())
    localScreenStream = null
    windowAudio?.stop()
    windowAudio = null
    localCameraStream?.getTracks().forEach((t) => t.stop())
    localCameraStream = null
    useSoundboardStore.getState().clearActivePlays()
    set({
      status: 'idle',
      callId: null,
      type: null,
      conversationId: null,
      channelId: null,
      serverId: null,
      participants: [],
      isInitiator: false,
      ...EMPTY_MEDIA,
      localScreenStream: null,
      isScreenSharing: false,
      localCameraStream: null,
      screenSharers: [],
      speakingIds: [],
      voiceStates: {},
      watchedScreenIds: [],
      dmMinimized: false,
      focusedScreenUserId: null,
      muted: false,
      deafened: false,
      mutedBeforeDeafen: false,
      startedAt: null
    })
  }

  /**
   * Abre o microfone escolhido; se ele sumiu desde a última vez (headset
   * desconectado), usa o padrão do sistema em vez de impedir a chamada.
   */
  const openMic = async (): Promise<MicHandle> => {
    const id = get().inputDeviceId
    try {
      return await getAudioStream(id)
    } catch (err) {
      const name = (err as DOMException)?.name
      if (!id || (name !== 'OverconstrainedError' && name !== 'NotFoundError')) throw err
      showToast.info('Microfone escolhido não encontrado — usando o padrão do sistema.')
      set({ inputDeviceId: '' })
      saveAudioPrefs({ inputId: '', outputId: get().outputDeviceId })
      return getAudioStream('')
    }
  }

  /** Aplica o mute no microfone local e na sala. */
  const applyMute = (muted: boolean): void => {
    localMic?.stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
    void media?.setMicMuted(muted).catch(() => {})
  }

  /**
   * Avisa o servidor (e por ele os demais) do mute/ensurdecer atual. Só com a
   * chamada ativa: tocando, ainda não sou participante (o servidor recusaria).
   * Reenviado ao conectar a mídia, então nada se perde.
   */
  const sendVoiceState = (): void => {
    const { callId, muted, deafened, status } = get()
    if (!callId || status !== 'active') return
    useChatStore.getState().sendEvent('call:voice', { call_id: callId, muted, deafened })
  }

  return {
    status: 'idle',
    callId: null,
    type: null,
    conversationId: null,
    channelId: null,
    serverId: null,
    participants: [],
    isInitiator: false,
    ...EMPTY_MEDIA,
    localScreenStream: null,
    isScreenSharing: false,
    localCameraStream: null,
    screenSharers: [],
    speakingIds: [],
    voiceStates: {},
    watchedScreenIds: [],
    stageVisible: false,
    dmMinimized: false,
    inputDeviceId: loadAudioPrefs().inputId,
    outputDeviceId: loadAudioPrefs().outputId,
    focusedScreenUserId: null,
    muted: false,
    deafened: false,
    mutedBeforeDeafen: false,
    startedAt: null,
    listVersion: 0,
    serverCalls: {},

    startDMCall: async (conversationId, peer) => {
      if (get().status !== 'idle' || transitioning) return
      transitioning = true
      try {
        localMic = await openMic()
      } catch {
        showToast.error('Não foi possível acessar o microfone.')
        transitioning = false
        return
      }

      try {
        const call = await startCallApi({ type: 'dm', conversation_id: conversationId })
        set({
          status: 'outgoing',
          callId: call.id,
          type: 'dm',
          conversationId,
          channelId: null,
          participants: [peer],
          isInitiator: true,
          streams: {},
          muted: false,
          deafened: false,
          startedAt: null
        })
        useChatStore.getState().subscribeRoom(`call:${call.id}`)
      } catch (err) {
        stopLocalStream()
        showToast.error(err instanceof Error ? err.message : 'Não foi possível iniciar a chamada.')
      } finally {
        transitioning = false
      }
    },

    startChannelCall: async (channelId, resume, signal) => {
      if (get().status !== 'idle' || transitioning) return
      transitioning = true
      const generation = callGeneration
      const cancelled = (): boolean =>
        !!resume &&
        (signal?.aborted === true ||
          generation !== callGeneration ||
          useAuthStore.getState().user?.id !== resume.userId)
      try {
        localMic = await openMic()
        if (cancelled()) {
          stopLocalStream()
          transitioning = false
          return
        }
      } catch {
        showToast.error('Não foi possível acessar o microfone.')
        transitioning = false
        if (resume) throw new Error('Não foi possível acessar o microfone.')
        return
      }

      try {
        // Idempotente no backend: se já há chamada ativa no canal, entra nela.
        const call = await startCallApi({ type: 'channel', channel_id: channelId })
        if (cancelled()) {
          stopLocalStream()
          useChatStore.getState().sendEvent('call:leave', { call_id: call.id })
          return
        }
        const muted = !!resume && (resume.muted || resume.deafened)
        localMic.stream.getAudioTracks().forEach((track) => {
          track.enabled = !muted
        })
        set({
          status: 'active',
          callId: call.id,
          type: 'channel',
          conversationId: null,
          channelId,
          serverId: call.server_id ?? null,
          participants: [],
          isInitiator: false,
          streams: {},
          muted,
          deafened: resume?.deafened ?? false,
          mutedBeforeDeafen: resume?.mutedBeforeDeafen ?? false,
          startedAt: Date.now()
        })
        playSound('join')
        useChatStore.getState().subscribeRoom(`call:${call.id}`)
        // O backend já registrou a entrada (startCall é idempotente): a mídia
        // pode conectar em paralelo à leitura do estado da chamada.
        void connectMedia(call.id)

        await loadCallState(call.id, false)
        bumpList()
      } catch (err) {
        stopLocalStream()
        if (resume) throw err
        showToast.error(err instanceof Error ? err.message : 'Não foi possível entrar na chamada.')
      } finally {
        transitioning = false
      }
    },

    acceptCall: async () => {
      const { status, callId, participants } = get()
      const peer = participants[0]
      if (status !== 'ringing' || !callId || !peer || transitioning) return
      transitioning = true
      try {
        localMic = await openMic()
      } catch {
        showToast.error('Não foi possível acessar o microfone.')
        transitioning = false
        return
      }

      // Otimista: o broadcast de call:accept pode chegar antes da assinatura da room.
      set({ status: 'active', startedAt: Date.now() })
      playSound('join')
      useChatStore.getState().sendEvent('call:accept', { call_id: callId })
      useChatStore.getState().subscribeRoom(`call:${callId}`)
      transitioning = false
      void connectMedia(callId)
    },

    declineCall: () => {
      const { status, callId } = get()
      if (status !== 'ringing' || !callId) return
      useChatStore.getState().sendEvent('call:decline', { call_id: callId })
      cleanup()
    },

    endCall: () => {
      const { callId, status, type } = get()
      if (!callId) {
        cleanup()
        return
      }
      if (status === 'active') playSound('leave')
      if (status === 'ringing') {
        useChatStore.getState().sendEvent('call:decline', { call_id: callId })
      } else {
        useChatStore.getState().sendEvent('call:leave', { call_id: callId })
        // Em canal, a queda de WS já dispara HandleDisconnect no servidor.
        if (type === 'dm' && !useChatStore.getState().isWsConnected()) {
          void endCallApi(callId).catch(() => {})
        }
      }
      cleanup()
      bumpList()
    },

    toggleMute: () => {
      const next = !get().muted
      // Desmutar enquanto ensurdecido também tira o ensurdecer.
      set(next ? { muted: true } : { muted: false, deafened: false })
      applyMute(next)
      publishSpeaking()
      sendVoiceState()
      playSound(next ? 'mute' : 'unmute')
    },

    toggleDeafen: () => {
      const next = !get().deafened
      if (next) {
        set({ mutedBeforeDeafen: get().muted, deafened: true, muted: true })
        applyMute(true)
        stopAllSoundboardAudio()
      } else {
        set({ deafened: false, muted: get().mutedBeforeDeafen })
        applyMute(get().mutedBeforeDeafen)
      }
      publishSpeaking()
      sendVoiceState()
      playSound(next ? 'deafen' : 'undeafen')
    },

    setInputDevice: async (deviceId) => {
      set({ inputDeviceId: deviceId })
      saveAudioPrefs({ inputId: deviceId, outputId: get().outputDeviceId })
      if (!localMic) return
      let next: MicHandle
      try {
        next = await getAudioStream(deviceId)
      } catch {
        showToast.error('Não foi possível usar esse microfone.')
        return
      }
      const previous = localMic
      // A chamada pode ter acabado enquanto o dispositivo abria.
      if (!previous) {
        next.stop()
        return
      }
      const track = next.stream.getAudioTracks()[0]
      track.enabled = !get().muted
      localMic = next
      // A detecção segue o microfone publicado.
      if (speakingWatch) startLocalSpeaking()
      try {
        await media?.replaceMic(track)
        // O SDK muta sozinho quando a track antiga morre (ex.: headset tirado).
        await media?.setMicMuted(get().muted)
      } catch {
        showToast.error('Não foi possível trocar o microfone.')
      }
      previous.stop()
    },

    setOutputDevice: (deviceId) => {
      set({ outputDeviceId: deviceId })
      setSoundOutput(deviceId)
      saveAudioPrefs({ inputId: get().inputDeviceId, outputId: deviceId })
    },

    startScreenShare: async () => {
      const s = get()
      if (s.status !== 'active' || s.isScreenSharing || transitioning) return
      let stream: MediaStream
      resetWindowAudio()
      try {
        stream = await getDisplayStream()
      } catch (err) {
        abortWindowAudio()
        // NotAllowedError: usuário cancelou o picker — sem toast.
        if ((err as DOMException)?.name !== 'NotAllowedError') {
          showToast.error('Não foi possível compartilhar a tela.')
        }
        return
      }
      // Janela no Windows: o som vem do helper (só o app da janela).
      const captured = await takeWindowAudio()
      // A chamada pode ter acabado (ou mudado) com o seletor aberto.
      if (get().callId !== s.callId || get().status !== 'active') {
        captured?.stop()
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      if (captured) {
        // O som da janela substitui qualquer som de sistema da captura.
        stream.getAudioTracks().forEach((t) => {
          stream.removeTrack(t)
          t.stop()
        })
        windowAudio = captured
        stream.addTrack(captured.track)
      }

      localScreenStream = stream
      const meId = useAuthStore.getState().user?.id
      const callId = get().callId
      set((prev) => ({
        isScreenSharing: true,
        localScreenStream: stream,
        screenSharers: meId
          ? Array.from(new Set([...prev.screenSharers, meId]))
          : prev.screenSharers,
        focusedScreenUserId: prev.focusedScreenUserId ?? meId ?? null
      }))

      // Parar pela barra nativa do Electron / fim da fonte encerra o share.
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (get().isScreenSharing) get().stopScreenShare()
        })
      })

      useChatStore.getState().sendEvent('call:screen', { call_id: callId, active: true })

      try {
        await media?.publishScreen(stream)
      } catch {
        showToast.error('Não foi possível transmitir a tela.')
        get().stopScreenShare()
      }
    },

    stopScreenShare: () => {
      const s = get()
      if (!s.isScreenSharing && !localScreenStream) return
      const meId = useAuthStore.getState().user?.id
      const callId = s.callId
      const stream = localScreenStream
      localScreenStream = null
      windowAudio?.stop()
      windowAudio = null

      if (stream) releaseStream(stream)

      set((prev) => ({
        isScreenSharing: false,
        localScreenStream: null,
        screenSharers: prev.screenSharers.filter((id) => id !== meId),
        focusedScreenUserId: prev.focusedScreenUserId === meId ? null : prev.focusedScreenUserId
      }))

      if (callId) {
        useChatStore.getState().sendEvent('call:screen', { call_id: callId, active: false })
      }
    },

    setFocusedScreenUser: (userId) => {
      set({ focusedScreenUserId: userId })
    },

    watchScreen: (userId) => {
      const s = get()
      if (s.status !== 'active' || !s.availableScreens.includes(userId)) return
      const next = addWatched(s.watchedScreenIds, userId)
      set({ watchedScreenIds: next, focusedScreenUserId: userId })
      media?.setWatchedScreens(next)
    },

    stopWatchingScreen: (userId) => {
      const s = get()
      const next = s.watchedScreenIds.filter((id) => id !== userId)
      set({
        watchedScreenIds: next,
        focusedScreenUserId: s.focusedScreenUserId === userId ? null : s.focusedScreenUserId
      })
      media?.setWatchedScreens(next)
    },

    setStageVisible: (visible) => {
      const s = get()
      // Saiu da tela da call: a miniatura mostra uma transmissão só, e as
      // outras param de baixar (e de tocar som) até a pessoa voltar e assistir.
      const next = visible
        ? s.watchedScreenIds
        : miniPlayerOnly(s.watchedScreenIds, s.focusedScreenUserId, s.screenStreams)
      if (next === s.watchedScreenIds) {
        set({ stageVisible: visible })
        return
      }
      const meId = useAuthStore.getState().user?.id ?? null
      set({
        stageVisible: visible,
        watchedScreenIds: next,
        focusedScreenUserId: resolveFocus(
          s.focusedScreenUserId,
          next,
          s.isScreenSharing ? meId : null
        )
      })
      media?.setWatchedScreens(next)
    },

    setDmMinimized: (minimized) => {
      set({ dmMinimized: minimized })
    },

    focusWatchedScreen: (userId) => {
      if (!get().watchedScreenIds.includes(userId)) return
      // DM minimizada: a rota já é a da call, então só expandir mostra o palco.
      set({ focusedScreenUserId: userId, dmMinimized: false })
    },

    toggleCamera: async () => {
      const s = get()
      if (s.type === null || s.status !== 'active' || transitioning) return

      if (localCameraStream) {
        // Desligar: remove as tracks de cada PC e renegocia (o par detecta
        // o fim pelo evento 'mute' da track remota).
        const stream = localCameraStream
        localCameraStream = null
        set({ localCameraStream: null })
        releaseStream(stream)
        return
      }

      let stream: MediaStream
      try {
        stream = await getCameraStream()
      } catch (err) {
        if ((err as DOMException)?.name !== 'NotAllowedError') {
          showToast.error('Não foi possível acessar a câmera.')
        }
        return
      }
      // A chamada pode ter acabado enquanto a câmera abria.
      if (get().callId !== s.callId || get().status !== 'active' || localCameraStream) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      localCameraStream = stream
      set({ localCameraStream: stream })

      // Câmera desligada pelo SO/app (ex.: fechar a fonte) desliga o share.
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (get().status === 'active' && localCameraStream === stream) {
            void get().toggleCamera()
          }
        })
      })

      try {
        await media?.publishCamera(stream)
      } catch {
        showToast.error('Não foi possível transmitir a câmera.')
        if (localCameraStream === stream) void get().toggleCamera()
      }
    },

    setServerCalls: (map) => {
      set({ serverCalls: reapplyRecentLive(map, recentLive, Date.now()) })
    },

    joinVoiceChannel: async (channelId) => {
      const s = get()
      if (s.status !== 'idle') {
        if (s.type !== 'channel') {
          throw new Error('Você já está em uma chamada.')
        }
        if (s.channelId === channelId) {
          // Já conectado: não desconecta (estilo Discord) — a UI só exibe a view.
          return
        }
        // Entrar em outro canal de voz desconecta do atual.
        s.endCall()
      }
      await get().startChannelCall(channelId)
    },

    handleWsReconnect: () => {
      void resyncChannelCall()
    },

    handleWsEvent: (event) => {
      const payload = event.payload as Record<string, unknown>
      const meId = useAuthStore.getState().user?.id

      switch (event.type) {
        case 'call:invite': {
          const p = payload as unknown as InvitePayload
          if (p.type !== 'dm' || get().status !== 'idle') return
          notifyDesktop(callNotification(p.initiator))
          set({
            status: 'ringing',
            callId: p.call_id,
            type: 'dm',
            conversationId: p.conversation_id ?? null,
            channelId: null,
            participants: [p.initiator],
            isInitiator: false,
            streams: {},
            muted: false,
            deafened: false,
            startedAt: null
          })
          return
        }

        case 'call:ring': {
          const p = payload as unknown as RingPayload
          if (get().callId !== p.call_id) return
          set({ participants: upsertParticipant(get().participants, p.callee) })
          return
        }

        case 'call:accept': {
          const p = payload as unknown as ResponsePayload
          if (get().callId !== p.call_id) return
          const current = get()
          const participants = upsertParticipant(current.participants, p.user)
          if (current.status !== 'active') {
            set({ status: 'active', startedAt: Date.now(), participants })
            playSound('join')
          } else {
            set({ participants })
          }
          if (current.isInitiator && current.type === 'dm' && current.callId) {
            void connectMedia(current.callId)
          }
          return
        }

        case 'call:decline': {
          const p = payload as unknown as ResponsePayload
          if (get().callId !== p.call_id) return
          showToast.info(`${p.user.display_name} recusou a chamada.`)
          cleanup()
          return
        }

        case 'call:voice': {
          const p = payload as unknown as VoicePayload
          const state = { muted: p.muted, deafened: p.deafened }
          set((s) => {
            // Lista dos canais de voz do servidor (inclusive de chamadas em que não estou).
            const serverCalls = { ...s.serverCalls }
            for (const [channelId, entry] of Object.entries(serverCalls)) {
              if (entry.call?.id !== p.call_id) continue
              serverCalls[channelId] = {
                ...entry,
                participants: entry.participants.map((q) =>
                  q.user_id === p.user_id ? { ...q, ...state } : q
                )
              }
            }
            return {
              serverCalls,
              voiceStates:
                s.callId === p.call_id ? { ...s.voiceStates, [p.user_id]: state } : s.voiceStates
            }
          })
          return
        }

        case 'call:screen': {
          const p = payload as unknown as ScreenSharePayload
          if (get().callId !== p.call_id || p.user.id === meId) return
          set((s) => ({
            screenSharers: p.active
              ? Array.from(new Set([...s.screenSharers, p.user.id]))
              : s.screenSharers.filter((id) => id !== p.user.id),
            // Transmissão nova começa pausada: só a que acabou perde o foco.
            focusedScreenUserId:
              !p.active && s.focusedScreenUserId === p.user.id ? null : s.focusedScreenUserId,
            participants: upsertParticipant(s.participants, p.user)
          }))
          return
        }

        case 'call:live': {
          // Selo LIVE na lista do servidor (inclusive de chamadas em que não estou).
          const p = payload as unknown as LivePayload
          const now = Date.now()
          recentLive = [
            ...recentLive.filter((r) => now - r.at < LIVE_GRACE_MS),
            { payload: p, at: now }
          ]
          const known = Object.values(get().serverCalls).some((e) => e.call?.id === p.call_id)
          set((s) => ({ serverCalls: applyLiveEvent(s.serverCalls, p) }))
          // Chamada que começou depois do último polling: busca a lista agora.
          if (!known) bumpList()
          return
        }

        case 'call:joined': {
          const p = payload as unknown as StatePayload
          if (get().callId !== p.call_id) return
          const current = get()
          if (current.type === 'channel') {
            if (current.status !== 'active' || !meId || p.user.id === meId) return
            set({ participants: upsertParticipant(current.participants, p.user) })
            playSound('userJoin')
            bumpList()
            return
          }
          if (current.status === 'outgoing') {
            set({ status: 'active', startedAt: Date.now() })
            playSound('join')
          }
          return
        }

        case 'call:left': {
          const p = payload as unknown as StatePayload
          if (get().callId !== p.call_id) return
          if (p.user.id === meId) {
            // Ainda estou na chamada (quem sai de propósito já limpou o callId):
            // o backend me tirou por queda do WS — volta a entrar.
            void resyncChannelCall()
            return
          }
          showToast.info(`${p.user.display_name} saiu da chamada.`)
          if (get().type === 'channel') {
            playSound('userLeave')
            // A mídia do participante some sozinha quando ele sai da sala do LiveKit.
            set((s) => ({
              participants: s.participants.filter((q) => q.id !== p.user.id),
              screenSharers: s.screenSharers.filter((id) => id !== p.user.id)
            }))
            bumpList()
            return
          }
          get().endCall()
          return
        }

        case 'call:ended': {
          const p = payload as unknown as EndedPayload
          if (get().callId !== p.call_id) return
          cleanup()
          bumpList()
          return
        }

        case 'call:busy': {
          showToast.error('O usuário está ocupado em outra chamada.')
          cleanup()
          return
        }

        case 'call:moved': {
          // Um moderador moveu alguém de canal de voz: as listas mudam.
          bumpList()
          const p = payload as unknown as {
            from_call_id: string
            channel_id: string
            channel_name: string
            user: CallUserInfo
            moved_by: CallUserInfo
          }
          if (p.user.id !== meId || get().callId !== p.from_call_id) return
          // Fui eu: o servidor já me colocou no canal novo; troca a mídia de
          // sala mantendo o mute/ensurdecer de antes.
          const { muted, deafened } = get()
          cleanup()
          void get()
            .startChannelCall(p.channel_id)
            .then(() => {
              if (get().channelId !== p.channel_id) return
              set({ muted: muted || deafened, deafened })
              applyMute(muted || deafened)
              sendVoiceState()
              showToast.info(
                `${p.moved_by.display_name || 'Um moderador'} moveu você para ${p.channel_name || 'outro canal'}.`
              )
            })
          return
        }

        case 'call:error': {
          const message = (payload.message as string) ?? 'Erro na chamada.'
          showToast.error(message)
          if (get().callId === (payload.call_id as string | undefined) || !payload.call_id) {
            cleanup()
          }
          return
        }

        default:
          return
      }
    }
  }
})

// Os efeitos sonoros saem no mesmo dispositivo escolhido para as vozes.
setSoundOutput(useCallStore.getState().outputDeviceId)

// Dispositivo escolhido desconectado (ex.: tirou o headset): volta para o
// padrão do sistema em vez de ficar sem microfone/som.
if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      const { inputDeviceId, outputDeviceId, setInputDevice, setOutputDevice } =
        useCallStore.getState()
      if (resolveDeviceId(devices, 'audioinput', inputDeviceId) !== inputDeviceId) {
        showToast.info('Microfone desconectado — usando o padrão do sistema.')
        void setInputDevice('')
      }
      if (resolveDeviceId(devices, 'audiooutput', outputDeviceId) !== outputDeviceId) {
        showToast.info('Saída de áudio desconectada — usando o padrão do sistema.')
        setOutputDevice('')
      }
    })
  })
}
