import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Sala falsa do LiveKit: só o que o CallMedia usa (eventos, estado, participantes).

interface FakePublication {
  source: string
  isDesired: boolean
  isSubscribed: boolean
  isMuted: boolean
  track: { getRTCStatsReport: () => Promise<RTCStatsReport | undefined> } | undefined
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
      trackPublications: Map<string, FakePublication>
      publishTrack: ReturnType<typeof vi.fn>
      getTrackPublication: ReturnType<typeof vi.fn>
      permissions?: { canPublish?: boolean; canPublishSources?: number[] }
    } = {
      trackPublications: new Map(),
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
import { rememberScreenSource, rememberStreamQuality } from './screenShareQuality'

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
afterEach(() => vi.unstubAllGlobals())

describe('CallMedia — latência sob demanda', () => {
  it('não consulta tracks fora de uma conexão ativa', async () => {
    expect(await createMedia().getLatency()).toBeNull()
  })

  it('lê estatísticas públicas de uma track remota quando não publica microfone', async () => {
    const media = createMedia()
    room().state = 'connected'
    const participant = addParticipant('ana', 'microphone')
    const getRTCStatsReport = vi.fn(
      async () =>
        new Map([
          ['rtt', { type: 'remote-inbound-rtp', roundTripTime: 0.042 }]
        ]) as unknown as RTCStatsReport
    )
    pubOf(participant, 'microphone').track = { getRTCStatsReport }
    expect(await media.getLatency()).toBe(42)
    expect(getRTCStatsReport).toHaveBeenCalledTimes(1)
  })

  it('ignora track removida e resultado atrasado durante reconexão', async () => {
    const media = createMedia()
    room().state = 'connected'
    const participant = addParticipant('ana', 'microphone')
    pubOf(participant, 'microphone').track = {
      getRTCStatsReport: vi.fn().mockRejectedValue(new Error('removed'))
    }
    expect(await media.getLatency()).toBeNull()
    pubOf(participant, 'microphone').track = {
      getRTCStatsReport: async () => {
        room().state = 'reconnecting'
        return new Map([
          ['rtt', { type: 'remote-inbound-rtp', roundTripTime: 0.1 }]
        ]) as unknown as RTCStatsReport
      }
    }
    expect(await media.getLatency()).toBeNull()
  })
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

describe('CallMedia — trocar a câmera publicada', () => {
  const streamOf = (track: unknown): MediaStream =>
    ({ getVideoTracks: () => [track], getAudioTracks: () => [] }) as unknown as MediaStream

  it('substitui a track na publicação existente, sem despublicar', async () => {
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    room().localParticipant.publishTrack.mockClear() // o connect publicou o microfone
    const replaceTrack = vi.fn(async () => {})
    room().localParticipant.getTrackPublication.mockImplementation((source: string) =>
      source === 'camera' ? { track: { replaceTrack } } : undefined
    )
    const next = {}
    await media.replaceCamera(streamOf(next))
    expect(replaceTrack).toHaveBeenCalledWith(next, true)
    expect(room().localParticipant.publishTrack).not.toHaveBeenCalled()
  })

  it('sem câmera publicada não faz nada', async () => {
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    room().localParticipant.publishTrack.mockClear()
    room().localParticipant.getTrackPublication.mockReturnValue(undefined)
    await expect(media.replaceCamera(streamOf({}))).resolves.toBeUndefined()
    expect(room().localParticipant.publishTrack).not.toHaveBeenCalled()
  })

  it('stream sem vídeo é ignorado', async () => {
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    const replaceTrack = vi.fn()
    room().localParticipant.getTrackPublication.mockReturnValue({ track: { replaceTrack } })
    await media.replaceCamera({ getVideoTracks: () => [] } as unknown as MediaStream)
    expect(replaceTrack).not.toHaveBeenCalled()
  })
})

describe('CallMedia — qualidade de tela', () => {
  async function activeScreen() {
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    const video = {
      readyState: 'live',
      getSettings: () => ({ width: 3840, height: 2160 }),
      getConstraints: () => ({ width: { max: 1920 }, height: { max: 1080 } }),
      applyConstraints: vi.fn(async () => {}),
      stop: vi.fn()
    }
    rememberScreenSource(video as unknown as MediaStreamTrack)
    // A captura atual já foi reduzida: aumentar deve usar as dimensões originais.
    video.getSettings = () => ({ width: 1280, height: 720 })
    let parameters = { encodings: [{ maxBitrate: 4_000_000, maxFramerate: 30, active: true }] }
    const sender = {
      getParameters: () => structuredClone(parameters),
      setParameters: vi.fn(async (next) => {
        parameters = next
      })
    }
    const track = {
      mediaStreamTrack: video,
      sender,
      publishOptions: { simulcast: false },
      setDegradationPreference: vi.fn(async () => {})
    }
    const pub = { videoTrack: track }
    room().localParticipant.getTrackPublication.mockReturnValue(pub)
    room().localParticipant.publishTrack.mockClear()
    const stream = { getVideoTracks: () => [video] } as unknown as MediaStream
    return { media, stream, video, sender, track }
  }

  it('altera captura e envio mantendo a publicação e os espectadores', async () => {
    const { media, stream, video, sender, track } = await activeScreen()
    await media.updateScreenQuality(stream, { resolution: '1080p', frameRate: 60 })
    expect(video.applyConstraints).toHaveBeenCalledWith({
      width: { max: 1920 },
      height: { max: 1080 },
      frameRate: { ideal: 60, max: 60 }
    })
    expect(sender.getParameters().encodings[0]).toMatchObject({
      maxBitrate: 8_000_000,
      maxFramerate: 60,
      active: true
    })
    expect(track.publishOptions).toMatchObject({
      screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 }
    })
    expect(room().localParticipant.getTrackPublication('screen_share').options).toMatchObject({
      screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 }
    })
    expect(room().localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(video.stop).not.toHaveBeenCalled()
    // 60 fps = jogo: fluidez antes de resolução.
    expect((video as { contentHint?: string }).contentHint).toBe('motion')
    expect(track.setDegradationPreference).toHaveBeenLastCalledWith('maintain-framerate')
    await media.updateScreenQuality(stream, { resolution: 'source', frameRate: 30 })
    expect(video.applyConstraints).toHaveBeenLastCalledWith({ frameRate: { ideal: 30, max: 30 } })
    expect((video as { contentHint?: string }).contentHint).toBe('detail')
    expect(track.setDegradationPreference).toHaveBeenLastCalledWith('maintain-resolution')
  })

  it('restaura a captura se o envio recusar a atualização, sem parar o vídeo', async () => {
    const { media, stream, video, sender, track } = await activeScreen()
    sender.setParameters.mockRejectedValueOnce(new Error('encoder'))
    await expect(
      media.updateScreenQuality(stream, { resolution: '720p', frameRate: 60 })
    ).rejects.toThrow('encoder')
    expect(video.applyConstraints).toHaveBeenLastCalledWith(video.getConstraints())
    expect(track.publishOptions).toEqual({ simulcast: false })
    expect(track.setDegradationPreference).not.toHaveBeenCalled()
    expect(video.stop).not.toHaveBeenCalled()
  })

  it('não altera uma publicação encerrada ou reconectando', async () => {
    const { media, stream, video, sender } = await activeScreen()
    room().state = 'reconnecting'
    await expect(
      media.updateScreenQuality(stream, { resolution: '720p', frameRate: 60 })
    ).rejects.toThrow('screen_not_available')
    expect(video.applyConstraints).not.toHaveBeenCalled()
    expect(sender.setParameters).not.toHaveBeenCalled()
  })

  it('descarta uma alteração se a publicação mudar durante a aplicação', async () => {
    const { media, stream, video, sender } = await activeScreen()
    video.applyConstraints.mockImplementationOnce(async () => {
      room().localParticipant.getTrackPublication.mockReturnValue(undefined)
    })
    await expect(
      media.updateScreenQuality(stream, { resolution: '720p', frameRate: 60 })
    ).rejects.toThrow('screen_changed')
    expect(sender.setParameters).not.toHaveBeenCalled()
    expect(video.stop).not.toHaveBeenCalled()
  })

  it('publica e republica com o encoding escolhido, sem alterar o áudio', async () => {
    vi.stubGlobal('RTCRtpSender', {
      getCapabilities: () => ({ codecs: [{ mimeType: 'video/VP8' }, { mimeType: 'video/H264' }] })
    })
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    room().localParticipant.publishTrack.mockClear()
    const video = { getSettings: () => ({ width: 1920, height: 1080 }) }
    const audio = {}
    const stream = {
      getVideoTracks: () => [video],
      getAudioTracks: () => [audio]
    } as unknown as MediaStream
    rememberStreamQuality(stream, { resolution: '1080p', frameRate: 60 })
    await media.publishScreen(stream)
    await media.publishScreen(stream)
    expect(room().localParticipant.publishTrack).toHaveBeenCalledWith(video, {
      source: 'screen_share',
      name: 'screen',
      simulcast: false,
      screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
      videoCodec: 'h264',
      backupCodec: { codec: 'vp8' },
      degradationPreference: 'maintain-framerate'
    })
    expect(room().localParticipant.publishTrack).toHaveBeenCalledWith(
      audio,
      expect.objectContaining({
        source: 'screen_share_audio',
        forceStereo: true
      })
    )
  })
})

describe('CallMedia — codec da tela', () => {
  it('VP8 escolhido em Avançado: publica VP8, sem reserva', async () => {
    vi.stubGlobal('RTCRtpSender', {
      getCapabilities: () => ({ codecs: [{ mimeType: 'video/H264' }] })
    })
    vi.stubGlobal('localStorage', { getItem: () => 'vp8', setItem: vi.fn() })
    const media = createMedia()
    await media.connect('ws://x', 'tok', {} as MediaStreamTrack, false)
    room().localParticipant.publishTrack.mockClear()
    const video = { getSettings: () => ({ width: 1920, height: 1080 }) }
    const stream = {
      getVideoTracks: () => [video],
      getAudioTracks: () => []
    } as unknown as MediaStream
    await media.publishScreen(stream)
    expect(room().localParticipant.publishTrack).toHaveBeenCalledWith(
      video,
      expect.objectContaining({ videoCodec: 'vp8', backupCodec: false })
    )
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

describe('CallMedia — sinais de conexão', () => {
  function mediaWithSignals(): {
    media: CallMedia
    onConnectionLost: ReturnType<typeof vi.fn>
    onSignalConnected: ReturnType<typeof vi.fn>
    onConnectionQuality: ReturnType<typeof vi.fn>
  } {
    const onConnectionLost = vi.fn()
    const onSignalConnected = vi.fn()
    const onConnectionQuality = vi.fn()
    const media = new CallMedia({
      onRemoteMedia: (m) => emitted.push(m),
      onConnectionLost,
      onReconnecting: vi.fn(),
      onReconnected: vi.fn(),
      onActiveSpeakers: vi.fn(),
      onSignalConnected,
      onConnectionQuality
    })
    return { media, onConnectionLost, onSignalConnected, onConnectionQuality }
  }

  it('repassa o motivo da queda', () => {
    const { onConnectionLost } = mediaWithSignals()
    room().emit('Disconnected', 14)
    expect(onConnectionLost).toHaveBeenCalledWith(14)
  })

  it('avisa quando o canal de controle abre (falta a mídia)', () => {
    const { onSignalConnected } = mediaWithSignals()
    room().emit('SignalConnected')
    expect(onSignalConnected).toHaveBeenCalledTimes(1)
  })

  it('qualidade por pessoa (identity), com valor desconhecido virando "unknown"', () => {
    const { onConnectionQuality } = mediaWithSignals()
    room().emit('ConnectionQualityChanged', 'poor', { identity: 'ana' })
    room().emit('ConnectionQualityChanged', 'weird', { identity: 'eu' })
    room().emit('ConnectionQualityChanged', 'good', undefined)
    expect(onConnectionQuality.mock.calls).toEqual([
      ['ana', 'poor'],
      ['eu', 'unknown']
    ])
  })

  it('depois de disconnect() não repassa mais nada', () => {
    const { media, onConnectionQuality, onSignalConnected } = mediaWithSignals()
    media.disconnect()
    room().emit('ConnectionQualityChanged', 'poor', { identity: 'ana' })
    room().emit('SignalConnected')
    expect(onConnectionQuality).not.toHaveBeenCalled()
    expect(onSignalConnected).not.toHaveBeenCalled()
  })

  it('perda do áudio de alguém entre duas leituras', async () => {
    const { media } = mediaWithSignals()
    room().state = 'connected'
    let counters = { packetsReceived: 100, packetsLost: 0 }
    const remote = {
      identity: 'ana',
      name: 'ana',
      trackPublications: new Map(),
      getTrackPublication: () => ({
        track: {
          getRTCStatsReport: async () =>
            new Map([['in', { type: 'inbound-rtp', ...counters }]]) as unknown as RTCStatsReport
        }
      })
    }
    room().remoteParticipants.set('ana', remote)
    expect(await media.getQualityDetails(['ana'], 'eu')).toEqual({
      ana: { lossPercent: null, latencyMs: null }
    })
    counters = { packetsReceived: 180, packetsLost: 20 }
    const second = await media.getQualityDetails(['ana'], 'eu')
    expect(second.ana.lossPercent).toBeCloseTo(20)
  })
})
