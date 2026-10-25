import {
  AudioPresets,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant
} from 'livekit-client'
import {
  groupTracks,
  listScreenPublishers,
  StreamCache,
  wantsSubscription,
  type MediaKind,
  type PublicationEntry,
  type TrackEntry
} from './callMedia'
import { pruneWatched } from './screenWatch'

// Mídia das chamadas via SFU (LiveKit): cada pessoa envia uma cópia de cada
// track para o servidor, que distribui para os demais. Substitui o mesh P2P.

export interface RemoteMedia {
  /** userId -> microfone */
  streams: Record<string, MediaStream>
  /** userId -> vídeo da tela */
  screenStreams: Record<string, MediaStream>
  /** userId -> som da tela (jogo, vídeo…) */
  screenAudioStreams: Record<string, MediaStream>
  /** userId -> câmera */
  videoStreams: Record<string, MediaStream>
  /** userId -> nome de quem está na sala de mídia (com ou sem tracks) */
  mediaPeers: Record<string, string>
  /** userIds com tela publicada (assistida ou não — a não assistida não é baixada) */
  availableScreens: string[]
}

export interface CallMediaHandlers {
  onRemoteMedia: (media: RemoteMedia) => void
  /** Queda que o LiveKit não conseguiu recuperar (não chamado em disconnect()). */
  onConnectionLost: () => void
  onReconnecting: () => void
  onReconnected: () => void
  /** Quem está falando agora (identity = userId), incluindo o próprio usuário. */
  onActiveSpeakers: (userIds: string[]) => void
}

const SCREEN_MAX_BITRATE = 4_000_000
const SCREEN_MAX_FRAMERATE = 30

export class CallMedia {
  private room: Room
  private cache = new StreamCache<MediaStream>((tracks) => new MediaStream(tracks))
  private closing = false
  /** Tela/câmera pedidas antes disso são publicadas por quem chamou connect(). */
  private connected = false
  /** De quem baixar a tela: transmissão dos outros começa pausada (ver setWatchedScreens). */
  private watched = new Set<string>()

