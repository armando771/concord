import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sala falsa do LiveKit: só o que o CallMedia usa (eventos, estado, participantes).

interface FakePublication {
  source: string
  isDesired: boolean
  isSubscribed: boolean
  isMuted: boolean
  track: undefined
  setSubscribed: (v: boolean) => void
}

interface FakeParticipant {
  identity: string
  name: string
  trackPublications: Map<string, FakePublication>
}

const lk = vi.hoisted(() => {
  class FakeRoom {
    state = 'disconnected'
    remoteParticipants = new Map<string, unknown>()
    listeners = new Map<string, Array<(...args: unknown[]) => void>>()
    localParticipant: {
      publishTrack: ReturnType<typeof vi.fn>
      getTrackPublication: ReturnType<typeof vi.fn>
      permissions?: { canPublish?: boolean; canPublishSources?: number[] }
    } = {
      publishTrack: vi.fn(async () => ({ mute: vi.fn(async () => {}) })),
      getTrackPublication: vi.fn()
    }
    on(event: string, fn: (...args: unknown[]) => void): this {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn])
      return this
    }
    emit(event: string, ...args: unknown[]): void {
      this.listeners.get(event)?.forEach((fn) => fn(...args))
    }
    async connect(): Promise<void> {
      this.state = 'connected'
    }
    disconnect = vi.fn(async () => {})
  }
  return { FakeRoom, rooms: [] as FakeRoom[] }
})

vi.mock('livekit-client', () => ({
  Room: class extends lk.FakeRoom {
    constructor() {
      super()
      lk.rooms.push(this)
    }
  },
  // RoomEvent.X === 'X'
  RoomEvent: new Proxy({}, { get: (_, key) => key }),
  ConnectionState: { Connected: 'connected', Reconnecting: 'reconnecting' },
  DisconnectReason: { CLIENT_INITIATED: 1, PARTICIPANT_REMOVED: 4 },
  AudioPresets: { musicHighQualityStereo: {} },
  Track: {
    Source: {
      Microphone: 'microphone',
      Camera: 'camera',
      ScreenShare: 'screen_share',
      ScreenShareAudio: 'screen_share_audio'
    },
    Kind: { Audio: 'audio', Video: 'video' }
  }
}))

import { CallMedia, type RemoteMedia } from './livekit'

function publication(source: string): FakePublication {
  const pub: FakePublication = {
    source,
    isDesired: false,
    isSubscribed: false,
    isMuted: false,
    track: undefined,
    setSubscribed: (v) => {
      pub.isDesired = v
    }
  }
  return pub
}

function addParticipant(identity: string, ...sources: string[]): FakeParticipant {
  const p: FakeParticipant = {
    identity,
    name: identity,
    trackPublications: new Map(sources.map((s, i) => [`${identity}-${i}`, publication(s)]))
  }
  room().remoteParticipants.set(identity, p)
  return p
}

const pubOf = (p: FakeParticipant, source: string): FakePublication =>
  [...p.trackPublications.values()].find((x) => x.source === source)!

const room = (): InstanceType<typeof lk.FakeRoom> => lk.rooms[lk.rooms.length - 1]
const microtasks = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

let emitted: RemoteMedia[]
const last = (): RemoteMedia => emitted[emitted.length - 1]

function createMedia(): CallMedia {
  const media = new CallMedia({
    onRemoteMedia: (m) => emitted.push(m),
    onConnectionLost: vi.fn(),
    onReconnecting: vi.fn(),
    onReconnected: vi.fn(),
    onActiveSpeakers: vi.fn()
  })
  return media
}

beforeEach(() => {
  lk.rooms.length = 0
  emitted = []
})

describe('CallMedia — assinatura seletiva', () => {
  it('ao entrar assina microfone e câmera, mas não a tela de ninguém', async () => {
    const media = createMedia()
    const ana = addParticipant('ana', 'microphone', 'camera', 'screen_share', 'screen_share_audio')

    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)

    expect(pubOf(ana, 'microphone').isDesired).toBe(true)
    expect(pubOf(ana, 'camera').isDesired).toBe(true)
    expect(pubOf(ana, 'screen_share').isDesired).toBe(false)
    expect(pubOf(ana, 'screen_share_audio').isDesired).toBe(false)
    expect(last().availableScreens).toEqual(['ana'])
  })

  it('assistir assina a tela e o som da tela', async () => {
    const media = createMedia()
    const ana = addParticipant('ana', 'microphone', 'screen_share', 'screen_share_audio')
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)

    media.setWatchedScreens(['ana'])

    expect(pubOf(ana, 'screen_share').isDesired).toBe(true)
    expect(pubOf(ana, 'screen_share_audio').isDesired).toBe(true)
  })

  it('reconexão completa não esquece quem eu estava assistindo', async () => {
    const media = createMedia()
    addParticipant('ana', 'microphone', 'screen_share')
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    media.setWatchedScreens(['ana'])

    // Como o SDK: desmonta os participantes (ainda "connected") e só depois
    // passa para "reconnecting", tudo no mesmo tick.
    room().remoteParticipants.clear()
    room().emit('ParticipantDisconnected')
    room().state = 'reconnecting'
    room().emit('Reconnecting')
    await microtasks()
    expect(last()).toMatchObject({ availableScreens: [], reconnecting: true })

    const back = addParticipant('ana', 'microphone', 'screen_share')
    room().state = 'connected'
    room().emit('Reconnected')

    expect(pubOf(back, 'screen_share').isDesired).toBe(true)
    expect(last()).toMatchObject({ availableScreens: ['ana'], reconnecting: false })
  })

  it('quem parou de transmitir durante a reconexão volta pausado', async () => {
    const media = createMedia()
    addParticipant('ana', 'microphone', 'screen_share')
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    media.setWatchedScreens(['ana'])

    room().remoteParticipants.clear()
    room().state = 'reconnecting'
    room().emit('Reconnecting')
    const back = addParticipant('ana', 'microphone')
    room().state = 'connected'
    room().emit('Reconnected')

    back.trackPublications.set('nova-tela', publication('screen_share'))
    room().emit('TrackPublished')

    expect(pubOf(back, 'screen_share').isDesired).toBe(false)
  })

  it('quem para e volta a transmitir começa pausado de novo', async () => {
    const media = createMedia()
    const ana = addParticipant('ana', 'microphone', 'screen_share')
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    media.setWatchedScreens(['ana'])

    ana.trackPublications.delete('ana-1')
    room().emit('TrackUnpublished')
    await microtasks()
    ana.trackPublications.set('nova-tela', publication('screen_share'))
    room().emit('TrackPublished')

    expect(pubOf(ana, 'screen_share').isDesired).toBe(false)
  })
})

