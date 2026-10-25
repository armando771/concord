import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Fakes de mídia (node não tem MediaStream) ──────────────────────────────

interface FakeTrack {
  id: string
  kind: 'audio' | 'video'
  enabled: boolean
  stopped: boolean
  contentHint: string
  stop: () => void
  addEventListener: (type: string, fn: () => void) => void
}

function fakeTrack(kind: 'audio' | 'video'): FakeTrack {
  const track: FakeTrack = {
    id: `${kind}-${Math.random()}`,
    kind,
    enabled: true,
    stopped: false,
    contentHint: '',
    stop: () => {
      track.stopped = true
    },
    addEventListener: () => {}
  }
  return track
}

function fakeStream(...kinds: Array<'audio' | 'video'>): MediaStream {
  const tracks = kinds.map(fakeTrack)
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video')
  } as unknown as MediaStream
}

/** Microfone como o rtc.getAudioStream devolve (stream processado + stop). */
function fakeMic(stream = fakeStream('audio')): {
  stream: MediaStream
  setNoiseSuppression: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
} {
  return {
    stream,
    setNoiseSuppression: vi.fn(),
    stop: vi.fn(() => stream.getTracks().forEach((t) => t.stop()))
  }
}

const allStopped = (stream: MediaStream): boolean =>
  (stream.getTracks() as unknown as FakeTrack[]).every((t) => t.stopped)

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// ─── Mocks dos módulos que o store usa ──────────────────────────────────────

const rtc = vi.hoisted(() => ({
  getAudioStream: vi.fn(),
  getDisplayStream: vi.fn(),
  getCameraStream: vi.fn()
}))
vi.mock('../lib/rtc', () => rtc)

const media = vi.hoisted(() => ({
  instances: [] as Array<Record<string, ReturnType<typeof vi.fn>> & { handlers: unknown }>,
  events: [] as string[],
  connect: vi.fn(),
  publishScreen: vi.fn(),
  publishCamera: vi.fn(),
  setWatchedScreens: vi.fn()
}))
vi.mock('../lib/livekit', () => ({
  CallMedia: class {
    handlers: unknown
    connect = media.connect
    publishScreen = media.publishScreen
    publishCamera = media.publishCamera
    setWatchedScreens = media.setWatchedScreens
    setMicMuted = vi.fn(async (muted: boolean) => {
      media.events.push(`mic(${muted})`)
    })
    unpublish = vi.fn(async () => {})
    replaceMic = vi.fn(async () => {})
    ensureMic = vi.fn(async () => {})
    disconnect = vi.fn()
    constructor(handlers: unknown) {
      this.handlers = handlers
      media.instances.push(this as never)
    }
  }
}))

const api = vi.hoisted(() => ({
  startCall: vi.fn(),
  endCall: vi.fn(async () => ({ message: 'ok' })),
  getCallState: vi.fn(async () => ({ call: null, participants: [] })),
  getCallToken: vi.fn(async () => ({ token: 'tok' }))
}))
vi.mock('../api/calls', () => api)
vi.mock('../api/client', () => ({ ApiError: class extends Error {} }))
vi.mock('../lib/config', () => ({ LIVEKIT_URL: 'ws://servidor' }))