  constructor(private readonly handlers: CallMediaHandlers) {
    this.room = new Room({
      // Os streams vão para <video>/<audio> próprios da UI, não para elementos
      // anexados pelo SDK — adaptiveStream depende deles, então fica desligado.
      adaptiveStream: false,
      dynacast: true,
      publishDefaults: {
        dtx: true,
        red: true,
        simulcast: true,
        videoCodec: 'vp8',
        screenShareEncoding: {
          maxBitrate: SCREEN_MAX_BITRATE,
          maxFramerate: SCREEN_MAX_FRAMERATE
        }
      }
    })

    const refresh = (): void => this.emitRemoteMedia()
    const published = (): void => {
      this.applySubscriptions()
      refresh()
    }
    this.room
      .on(RoomEvent.TrackPublished, published)
      .on(RoomEvent.TrackUnpublished, refresh)
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.ParticipantConnected, published)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.ParticipantNameChanged, refresh)
      .on(RoomEvent.Reconnecting, () => this.handlers.onReconnecting())
      .on(RoomEvent.Reconnected, () => {
        this.applySubscriptions()
        this.handlers.onReconnected()
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        this.handlers.onActiveSpeakers(speakers.map((p) => p.identity))
      )
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (this.closing || reason === DisconnectReason.CLIENT_INITIATED) return
        this.handlers.onConnectionLost()
      })
  }

  async connect(url: string, token: string, mic: MediaStreamTrack, muted: boolean): Promise<void> {
    // Assinatura manual: tela e som da tela só de quem estou assistindo.
    await this.room.connect(url, token, { autoSubscribe: false })
    // TrackPublished não dispara para o que já estava publicado ao entrar.
    this.applySubscriptions()
    const publication = await this.room.localParticipant.publishTrack(mic, {
      source: Track.Source.Microphone,
      name: 'microphone'
    })
    if (muted) await publication.mute()
    this.connected = true
    this.emitRemoteMedia()
  }

  async setMicMuted(muted: boolean): Promise<void> {
    const publication = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)
    if (!publication) return
    if (muted) await publication.mute()
    else await publication.unmute()
  }

  /** Troca o microfone publicado (outro dispositivo) sem sair da sala. */
  async replaceMic(track: MediaStreamTrack): Promise<void> {
    const publication = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)
    if (!publication?.track) return
    // userProvidedTrack: o SDK não para nem recria a track — o store é o dono.
    await publication.track.replaceTrack(track, true)
  }

  async publishScreen(stream: MediaStream): Promise<void> {
    if (!this.connected) return
    const [video] = stream.getVideoTracks()
    if (video) {
      await this.room.localParticipant.publishTrack(video, {
        source: Track.Source.ScreenShare,
        name: 'screen',
        simulcast: false
      })
    }
    const [audio] = stream.getAudioTracks()
    if (audio) {
      await this.room.localParticipant.publishTrack(audio, {
        source: Track.Source.ScreenShareAudio,
        name: 'screen-audio',
        audioPreset: AudioPresets.musicHighQualityStereo,
        forceStereo: true,
        dtx: false,
        red: false
      })
    }
  }

  async publishCamera(stream: MediaStream): Promise<void> {
    if (!this.connected) return
    const [video] = stream.getVideoTracks()
    if (!video) return
    await this.room.localParticipant.publishTrack(video, {
      source: Track.Source.Camera,
      name: 'camera'
    })
  }

  /** Despublica as tracks do stream (quem chama é dono de parar as tracks). */
  async unpublish(stream: MediaStream): Promise<void> {
    const tracks = stream.getTracks()
    if (!this.connected || tracks.length === 0) return
    await this.room.localParticipant.unpublishTracks(tracks)
  }

  /** Passa a baixar a tela (e o som dela) só dessas pessoas. */
  setWatchedScreens(userIds: string[]): void {
    this.watched = new Set(userIds)
    this.applySubscriptions()
  }

  private applySubscriptions(): void {
    this.room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      participant.trackPublications.forEach((publication) => {
        const want = wantsSubscription(publication.source, participant.identity, this.watched)
        // Com autoSubscribe desligado, isDesired começa false.
        if (publication.isDesired !== want) publication.setSubscribed(want)
      })
    })
  }

  disconnect(): void {
    this.closing = true
    this.cache.clear()
    void this.room.disconnect()
  }

  private emitRemoteMedia(): void {
    const entries: TrackEntry[] = []
    const publications: PublicationEntry[] = []
    const mediaPeers: Record<string, string> = {}
    this.room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      mediaPeers[participant.identity] = participant.name ?? ''
      participant.trackPublications.forEach((publication) => {
        publications.push({ userId: participant.identity, source: publication.source })
        const track = publication.track
        if (!publication.isSubscribed || !track) return
        // Vídeo pausado (câmera desligada pelo SO, etc.) some da UI.
        if (track.kind === Track.Kind.Video && publication.isMuted) return
        entries.push({
          userId: participant.identity,
          source: publication.source,
          track: track.mediaStreamTrack
        })
      })
    })

    const grouped = groupTracks(entries)
    const inUse = new Set<string>()
    const toStreams = (kind: MediaKind): Record<string, MediaStream> => {
      const out: Record<string, MediaStream> = {}
      for (const [userId, tracks] of Object.entries(grouped[kind])) {
        const key = `${userId}:${kind}`
        inUse.add(key)
        out[userId] = this.cache.get(key, tracks)
      }
      return out
    }

    const availableScreens = listScreenPublishers(publications)
    // Parou de transmitir: sai dos assistidos — se voltar, começa pausada de novo.
    this.watched = new Set(pruneWatched([...this.watched], availableScreens))

    const media: RemoteMedia = {
      streams: toStreams('voice'),
      screenStreams: toStreams('screen'),
      screenAudioStreams: toStreams('screenAudio'),
      videoStreams: toStreams('camera'),
      mediaPeers,
      availableScreens
    }
    this.cache.prune(inUse)
    this.handlers.onRemoteMedia(media)
  }
}
