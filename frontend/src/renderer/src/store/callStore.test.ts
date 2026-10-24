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
  publishCamera: vi.fn()
}))
vi.mock('../lib/livekit', () => ({
  CallMedia: class {
    handlers: unknown
    connect = media.connect
    publishScreen = media.publishScreen
    publishCamera = media.publishCamera
    setMicMuted = vi.fn(async (muted: boolean) => {
      media.events.push(`mic(${muted})`)
    })
    unpublish = vi.fn(async () => {})
    replaceMic = vi.fn(async () => {})
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
vi.mock('./toastStore', () => ({ showToast: { error: vi.fn(), info: vi.fn() } }))
const sounds = vi.hoisted(() => ({ playSound: vi.fn(), setSoundOutput: vi.fn() }))
vi.mock('../lib/sounds', () => sounds)

import { useCallStore } from './callStore'

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

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
  rtc.getAudioStream.mockImplementation(async () => fakeMic())
  api.startCall.mockResolvedValue({ id: 'call-1' })
  media.connect.mockResolvedValue(undefined)
  media.publishScreen.mockResolvedValue(undefined)
  media.publishCamera.mockResolvedValue(undefined)
})

describe('callStore — mídia via LiveKit', () => {
  it('descarta a tela escolhida quando a chamada acabou com o seletor aberto', async () => {
    await joinChannel()
    const picked = deferred<MediaStream>()
    rtc.getDisplayStream.mockReturnValue(picked.promise)

    const sharing = useCallStore.getState().startScreenShare()
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

  it('respeita quem saiu do modo foco mesmo com novos eventos de mídia', async () => {
    await joinChannel()
    const connection = media.instances[0]
    const onRemoteMedia = (connection.handlers as { onRemoteMedia: (m: unknown) => void })
      .onRemoteMedia
    const remote = {
      streams: {},
      screenStreams: { ana: fakeStream('video') },
      screenAudioStreams: {},
      videoStreams: {}
    }

    onRemoteMedia(remote)
    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')

    useCallStore.getState().setFocusedScreenUser(null)
    onRemoteMedia({ ...remote, streams: { bia: fakeStream('audio') } })

    expect(useCallStore.getState().focusedScreenUserId).toBeNull()
  })

  it('foca uma tela nova quando ninguém estava compartilhando', async () => {
    await joinChannel()
    const onRemoteMedia = (media.instances[0].handlers as { onRemoteMedia: (m: unknown) => void })
      .onRemoteMedia
    const empty = { streams: {}, screenStreams: {}, screenAudioStreams: {}, videoStreams: {} }

    onRemoteMedia(empty)
    onRemoteMedia({ ...empty, screenStreams: { ana: fakeStream('video') } })

    expect(useCallStore.getState().focusedScreenUserId).toBe('ana')
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

  it('marca quem está falando, incluindo o próprio usuário', async () => {
    await joinChannel()
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

    expect(useCallStore.getState().voiceStates.ana).toEqual({ muted: true, deafened: true })
    expect(useCallStore.getState().serverCalls['canal-1'].participants[0]).toMatchObject({
      muted: true,
      deafened: true
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
    rtc.getAudioStream
      .mockResolvedValueOnce(fakeMic())
      .mockResolvedValueOnce(fakeMic())
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