function mediaWithPermissionHandler(onPublishPermissions: () => void): CallMedia {
  return new CallMedia({
    onRemoteMedia: (m) => emitted.push(m),
    onConnectionLost: vi.fn(),
    onReconnecting: vi.fn(),
    onReconnected: vi.fn(),
    onActiveSpeakers: vi.fn(),
    onPublishPermissions
  })
}

describe('CallMedia — permissões de publicação', () => {
  const NO_MIC = { canPublish: true, canPublishSources: [1, 3, 4] }

  it('sem permissão de falar entra na sala e não publica o microfone', async () => {
    const onPublishPermissions = vi.fn()
    const media = mediaWithPermissionHandler(onPublishPermissions)
    room().localParticipant.permissions = NO_MIC

    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)

    expect(room().localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(onPublishPermissions).toHaveBeenLastCalledWith({ microphone: false, stream: true })
  })

  it('com permissão publica o microfone normalmente', async () => {
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, true)
    expect(room().localParticipant.publishTrack).toHaveBeenCalledTimes(1)
  })

  it('ganhar a permissão depois publica o microfone', async () => {
    const onPublishPermissions = vi.fn()
    const media = mediaWithPermissionHandler(onPublishPermissions)
    room().localParticipant.permissions = NO_MIC
    const mic = {} as MediaStreamTrack
    await media.connect('ws://x', 'tok', mic, false)

    room().localParticipant.permissions = { canPublish: true, canPublishSources: [1, 2, 3, 4] }
    room().emit('ParticipantPermissionsChanged', undefined, room().localParticipant)
    await media.ensureMic(false)

    expect(onPublishPermissions).toHaveBeenLastCalledWith({ microphone: true, stream: true })
    expect(room().localParticipant.publishTrack).toHaveBeenCalledTimes(1)
    expect(room().localParticipant.publishTrack.mock.calls[0][0]).toBe(mic)
  })

  it('não publica o microfone duas vezes', async () => {
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    room().localParticipant.getTrackPublication.mockReturnValue({})
    await media.ensureMic(false)
    expect(room().localParticipant.publishTrack).toHaveBeenCalledTimes(1)
  })

  it('permissões de outro participante não contam', async () => {
    const onPublishPermissions = vi.fn()
    const media = mediaWithPermissionHandler(onPublishPermissions)
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    onPublishPermissions.mockClear()
    room().emit('ParticipantPermissionsChanged', undefined, { identity: 'ana' })
    expect(onPublishPermissions).not.toHaveBeenCalled()
  })

  it('sem permissão de transmitir, tela e câmera recusam', async () => {
    const media = createMedia()
    room().localParticipant.permissions = { canPublish: true, canPublishSources: [2] }
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    const stream = {
      getVideoTracks: () => [{}],
      getAudioTracks: () => []
    } as unknown as MediaStream
    await expect(media.publishScreen(stream)).rejects.toThrow('no_stream_permission')
    await expect(media.publishCamera(stream)).rejects.toThrow('no_stream_permission')
  })
})

describe('CallMedia — desconectado por moderador', () => {
  function mediaWithRemovedHandler(): {
    onRemovedByModerator: ReturnType<typeof vi.fn>
    onConnectionLost: ReturnType<typeof vi.fn>
  } {
    const onRemovedByModerator = vi.fn()
    const onConnectionLost = vi.fn()
    void new CallMedia({
      onRemoteMedia: (m) => emitted.push(m),
      onConnectionLost,
      onReconnecting: vi.fn(),
      onReconnected: vi.fn(),
      onActiveSpeakers: vi.fn(),
      onRemovedByModerator
    })
    return { onRemovedByModerator, onConnectionLost }
  }

  it('avisa que foi removido, sem tratar como queda de conexão', () => {
    const { onRemovedByModerator, onConnectionLost } = mediaWithRemovedHandler()
    room().emit('Disconnected', 4)
    expect(onRemovedByModerator).toHaveBeenCalledTimes(1)
    expect(onConnectionLost).not.toHaveBeenCalled()
  })

  it('outra desconexão continua sendo queda de conexão', () => {
    const { onRemovedByModerator, onConnectionLost } = mediaWithRemovedHandler()
    room().emit('Disconnected', 7)
    expect(onConnectionLost).toHaveBeenCalledTimes(1)
    expect(onRemovedByModerator).not.toHaveBeenCalled()
  })

  it('sair por conta própria não avisa nada', () => {
    const { onRemovedByModerator, onConnectionLost } = mediaWithRemovedHandler()
    room().emit('Disconnected', 1)
    expect(onRemovedByModerator).not.toHaveBeenCalled()
    expect(onConnectionLost).not.toHaveBeenCalled()
  })
})