const chat = vi.hoisted(() => ({
  sendEvent: vi.fn(),
  subscribeRoom: vi.fn(),
  unsubscribeRoom: vi.fn(),
  isWsConnected: () => true
}))
vi.mock('./chatStore', () => ({ useChatStore: { getState: () => chat } }))
vi.mock('./authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'eu' } }) }
}))
vi.mock('./toastStore', () => ({ showToast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))
const sounds = vi.hoisted(() => ({ playSound: vi.fn(), setSoundOutput: vi.fn() }))
vi.mock('../lib/sounds', () => sounds)

/** Detecção local de fala: grava cada watch (microfone, handlers, stop). */
interface FakeWatch {
  mic: { stream: MediaStream }
  handlers: { onChange: (speaking: boolean) => void; onUnavailable: () => void }
  stop: ReturnType<typeof vi.fn>
}
const vad = vi.hoisted(() => ({ watches: [] as FakeWatch[] }))
vi.mock('../lib/localSpeaking', () => ({
  watchLocalSpeaking: (mic: FakeWatch['mic'], handlers: FakeWatch['handlers']) => {
    const stop = vi.fn()
    vad.watches.push({ mic, handlers, stop })
    return stop
  }
}))

import { useCallStore } from './callStore'
import { ApiError } from '../api/client'
import { showToast } from './toastStore'

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

const empty = {
  streams: {},
  screenStreams: {},
  screenAudioStreams: {},
  videoStreams: {},
  mediaPeers: {},
  availableScreens: [] as string[]
}

function onRemoteMedia(m: unknown): void {
  const handlers = media.instances[0].handlers as { onRemoteMedia: (m: unknown) => void }
  handlers.onRemoteMedia(m)
}

async function joinChannel(): Promise<void> {
  await useCallStore.getState().startChannelCall('canal-1')
  await flush()
  await flush()
}

beforeEach(() => {
  useCallStore.getState().endCall()
  vi.clearAllMocks()
  media.instances.length = 0
  media.events.length = 0
  vad.watches.length = 0
  rtc.getAudioStream.mockImplementation(async () => fakeMic())
  api.startCall.mockResolvedValue({ id: 'call-1' })
  media.connect.mockResolvedValue(undefined)
  media.publishScreen.mockResolvedValue(undefined)
  media.publishCamera.mockResolvedValue(undefined)
})

describe('callStore — mídia via LiveKit', () => {
  it('retoma ensurdecido sem publicar áudio e restaura o mute anterior ao desensurdecer', async () => {
    const mic = fakeMic()
    rtc.getAudioStream.mockResolvedValue(mic)
    await useCallStore.getState().startChannelCall('canal-1', {
      userId: 'eu',
      backendUrl: 'api',
      serverId: 's',
      channelId: 'canal-1',
      muted: true,
      deafened: true,
      mutedBeforeDeafen: false
    })
    await flush()
    expect(mic.stream.getAudioTracks()[0].enabled).toBe(false)
    expect(media.connect).toHaveBeenCalledWith('ws://servidor', 'tok', expect.anything(), true)
    expect(useCallStore.getState().deafened).toBe(true)
    expect(media.publishCamera).not.toHaveBeenCalled()
    expect(media.publishScreen).not.toHaveBeenCalled()
    useCallStore.getState().toggleDeafen()
    expect(useCallStore.getState().muted).toBe(false)
    expect(mic.stream.getAudioTracks()[0].enabled).toBe(true)
  })

  it('não entra se a retomada foi cancelada enquanto o microfone abria', async () => {
    const waiting = deferred<ReturnType<typeof fakeMic>>()
    rtc.getAudioStream.mockReturnValue(waiting.promise)
    const abort = new AbortController()
    const work = useCallStore.getState().startChannelCall(
      'canal-1',
      {
        userId: 'eu',
        backendUrl: 'api',
        serverId: 's',
        channelId: 'canal-1',
        muted: false,
        deafened: false,
        mutedBeforeDeafen: false
      },
      abort.signal
    )
    abort.abort()
    const mic = fakeMic()
    waiting.resolve(mic)
    await work
    expect(api.startCall).not.toHaveBeenCalled()
    expect(allStopped(mic.stream)).toBe(true)
  })

  it('descarta a tela escolhida quando a chamada acabou com o seletor aberto', async () => {
    await joinChannel()
    const picked = deferred<MediaStream>()
    rtc.getDisplayStream.mockReturnValue(picked.promise)

    const sharing = useCallStore.getState().startScreenShare()
    await useCallStore.getState().startScreenShare()
    expect(rtc.getDisplayStream).toHaveBeenCalledTimes(1)
    useCallStore.getState().endCall()
    const stream = fakeStream('video', 'audio')
    picked.resolve(stream)
    await sharing

    expect(useCallStore.getState().isScreenSharing).toBe(false)
    expect(allStopped(stream)).toBe(true)
    expect(chat.sendEvent).not.toHaveBeenCalledWith('call:screen', expect.anything())
  })

  it('desliga a câmera que chegou depois de a chamada acabar', async () => {
    await joinChannel()
    const camera = deferred<MediaStream>()
    rtc.getCameraStream.mockReturnValue(camera.promise)

    const turningOn = useCallStore.getState().toggleCamera()
    useCallStore.getState().endCall()
    const stream = fakeStream('video')
    camera.resolve(stream)
    await turningOn

    expect(useCallStore.getState().localCameraStream).toBeNull()
    expect(allStopped(stream)).toBe(true)
  })

  it('falha ao publicar a tela depois de conectar não derruba a chamada', async () => {
    // Como o CallMedia real: antes de conectar, publicar é no-op; depois, falha.
    let isConnected = false
    const connected = deferred<void>()
    media.connect.mockImplementation(async () => {
      await connected.promise
      isConnected = true
    })
    rtc.getDisplayStream.mockResolvedValue(fakeStream('video', 'audio'))
    media.publishScreen.mockImplementation(async () => {
      if (isConnected) throw new Error('falhou')
    })

    await useCallStore.getState().startChannelCall('canal-1')
    await useCallStore.getState().startScreenShare()
    connected.resolve()
    await flush()
    await flush()

    expect(useCallStore.getState().status).toBe('active')
    expect(useCallStore.getState().isScreenSharing).toBe(false)
  })

  it('reaplica o mute atual depois de conectar (desmutou durante a conexão)', async () => {
    // Registra a ordem: mute antes de conectar é no-op no CallMedia real.
    const events = media.events
    const token = deferred<{ token: string }>()
    const connected = deferred<void>()
    api.getCallToken.mockReturnValue(token.promise)
    media.connect.mockImplementation(
      async (_url: string, _tok: string, _mic: unknown, muted: boolean) => {
        events.push(`connect(muted=${muted})`)
        await connected.promise
        events.push('connected')
      }
    )

    await useCallStore.getState().startChannelCall('canal-1')
    useCallStore.getState().toggleMute() // muta antes de pedir a conexão
    token.resolve({ token: 'tok' })
    await flush()
    useCallStore.getState().toggleMute() // desmuta durante a conexão
    connected.resolve()
    await flush()
    await flush()

    expect(events).toContain('connect(muted=true)')
    // depois de conectar, o estado atual (desmutado) precisa ser reaplicado
    const afterConnect = events.slice(events.indexOf('connected') + 1)
    expect(afterConnect.at(-1)).toBe('mic(false)')
    expect(useCallStore.getState().muted).toBe(false)
  })

  it('sem detecção local, marca quem está falando pelo servidor, incluindo o próprio usuário', async () => {
    await joinChannel()
    vad.watches[0].handlers.onUnavailable()
    const handlers = media.instances[0].handlers as { onActiveSpeakers: (ids: string[]) => void }

    handlers.onActiveSpeakers(['eu', 'ana'])
    expect(useCallStore.getState().speakingIds).toEqual(['eu', 'ana'])

    handlers.onActiveSpeakers([])
    expect(useCallStore.getState().speakingIds).toEqual([])
  })

  it('limpa quem está falando ao sair da chamada', async () => {
    await joinChannel()
    const handlers = media.instances[0].handlers as { onActiveSpeakers: (ids: string[]) => void }
    handlers.onActiveSpeakers(['eu'])

    useCallStore.getState().endCall()

    expect(useCallStore.getState().speakingIds).toEqual([])
  })

  it('ensurdecer também muta, e voltar restaura o mute anterior (como no Discord)', async () => {
    await joinChannel()

    useCallStore.getState().toggleDeafen()
    expect(useCallStore.getState()).toMatchObject({ deafened: true, muted: true })

    useCallStore.getState().toggleDeafen()
    expect(useCallStore.getState()).toMatchObject({ deafened: false, muted: false })
  })

  it('desmutar enquanto ensurdecido também tira o ensurdecer', async () => {
    await joinChannel()
    useCallStore.getState().toggleDeafen()

    useCallStore.getState().toggleMute()

    expect(useCallStore.getState()).toMatchObject({ deafened: false, muted: false })
  })

  it('avisa o servidor ao mutar e ensurdecer', async () => {
    await joinChannel()
    chat.sendEvent.mockClear()

    useCallStore.getState().toggleMute()
    expect(chat.sendEvent).toHaveBeenLastCalledWith('call:voice', {
      call_id: 'call-1',
      muted: true,
      deafened: false
    })

    useCallStore.getState().toggleDeafen()
    expect(chat.sendEvent).toHaveBeenLastCalledWith('call:voice', {
      call_id: 'call-1',
      muted: true,
      deafened: true
    })
  })

  it('mostra quem está mudo/ensurdecido a partir do evento call:voice', async () => {
    await joinChannel()
    useCallStore.getState().setServerCalls({
      'canal-1': {
        call: { id: 'call-1' } as never,
        participants: [{ call_id: 'call-1', user_id: 'ana', role: 'member', joined_at: '' }]
      }
    })

    useCallStore.getState().handleWsEvent({
      type: 'call:voice',
      payload: { call_id: 'call-1', user_id: 'ana', muted: true, deafened: true }
    })

    expect(useCallStore.getState().voiceStates.ana).toEqual({
      muted: true,
      deafened: true,
      serverMuted: false,
      serverDeafened: false
    })
    expect(useCallStore.getState().serverCalls['canal-1'].participants[0]).toMatchObject({
      muted: true,
      deafened: true
    })
  })

  it('mostra o que um moderador impôs (silenciar/ensurdecer no servidor)', async () => {
    await joinChannel()
    useCallStore.getState().setServerCalls({
      'canal-1': {
        call: { id: 'call-1' } as never,
        participants: [{ call_id: 'call-1', user_id: 'ana', role: 'member', joined_at: '' }]
      }
    })

    useCallStore.getState().handleWsEvent({
      type: 'call:voice',
      payload: {
        call_id: 'call-1',
        user_id: 'ana',
        muted: false,
        deafened: false,
        server_muted: true,
        server_deafened: false
      }
    })

    expect(useCallStore.getState().voiceStates.ana).toMatchObject({
      muted: false,
      serverMuted: true,
      serverDeafened: false
    })
    expect(useCallStore.getState().serverCalls['canal-1'].participants[0]).toMatchObject({
      server_muted: true,
      server_deafened: false
    })
  })

  it('troca o microfone no meio da chamada sem sair da sala', async () => {
    const first = fakeStream('audio')
    const second = fakeStream('audio')
    rtc.getAudioStream.mockResolvedValueOnce(fakeMic(first)).mockResolvedValueOnce(fakeMic(second))
    await joinChannel()

    await useCallStore.getState().setInputDevice('mic-usb')

    expect(rtc.getAudioStream).toHaveBeenLastCalledWith('mic-usb')
    expect(media.instances[0].replaceMic).toHaveBeenCalledWith(second.getAudioTracks()[0])
    expect(allStopped(first)).toBe(true)
    expect(useCallStore.getState().inputDeviceId).toBe('mic-usb')
    expect(useCallStore.getState().status).toBe('active')
  })

  it('fecha o microfone inteiro (não só a track enviada) ao sair da chamada', async () => {
    const mic = fakeMic()
    rtc.getAudioStream.mockResolvedValueOnce(mic)
    await joinChannel()

    useCallStore.getState().endCall()

    expect(mic.stop).toHaveBeenCalledTimes(1)
  })

  it('fecha o microfone antigo ao trocar de dispositivo', async () => {
    const first = fakeMic()
    rtc.getAudioStream.mockResolvedValueOnce(first).mockResolvedValueOnce(fakeMic())
    await joinChannel()

    await useCallStore.getState().setInputDevice('mic-usb')

    expect(first.stop).toHaveBeenCalledTimes(1)
  })

  it('o microfone novo respeita o mute atual', async () => {
    const second = fakeStream('audio')
    rtc.getAudioStream.mockResolvedValueOnce(fakeMic()).mockResolvedValueOnce(fakeMic(second))
    await joinChannel()
    useCallStore.getState().toggleMute()

    await useCallStore.getState().setInputDevice('mic-usb')

    expect((second.getAudioTracks()[0] as unknown as FakeTrack).enabled).toBe(false)
  })

  it('entra na chamada já com o microfone escolhido', async () => {
    await useCallStore.getState().setInputDevice('mic-usb')
    await joinChannel()

    expect(rtc.getAudioStream).toHaveBeenLastCalledWith('mic-usb')
  })

  it('guarda a saída de áudio escolhida', () => {
    useCallStore.getState().setOutputDevice('fone')
    expect(useCallStore.getState().outputDeviceId).toBe('fone')
  })

  it('depois de trocar o microfone, reaplica o mute na sala (o SDK pode ter mutado sozinho)', async () => {
    rtc.getAudioStream.mockResolvedValueOnce(fakeMic()).mockResolvedValueOnce(fakeMic())
    await joinChannel()
    const connection = media.instances[0]
    connection.setMicMuted.mockClear()

    await useCallStore.getState().setInputDevice('')

    expect(connection.replaceMic).toHaveBeenCalled()
    expect(connection.setMicMuted).toHaveBeenLastCalledWith(false)
  })

  it('microfone salvo que sumiu: entra com o padrão do sistema em vez de falhar', async () => {
    await useCallStore.getState().setInputDevice('headset-desconectado')
    rtc.getAudioStream.mockImplementation(async (id?: string) => {
      if (id) throw Object.assign(new Error('x'), { name: 'OverconstrainedError' })
      return fakeMic()
    })

    await joinChannel()

    expect(useCallStore.getState().status).toBe('active')
    expect(useCallStore.getState().inputDeviceId).toBe('')
    expect(rtc.getAudioStream).toHaveBeenLastCalledWith('')
  })

  it('não avisa mudo/ensurdecido antes de a chamada estar ativa (DM tocando)', async () => {
    useCallStore.getState().handleWsEvent({
      type: 'call:invite',
      payload: {
        call_id: 'dm-1',
        type: 'dm',
        initiator: { id: 'ana', username: 'ana', display_name: 'Ana' }
      }
    })
    chat.sendEvent.mockClear()

    useCallStore.getState().toggleMute()

    expect(chat.sendEvent).not.toHaveBeenCalledWith('call:voice', expect.anything())
    expect(useCallStore.getState().status).toBe('ringing')
  })

  it('ao conectar a mídia, avisa o estado atual de mudo/ensurdecido', async () => {
    const connected = deferred<void>()
    media.connect.mockReturnValue(connected.promise)
    await useCallStore.getState().startChannelCall('canal-1')
    useCallStore.getState().toggleDeafen()
    chat.sendEvent.mockClear()

    connected.resolve()
    await flush()
    await flush()

    expect(chat.sendEvent).toHaveBeenCalledWith('call:voice', {
      call_id: 'call-1',
      muted: true,
      deafened: true
    })
  })

  it('toca som ao entrar na chamada e ao sair', async () => {
    await joinChannel()
    expect(sounds.playSound).toHaveBeenCalledWith('join')

    useCallStore.getState().endCall()
    expect(sounds.playSound).toHaveBeenLastCalledWith('leave')
  })

  it('toca som quando alguém entra e sai da minha chamada', async () => {
    await joinChannel()
    const ana = { id: 'ana', username: 'ana', display_name: 'Ana' }

    useCallStore
      .getState()
      .handleWsEvent({ type: 'call:joined', payload: { call_id: 'call-1', user: ana } })
    expect(sounds.playSound).toHaveBeenLastCalledWith('userJoin')

    useCallStore
      .getState()
      .handleWsEvent({ type: 'call:left', payload: { call_id: 'call-1', user: ana } })
    expect(sounds.playSound).toHaveBeenLastCalledWith('userLeave')
  })

  it('toca som ao mutar/desmutar e ensurdecer/desensurdecer', async () => {
    await joinChannel()
    const play = sounds.playSound

    useCallStore.getState().toggleMute()
    expect(play).toHaveBeenLastCalledWith('mute')
    useCallStore.getState().toggleMute()
    expect(play).toHaveBeenLastCalledWith('unmute')
    useCallStore.getState().toggleDeafen()
    expect(play).toHaveBeenLastCalledWith('deafen')
    useCallStore.getState().toggleDeafen()
    expect(play).toHaveBeenLastCalledWith('undeafen')
  })

  it('não toca "alguém entrou" quando sou eu entrando', async () => {
    await joinChannel()
    sounds.playSound.mockClear()
    useCallStore.getState().handleWsEvent({
      type: 'call:joined',
      payload: { call_id: 'call-1', user: { id: 'eu', username: 'eu', display_name: 'Eu' } }
    })
    expect(sounds.playSound).not.toHaveBeenCalled()
  })
})

describe('callStore — reentrada após queda do WS', () => {
  const participant = (id: string): Record<string, unknown> => ({
    user_id: id,
    username: id,
    display_name: id.toUpperCase()
  })

  it('volta a entrar e recarrega a lista quando o backend me tira da chamada', async () => {
    await joinChannel()
    api.startCall.mockClear()
    const state = {
      call: null,
      participants: [participant('eu'), participant('ana'), participant('bia')]
    }
    // Primeiro confere que a chamada existe, depois lê a lista.
    api.getCallState.mockResolvedValueOnce(state as never).mockResolvedValueOnce(state as never)

    useCallStore.getState().handleWsEvent({
      type: 'call:left',
      payload: { call_id: 'call-1', user: { id: 'eu', username: 'eu', display_name: 'Eu' } }
    })
    await flush()
    await flush()

    expect(api.startCall).toHaveBeenCalledWith({ type: 'channel', channel_id: 'canal-1' })
    expect(useCallStore.getState().status).toBe('active')
    expect(useCallStore.getState().participants.map((p) => p.id)).toEqual(['ana', 'bia'])
  })

  it('reentra ao reconectar o WS e reanuncia a tela compartilhada', async () => {
    await joinChannel()
    rtc.getDisplayStream.mockResolvedValue(fakeStream('video'))
    await useCallStore.getState().startScreenShare()
    api.startCall.mockClear()
    chat.sendEvent.mockClear()

    useCallStore.getState().handleWsReconnect()
    await flush()
    await flush()

    expect(api.startCall).toHaveBeenCalledTimes(1)
    expect(chat.sendEvent).toHaveBeenCalledWith('call:screen', { call_id: 'call-1', active: true })
  })

  it('reconectar o WS (deploy) não toca som nem reconecta a mídia', async () => {
    await joinChannel()
    sounds.playSound.mockClear()

    useCallStore.getState().handleWsReconnect()
    await flush()
    await flush()

    expect(sounds.playSound).not.toHaveBeenCalled()
    expect(media.instances).toHaveLength(1)
    expect(media.instances[0].disconnect).not.toHaveBeenCalled()
    expect(useCallStore.getState().status).toBe('active')
  })

  it('ao reconectar, reenvia o mudo e que não estou transmitindo (o servidor pode ter ficado velho)', async () => {
    await joinChannel()
    useCallStore.getState().toggleMute()
    chat.sendEvent.mockClear()

    useCallStore.getState().handleWsReconnect()
    await flush()
    await flush()

    expect(chat.sendEvent).toHaveBeenCalledWith('call:voice', {
      call_id: 'call-1',
      muted: true,
      deafened: false
    })
    expect(chat.sendEvent).toHaveBeenCalledWith('call:screen', { call_id: 'call-1', active: false })
  })

  it('ao reconectar, o mudo dos outros vem do servidor', async () => {
    await joinChannel()
    useCallStore.getState().handleWsEvent({
      type: 'call:voice',
      payload: { call_id: 'call-1', user_id: 'ana', muted: false, deafened: false }
    })
    // Na queda, a ana mutou e o evento se perdeu.
    const state = {
      call: null,
      participants: [participant('eu'), { ...participant('ana'), muted: true }]
    }
    api.getCallState.mockResolvedValueOnce(state as never).mockResolvedValueOnce(state as never)

    useCallStore.getState().handleWsReconnect()
    await flush()
    await flush()

    expect(useCallStore.getState().voiceStates.ana).toMatchObject({ muted: true, deafened: false })
  })

  it('canal: 404 ao reconectar não cria chamada nova enquanto há gente na sala de mídia', async () => {
    await joinChannel()
    onRemoteMedia({ ...empty, mediaPeers: { ana: 'Ana' } })
    api.startCall.mockClear()
    vi.useFakeTimers()
    try {
      api.getCallState.mockRejectedValue(
        Object.assign(new ApiError(404, 'call not found'), { status: 404 }) as never
      )

      useCallStore.getState().handleWsReconnect()
      await vi.advanceTimersByTimeAsync(10_000)

      expect(api.startCall).not.toHaveBeenCalled()
      expect(media.instances[0].disconnect).not.toHaveBeenCalled()
      expect(useCallStore.getState().callId).toBe('call-1')
    } finally {
      api.getCallState.mockReset()
      api.getCallState.mockImplementation(async () => ({ call: null, participants: [] }))
      vi.useRealTimers()
    }
  })

  it('canal: um 404 passageiro não troca de sala', async () => {
    await joinChannel()
    api.startCall.mockClear()
    vi.useFakeTimers()
    try {
      api.getCallState.mockRejectedValueOnce(
        Object.assign(new ApiError(404, 'call not found'), { status: 404 }) as never
      )

      useCallStore.getState().handleWsReconnect()
      await vi.advanceTimersByTimeAsync(10_000)

      // Passado o 404, segue como sempre: reentra na mesma chamada, mídia intacta.
      expect(api.startCall).toHaveBeenCalledTimes(1)
      expect(media.instances[0].disconnect).not.toHaveBeenCalled()
      expect(useCallStore.getState().callId).toBe('call-1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('não faz nada ao reconectar o WS fora de chamada', async () => {
    useCallStore.getState().handleWsReconnect()
    await flush()
    expect(api.startCall).not.toHaveBeenCalled()
  })

  it('guarda quem está na sala de mídia mesmo fora da lista do backend', async () => {
    await joinChannel()
    const onRemoteMedia = (media.instances[0].handlers as { onRemoteMedia: (m: unknown) => void })
      .onRemoteMedia
    onRemoteMedia({
      streams: {},
      screenStreams: {},
      screenAudioStreams: {},
      videoStreams: {},
      mediaPeers: { caio: 'Caio' }
    })
    expect(useCallStore.getState().mediaPeers).toEqual({ caio: 'Caio' })
  })
})

describe('callStore — DM após queda do WS', () => {
  const ana = { id: 'ana', username: 'ana', display_name: 'Ana' }

  async function inDmWithAna(): Promise<void> {
    api.startCall.mockResolvedValue({ id: 'dm-1' })
    await useCallStore.getState().startDMCall('conversa-1', ana)
    useCallStore.getState().handleWsEvent({
      type: 'call:accept',
      payload: { call_id: 'dm-1', user: ana }
    })
    await flush()
    await flush()
  }

  it('reenvia mudo e tela e lê o estado, sem reconectar a mídia nem tirar a outra pessoa', async () => {
    await inDmWithAna()
    expect(useCallStore.getState().status).toBe('active')
    useCallStore.getState().toggleMute()
    chat.sendEvent.mockClear()
    api.getCallState.mockClear()
    api.getCallState.mockResolvedValueOnce({
      call: null,
      participants: [{ user_id: 'eu' }, { user_id: 'ana', username: 'ana', deafened: true }]
    } as never)

    useCallStore.getState().handleWsReconnect()
    await flush()
    await flush()

    expect(api.getCallState).toHaveBeenCalledWith('dm-1')
    expect(chat.sendEvent).toHaveBeenCalledWith('call:voice', {
      call_id: 'dm-1',
      muted: true,
      deafened: false
    })
    expect(chat.sendEvent).toHaveBeenCalledWith('call:screen', { call_id: 'dm-1', active: false })
    expect(useCallStore.getState().voiceStates.ana).toMatchObject({ muted: false, deafened: true })
    expect(useCallStore.getState().participants.map((p) => p.id)).toEqual(['ana'])
    expect(media.instances).toHaveLength(1)
    expect(api.startCall).toHaveBeenCalledTimes(1)
  })

  const notFound = (): Error => Object.assign(new ApiError(404, 'call not found'), { status: 404 })

  it('DM que acabou durante a queda fecha a chamada (404 confirmado e a outra pessoa fora da mídia)', async () => {
    await inDmWithAna()
    vi.useFakeTimers()
    try {
      api.getCallState.mockRejectedValue(notFound() as never)

      useCallStore.getState().handleWsReconnect()
      await vi.advanceTimersByTimeAsync(10_000)

      expect(useCallStore.getState().status).toBe('idle')
      expect(useCallStore.getState().callId).toBeNull()
    } finally {
      api.getCallState.mockReset()
      api.getCallState.mockImplementation(async () => ({ call: null, participants: [] }))
      vi.useRealTimers()
    }
  })

  it('um 404 passageiro (servidor acabando de subir) não derruba a DM', async () => {
    await inDmWithAna()
    vi.useFakeTimers()
    try {
      api.getCallState.mockRejectedValueOnce(notFound() as never)
      chat.sendEvent.mockClear()

      useCallStore.getState().handleWsReconnect()
      await vi.advanceTimersByTimeAsync(10_000)

      expect(useCallStore.getState().status).toBe('active')
      expect(media.instances[0].disconnect).not.toHaveBeenCalled()
      // E reenvia o próprio estado como numa reconexão normal.
      expect(chat.sendEvent).toHaveBeenCalledWith('call:screen', { call_id: 'dm-1', active: false })
    } finally {
      vi.useRealTimers()
    }
  })

  it('404 repetido mas a outra pessoa ainda na sala de mídia: a DM continua', async () => {
    await inDmWithAna()
    onRemoteMedia({ ...empty, mediaPeers: { ana: 'Ana' } })
    vi.useFakeTimers()
    try {
      api.getCallState.mockRejectedValue(notFound() as never)

      useCallStore.getState().handleWsReconnect()
      await vi.advanceTimersByTimeAsync(10_000)

      expect(useCallStore.getState().status).toBe('active')
      expect(media.instances[0].disconnect).not.toHaveBeenCalled()
    } finally {
      api.getCallState.mockReset()
      api.getCallState.mockImplementation(async () => ({ call: null, participants: [] }))
      vi.useRealTimers()
    }
  })

  it('erro passageiro ao ler o estado mantém a DM', async () => {
    await inDmWithAna()
    api.getCallState.mockRejectedValueOnce(new Error('rede') as never)

    useCallStore.getState().handleWsReconnect()
    await flush()
    await flush()

    expect(useCallStore.getState().status).toBe('active')
  })
})

describe('callStore — transmissões sob demanda', () => {
  /** ana transmitindo e eu assistindo, com o vídeo dela já chegando. */
  async function watchingAna(): Promise<void> {
    await joinChannel()
    onRemoteMedia({ ...empty, availableScreens: ['ana'] })
    useCallStore.getState().watchScreen('ana')
    onRemoteMedia({
      ...empty,
      availableScreens: ['ana'],
      screenStreams: { ana: fakeStream('video') }
    })
  }

  it('transmissão nova começa pausada: sem foco e sem pedir a mídia', async () => {
    await joinChannel()

    onRemoteMedia({ ...empty, availableScreens: ['ana'] })

    const s = useCallStore.getState()
    expect(s.focusedScreenUserId).toBeNull()
    expect(s.watchedScreenIds).toEqual([])
    expect(s.availableScreens).toEqual(['ana'])
    expect(media.setWatchedScreens).not.toHaveBeenCalledWith(['ana'])
  })

  it('assistir foca a transmissão e pede a mídia dela', async () => {
    await joinChannel()
    onRemoteMedia({ ...empty, availableScreens: ['ana'] })

    useCallStore.getState().watchScreen('ana')

    expect(useCallStore.getState().watchedScreenIds).toEqual(['ana'])
    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')
    expect(media.setWatchedScreens).toHaveBeenLastCalledWith(['ana'])
  })

  it('não assiste quem não está transmitindo', async () => {
    await joinChannel()

    useCallStore.getState().watchScreen('ana')

    expect(useCallStore.getState().watchedScreenIds).toEqual([])
    expect(media.setWatchedScreens).not.toHaveBeenCalled()
  })

  it('mantém o foco enquanto a transmissão assistida ainda não chegou', async () => {
    await joinChannel()
    onRemoteMedia({ ...empty, availableScreens: ['ana'] })
    useCallStore.getState().watchScreen('ana')

    onRemoteMedia({ ...empty, availableScreens: ['ana'], streams: { bia: fakeStream('audio') } })

    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')
  })

  it('respeita quem saiu do modo foco mesmo com novos eventos de mídia', async () => {
    await watchingAna()

    useCallStore.getState().setFocusedScreenUser(null)
    onRemoteMedia({
      ...empty,
      availableScreens: ['ana'],
      screenStreams: { ana: fakeStream('video') },
      streams: { bia: fakeStream('audio') }
    })

    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
    expect(useCallStore.getState().watchedScreenIds).toEqual(['ana'])
  })

  it('reconexão da sala não fecha a transmissão que estou assistindo', async () => {
    await watchingAna()

    // Na reconexão completa os participantes somem por um instante.
    onRemoteMedia({ ...empty, reconnecting: true })
    expect(useCallStore.getState().watchedScreenIds).toEqual(['ana'])
    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')

    onRemoteMedia({
      ...empty,
      availableScreens: ['ana'],
      screenStreams: { ana: fakeStream('video') }
    })
    expect(useCallStore.getState().watchedScreenIds).toEqual(['ana'])
    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')
  })

  it('quem parou de transmitir durante a reconexão é podado depois dela', async () => {
    await watchingAna()

    onRemoteMedia({ ...empty, reconnecting: true })
    onRemoteMedia(empty)

    expect(useCallStore.getState().watchedScreenIds).toEqual([])
    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
  })

  it('fechar a transmissão para de baixar e volta ao card', async () => {
    await watchingAna()

    useCallStore.getState().stopWatchingScreen('ana')

    expect(useCallStore.getState().watchedScreenIds).toEqual([])
    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
    expect(media.setWatchedScreens).toHaveBeenLastCalledWith([])
  })

  it('quem para de transmitir e volta começa pausado de novo', async () => {
    await watchingAna()

    onRemoteMedia(empty)
    expect(useCallStore.getState().watchedScreenIds).toEqual([])
    expect(useCallStore.getState().focusedScreenUserId).toBeNull()

    onRemoteMedia({ ...empty, availableScreens: ['ana'] })
    expect(useCallStore.getState().watchedScreenIds).toEqual([])
    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
  })

  it('sair da chamada fecha a transmissão', async () => {
    await watchingAna()

    useCallStore.getState().endCall()

    const s = useCallStore.getState()
    expect(s.watchedScreenIds).toEqual([])
    expect(s.availableScreens).toEqual([])
    expect(s.focusedScreenUserId).toBeNull()
  })

  it('call:screen de outra pessoa não abre foco', async () => {
    await joinChannel()

    useCallStore.getState().handleWsEvent({
      type: 'call:screen',
      payload: {
        call_id: 'call-1',
        user: { id: 'ana', username: 'ana', display_name: 'Ana' },
        active: true
      }
    })

    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
    expect(useCallStore.getState().screenSharers).toContain('ana')
  })

  it('entrar numa call com alguém transmitindo não abre foco', async () => {
    api.getCallState.mockResolvedValueOnce({
      call: null,
      participants: [],
      screen_sharing: ['ana']
    } as never)

    await joinChannel()

    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
    expect(useCallStore.getState().screenSharers).toEqual(['ana'])
  })
})

describe('callStore — miniatura da transmissão', () => {
  it('guarda o servidor da chamada de canal', async () => {
    api.startCall.mockResolvedValue({ id: 'call-1', server_id: 'srv-1' })
    await joinChannel()
    expect(useCallStore.getState().serverId).toBe('srv-1')

    useCallStore.getState().endCall()
    expect(useCallStore.getState().serverId).toBeNull()
  })

  it('clicar na miniatura volta à call com a transmissão em destaque', async () => {
    await joinChannel()
    onRemoteMedia({
      ...empty,
      availableScreens: ['ana'],
      screenStreams: { ana: fakeStream('video') }
    })
    useCallStore.getState().watchScreen('ana')
    useCallStore.getState().setDmMinimized(true)
    useCallStore.getState().setFocusedScreenUser(null)

    useCallStore.getState().focusWatchedScreen('ana')

    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')
    expect(useCallStore.getState().dmMinimized).toBe(false)
  })

  it('fora da tela da call só a transmissão da miniatura continua', async () => {
    await joinChannel()
    const screens = { ana: fakeStream('video'), bia: fakeStream('video') }
    onRemoteMedia({ ...empty, availableScreens: ['ana', 'bia'], screenStreams: screens })
    useCallStore.getState().watchScreen('ana')
    useCallStore.getState().watchScreen('bia')
    useCallStore.getState().setFocusedScreenUser('ana')
    useCallStore.getState().setStageVisible(true)

    useCallStore.getState().setStageVisible(false)

    expect(useCallStore.getState().watchedScreenIds).toEqual(['ana'])
    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')
    expect(media.setWatchedScreens).toHaveBeenLastCalledWith(['ana'])
  })

  it('a transmissão fora da miniatura que estava em destaque cede o foco', async () => {
    await joinChannel()
    onRemoteMedia({
      ...empty,
      availableScreens: ['ana', 'bia'],
      screenStreams: { bia: fakeStream('video') }
    })
    useCallStore.getState().watchScreen('bia')
    useCallStore.getState().watchScreen('ana')
    useCallStore.getState().setStageVisible(true)

    // Foco em ana, mas só bia tem vídeo: a miniatura mostra bia.
    useCallStore.getState().setStageVisible(false)

    expect(useCallStore.getState().watchedScreenIds).toEqual(['bia'])
    expect(useCallStore.getState().focusedScreenUserId).toBe('bia')
  })

  it('miniatura não foca transmissão que não estou assistindo', async () => {
    await joinChannel()
    onRemoteMedia({ ...empty, availableScreens: ['bia'] })

    useCallStore.getState().focusWatchedScreen('bia')

    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
  })
})

describe('callStore — selo LIVE', () => {
  it('call:live atualiza o selo da lista do servidor mesmo fora da call', () => {
    useCallStore.getState().setServerCalls({
      'canal-1': { call: { id: 'call-9' } as never, participants: [] }
    })

    useCallStore.getState().handleWsEvent({
      type: 'call:live',
      payload: { call_id: 'call-9', user_id: 'ana', active: true }
    })
    expect(useCallStore.getState().serverCalls['canal-1'].screen_sharing).toEqual(['ana'])

    useCallStore.getState().handleWsEvent({
      type: 'call:live',
      payload: { call_id: 'call-9', user_id: 'ana', active: false }
    })
    expect(useCallStore.getState().serverCalls['canal-1'].screen_sharing).toEqual([])
  })
})

describe('callStore — selo LIVE em dia', () => {
  it('polling atrasado não apaga um call:live recém-chegado', () => {
    useCallStore.getState().setServerCalls({
      'canal-2': { call: { id: 'call-7' } as never, participants: [] }
    })
    useCallStore.getState().handleWsEvent({
      type: 'call:live',
      payload: { call_id: 'call-7', user_id: 'bia', active: true }
    })

    // Resposta de um polling que saiu antes do evento.
    useCallStore.getState().setServerCalls({
      'canal-2': { call: { id: 'call-7' } as never, participants: [], screen_sharing: [] }
    })

    expect(useCallStore.getState().serverCalls['canal-2'].screen_sharing).toEqual(['bia'])
  })

  it('call:live de chamada que a lista ainda não conhece recarrega a lista', () => {
    useCallStore.getState().setServerCalls({})
    const before = useCallStore.getState().listVersion

    useCallStore.getState().handleWsEvent({
      type: 'call:live',
      payload: { call_id: 'call-nova', user_id: 'ana', active: true }
    })

    expect(useCallStore.getState().listVersion).toBe(before + 1)
  })
})

describe('callStore — movido de canal por um moderador', () => {
  it('trocar de chamada fecha a transmissão que eu assistia, como sair da call', async () => {
    await joinChannel()
    onRemoteMedia({
      ...empty,
      availableScreens: ['ana'],
      screenStreams: { ana: fakeStream('video') }
    })
    useCallStore.getState().watchScreen('ana')
    api.startCall.mockResolvedValue({ id: 'call-2', server_id: 'srv-1' })

    useCallStore.getState().handleWsEvent({
      type: 'call:moved',
      payload: {
        from_call_id: 'call-1',
        channel_id: 'canal-2',
        channel_name: 'Outro',
        user: { id: 'eu', username: 'eu', display_name: 'Eu' },
        moved_by: { id: 'mod', username: 'mod', display_name: 'Mod' }
      }
    })
    await flush()
    await flush()

    const s = useCallStore.getState()
    expect(s.callId).toBe('call-2')
    expect(s.watchedScreenIds).toEqual([])
    expect(s.availableScreens).toEqual([])
    expect(s.focusedScreenUserId).toBeNull()
  })
})

describe('callStore — detecção local da própria fala', () => {
  const speakers = (i = 0): ((ids: string[]) => void) =>
    (media.instances[i].handlers as { onActiveSpeakers: (ids: string[]) => void }).onActiveSpeakers

  it('começa ao entrar na chamada, no microfone publicado', async () => {
    const mic = fakeMic()
    rtc.getAudioStream.mockResolvedValueOnce(mic)
    await joinChannel()

    expect(vad.watches).toHaveLength(1)
    expect(vad.watches[0].mic).toBe(mic)
    expect(media.connect).toHaveBeenCalledWith(
      'ws://servidor',
      'tok',
      mic.stream.getAudioTracks()[0],
      false
    )
  })

  it('o próprio anel vem só da detecção local; os outros, do servidor', async () => {
    await joinChannel()
    const watch = vad.watches[0]

    watch.handlers.onChange(true)
    expect(useCallStore.getState().speakingIds).toEqual(['eu'])

    // O servidor atrasado ainda me lista: não segura o anel.
    watch.handlers.onChange(false)
    speakers()(['eu', 'ana'])
    expect(useCallStore.getState().speakingIds).toEqual(['ana'])

    watch.handlers.onChange(true)
    expect(useCallStore.getState().speakingIds).toEqual(['ana', 'eu'])
  })

  it('reinicia no microfone novo ao trocar de dispositivo e ignora o antigo', async () => {
    const first = fakeMic()
    const second = fakeMic()
    rtc.getAudioStream.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    await joinChannel()
    const old = vad.watches[0]

    await useCallStore.getState().setInputDevice('mic-usb')

    expect(old.stop).toHaveBeenCalledTimes(1)
    expect(vad.watches).toHaveLength(2)
    expect(vad.watches[1].mic).toBe(second)
    // Callback atrasado do watch parado não acende nada.
    old.handlers.onChange(true)
    expect(useCallStore.getState().speakingIds).toEqual([])
    vad.watches[1].handlers.onChange(true)
    expect(useCallStore.getState().speakingIds).toEqual(['eu'])
  })

  it('para ao sair da chamada e não reacende com callback atrasado', async () => {
    await joinChannel()
    const watch = vad.watches[0]
    watch.handlers.onChange(true)

    useCallStore.getState().endCall()

    expect(watch.stop).toHaveBeenCalledTimes(1)
    watch.handlers.onChange(true)
    expect(useCallStore.getState().speakingIds).toEqual([])
  })

  it('para quando o servidor manda call:error da chamada', async () => {
    await joinChannel()
    const watch = vad.watches[0]

    useCallStore.getState().handleWsEvent({
      type: 'call:error',
      payload: { call_id: 'call-1', message: 'erro' }
    })

    expect(watch.stop).toHaveBeenCalledTimes(1)
    expect(useCallStore.getState().status).toBe('idle')
  })

  it('DM: não começa enquanto só toca; começa ao aceitar e para ao desligar', async () => {
    const invite = (): void =>
      useCallStore.getState().handleWsEvent({
        type: 'call:invite',
        payload: {
          call_id: 'dm-1',
          type: 'dm',
          initiator: { id: 'ana', username: 'ana', display_name: 'Ana' }
        }
      })
    invite()
    expect(useCallStore.getState().status).toBe('ringing')
    useCallStore.getState().declineCall()
    expect(vad.watches).toHaveLength(0)

    invite()
    await useCallStore.getState().acceptCall()
    await flush()
    await flush()
    expect(vad.watches).toHaveLength(1)
    useCallStore.getState().endCall()
    expect(vad.watches[0].stop).toHaveBeenCalledTimes(1)
  })

  it('mudo nunca está falando, nem com a detecção local acesa', async () => {
    await joinChannel()
    vad.watches[0].handlers.onChange(true)

    useCallStore.getState().toggleMute()
    expect(useCallStore.getState().speakingIds).toEqual([])
    // Ainda mudo: nem a detecção local nem o servidor acendem.
    vad.watches[0].handlers.onChange(true)
    speakers()(['eu'])
    expect(useCallStore.getState().speakingIds).toEqual([])

    useCallStore.getState().toggleMute()
    expect(useCallStore.getState().speakingIds).toEqual(['eu'])
  })

  it('ensurdecido nunca está falando', async () => {
    await joinChannel()
    vad.watches[0].handlers.onChange(true)

    useCallStore.getState().toggleDeafen()
    expect(useCallStore.getState().speakingIds).toEqual([])
    vad.watches[0].handlers.onChange(true)
    expect(useCallStore.getState().speakingIds).toEqual([])
  })

  it('sem detecção local, mutar esconde o próprio anel que o servidor ainda mostra', async () => {
    await joinChannel()
    vad.watches[0].handlers.onUnavailable()
    speakers()(['eu', 'ana'])
    expect(useCallStore.getState().speakingIds).toEqual(['eu', 'ana'])

    useCallStore.getState().toggleMute()
    expect(useCallStore.getState().speakingIds).toEqual(['ana'])
    speakers()(['eu', 'ana'])
    expect(useCallStore.getState().speakingIds).toEqual(['ana'])
  })

  it('movido por moderador: troca o watch e aplica o mute de antes ao anel', async () => {
    await joinChannel()
    const old = vad.watches[0]
    useCallStore.getState().toggleMute()
    api.startCall.mockResolvedValue({ id: 'call-2', server_id: 'srv-1' })
    const state = deferred<{ call: null; participants: never[] }>()
    api.getCallState.mockReturnValueOnce(state.promise)

    useCallStore.getState().handleWsEvent({
      type: 'call:moved',
      payload: {
        from_call_id: 'call-1',
        channel_id: 'canal-2',
        channel_name: 'Outro',
        user: { id: 'eu', username: 'eu', display_name: 'Eu' },
        moved_by: { id: 'mod', username: 'mod', display_name: 'Mod' }
      }
    })
    await flush()
    await flush()

    expect(old.stop).toHaveBeenCalledTimes(1)
    expect(vad.watches).toHaveLength(2)
    // Entre entrar na sala nova e reaplicar o mute, o servidor me lista.
    vad.watches[1].handlers.onUnavailable()
    speakers(1)(['eu'])
    expect(useCallStore.getState().speakingIds).toEqual(['eu'])

    state.resolve({ call: null, participants: [] })
    await flush()
    await flush()
    expect(useCallStore.getState().muted).toBe(true)
    expect(useCallStore.getState().speakingIds).toEqual([])
  })
})

// ─── Permissões de voz (cargos) ─────────────────────────────────────────────

const mediaHandlers = (): {
  onPublishPermissions: (allowed: { microphone: boolean; stream: boolean }) => void
} => media.instances[0].handlers as never

describe('callStore — permissões de voz', () => {
  it('começa podendo falar e transmitir', async () => {
    await joinChannel()
    expect(useCallStore.getState()).toMatchObject({ canSpeak: true, canStream: true })
  })

  it('perder a permissão de falar muda para mudo e avisa a chamada', async () => {
    await joinChannel()
    chat.sendEvent.mockClear()

    mediaHandlers().onPublishPermissions({ microphone: false, stream: true })

    expect(useCallStore.getState()).toMatchObject({ canSpeak: false, muted: true, canStream: true })
    expect(chat.sendEvent).toHaveBeenLastCalledWith('call:voice', {
      call_id: 'call-1',
      muted: true,
      deafened: false
    })
  })

  it('sem permissão de falar não dá para desmutar', async () => {
    await joinChannel()
    mediaHandlers().onPublishPermissions({ microphone: false, stream: true })
    vi.mocked(showToast.error).mockClear()

    useCallStore.getState().toggleMute()

    expect(useCallStore.getState().muted).toBe(true)
    expect(showToast.error).toHaveBeenCalledWith(expect.stringMatching(/permissão para falar/))
  })

  it('silenciado por moderador explica o motivo certo', async () => {
    await joinChannel()
    useCallStore.getState().handleWsEvent({
      type: 'call:voice',
      payload: {
        call_id: 'call-1',
        user_id: 'eu',
        muted: true,
        deafened: false,
        server_muted: true,
        server_deafened: false
      }
    })
    mediaHandlers().onPublishPermissions({ microphone: false, stream: true })
    vi.mocked(showToast.error).mockClear()

    useCallStore.getState().toggleMute()

    expect(showToast.error).toHaveBeenCalledWith(expect.stringMatching(/moderador/))
  })

  it('ganhar a permissão publica o microfone, mas não desmuta sozinho', async () => {
    await joinChannel()
    mediaHandlers().onPublishPermissions({ microphone: false, stream: true })

    mediaHandlers().onPublishPermissions({ microphone: true, stream: true })

    expect(useCallStore.getState()).toMatchObject({ canSpeak: true, muted: true })
    expect(media.instances[0].ensureMic).toHaveBeenCalledWith(true)
    useCallStore.getState().toggleMute()
    expect(useCallStore.getState().muted).toBe(false)
  })

  it('sem permissão de transmitir, tela e câmera nem abrem', async () => {
    await joinChannel()
    mediaHandlers().onPublishPermissions({ microphone: true, stream: false })
    vi.mocked(showToast.error).mockClear()

    await useCallStore.getState().startScreenShare()
    await useCallStore.getState().toggleCamera()

    expect(rtc.getDisplayStream).not.toHaveBeenCalled()
    expect(rtc.getCameraStream).not.toHaveBeenCalled()
    expect(showToast.error).toHaveBeenCalledTimes(2)
    expect(showToast.error).toHaveBeenCalledWith(expect.stringMatching(/transmitir/))
  })

  it('desconectado por um moderador: avisa e encerra a chamada', async () => {
    await joinChannel()
    const handlers = media.instances[0].handlers as { onRemovedByModerator: () => void }

    handlers.onRemovedByModerator()

    expect(showToast.info).toHaveBeenCalledWith(expect.stringMatching(/moderador desconectou/))
    expect(useCallStore.getState().status).toBe('idle')
  })

  it('sair da chamada devolve as permissões ao padrão', async () => {
    await joinChannel()
    mediaHandlers().onPublishPermissions({ microphone: false, stream: false })

    useCallStore.getState().endCall()

    expect(useCallStore.getState()).toMatchObject({ canSpeak: true, canStream: true })
  })
})

describe('callStore — salas trancadas e pedidos de entrada', () => {
  it('toggleLock envia evento call:lock com inversão do estado atual', async () => {
    await joinChannel()
    expect(useCallStore.getState().locked).toBe(false)

    useCallStore.getState().toggleLock()
    expect(chat.sendEvent).toHaveBeenCalledWith('call:lock', {
      call_id: 'call-1',
      locked: true
    })
  })

  it('evento call:lock atualiza o estado local e serverCalls', () => {
    useCallStore.getState().setServerCalls({
      'canal-1': {
        call: { id: 'call-1', type: 'channel', channel_id: 'canal-1', initiator_id: 'ana', status: 'active', started_at: '', locked: false },
        participants: []
      }
    })

    useCallStore.getState().handleWsEvent({
      type: 'call:lock',
      payload: {
        call_id: 'call-1',
        channel_id: 'canal-1',
        locked: true,
        by: { id: 'ana', username: 'ana', display_name: 'Ana' }
      }
    })

    expect(useCallStore.getState().serverCalls['canal-1']?.call?.locked).toBe(true)
  })

  it('receber call:knock adiciona participante aos joinRequests', async () => {
    await joinChannel()
    const joao = { id: 'joao', username: 'joao', display_name: 'João' }

    useCallStore.getState().handleWsEvent({
      type: 'call:knock',
      payload: {
        call_id: 'call-1',
        user: joao
      }
    })

    expect(useCallStore.getState().joinRequests).toEqual([joao])

    // call:knock_resolved remove o usuário de joinRequests
    useCallStore.getState().handleWsEvent({
      type: 'call:knock_resolved',
      payload: {
        call_id: 'call-1',
        user_id: 'joao',
        accepted: true,
        reason: 'accepted'
      }
    })

    expect(useCallStore.getState().joinRequests).toEqual([])
  })

  it('call:knock_accepted conecta automaticamente ao canal', async () => {
    useCallStore.setState({
      knock: { channelId: 'canal-trancado', callId: 'call-x', status: 'pending' }
    })
    api.startCall.mockResolvedValue({ id: 'call-x', server_id: 'srv-1', locked: true })

    useCallStore.getState().handleWsEvent({
      type: 'call:knock_accepted',
      payload: {
        call_id: 'call-x',
        channel_id: 'canal-trancado',
        server_id: 'srv-1',
        reason: 'accepted',
        by: { id: 'mod', username: 'mod', display_name: 'Mod' }
      }
    })

    await flush()
    await flush()

    expect(useCallStore.getState().knock).toBeNull()
    expect(useCallStore.getState().callId).toBe('call-x')
    expect(useCallStore.getState().admittedChannelId).toBe('canal-trancado')
  })
})
