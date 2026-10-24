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
  rtc.getAudioStream.mockImplementation(async () => fakeStream('audio'))
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
})
