import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant
} from 'livekit-client'
import { RemoteSubscriptions } from './remoteSubscriptions'
import { watchVideoPause } from './screenVideoPause'
import {
  groupTracks,
  listScreenPublishers,
  StreamCache,
  type MediaKind,
  type PublicationEntry,
  type TrackEntry
} from './callMedia'
import { canPublishSource, type PublishSource } from './mediaPermissions'
import { reportLatency } from './connectionStats'
import {
  asCallQuality,
  inboundCounters,
  lossBetween,
  reportOutboundLoss,
  type CallQuality,
  type PacketCounters,
  type QualityDetails
} from './connectionQuality'
import type { ScreenShareQuality } from './screenShareQuality'
import { publishScreenTracks, updatePublishedScreenQuality } from './screenPublish'
import type { ScreenStatsInput } from './screenStats'
import {
  clearActiveScreenStats,
  readScreenStatsInput,
  setActiveScreenStats
} from './screenStatsSource'

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
  /**
   * Sala reconectando: os participantes somem por um instante sem terem saído
   * nem parado de transmitir — quem assiste não deve perder o que assistia.
   */
  reconnecting?: boolean
}

export interface CallMediaHandlers {
  onRemoteMedia: (media: RemoteMedia) => void
  /**
   * Queda que o LiveKit não conseguiu recuperar (não chamado em disconnect()).
   * `reason`: DisconnectReason do SDK, quando ele informa.
   */
  onConnectionLost: (reason?: number) => void
  /** O canal de controle com o servidor de voz abriu; falta a mídia (WebRTC). */
  onSignalConnected?: () => void
  /** Qualidade da conexão de alguém mudou (identity = userId, inclusive o próprio). */
  onConnectionQuality?: (userId: string, quality: CallQuality) => void
  onReconnecting: () => void
  onReconnected: () => void
  /** Quem está falando agora (identity = userId), incluindo o próprio usuário. */
  onActiveSpeakers: (userIds: string[]) => void
  /**
   * As permissões de publicação do próprio usuário mudaram (cargo novo, canal
   * mudou, "silenciar no servidor"). Também chamado depois de conectar.
   */
  onPublishPermissions?: (allowed: { microphone: boolean; stream: boolean }) => void
  /** Um moderador tirou o usuário da sala (Desconectar da chamada). */
  onRemovedByModerator?: () => void
}

export class CallMedia {
  private room: Room
  private cache = new StreamCache<MediaStream>((tracks) => new MediaStream(tracks))
  private closing = false
  /** Tela/câmera pedidas antes disso são publicadas por quem chamou connect(). */
  private connected = false
  /** O que baixar de cada pessoa (tela só de quem assisto; vídeo pausado fora de vista). */
  private subscriptions = new RemoteSubscriptions()
  private stopWindowWatch: () => void
  private refreshQueued = false
  /** Microfone da chamada, guardado para publicar quando a permissão de falar chegar. */
  private micTrack: MediaStreamTrack | null = null
  /** Última leitura dos pacotes recebidos de cada pessoa (perda entre leituras). */
  private inbound = new Map<string, PacketCounters>()

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
        // A qualidade de tela é definida por publicação, não pela sala.
        videoCodec: 'vp8'
      }
    })
    setActiveScreenStats(this)
    this.stopWindowWatch = watchVideoPause((pause) => {
      if (this.subscriptions.setPause(pause)) this.applySubscriptions()
    })

    // Rajadas de eventos viram uma emissão só, depois do handler do SDK. Numa
    // reconexão completa ele desmonta todos os participantes e só depois muda
    // o estado para Reconnecting — emitir no meio leria "pararam de transmitir".
    const refresh = (): void => {
      if (this.refreshQueued) return
      this.refreshQueued = true
      queueMicrotask(() => {
        this.refreshQueued = false
        if (!this.closing) this.emitRemoteMedia()
      })
    }
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
      .on(RoomEvent.ParticipantPermissionsChanged, (_prev: unknown, participant?: unknown) => {
        // Só importam as permissões do próprio usuário.
        if (participant && participant !== this.room.localParticipant) return
        this.emitPublishPermissions()
      })
      .on(RoomEvent.SignalConnected, () => {
        if (!this.closing) this.handlers.onSignalConnected?.()
      })
      .on(
        RoomEvent.ConnectionQualityChanged,
        (quality: unknown, participant?: { identity?: string }) => {
          if (this.closing || !participant?.identity) return
          this.handlers.onConnectionQuality?.(participant.identity, asCallQuality(quality))
        }
      )
      .on(RoomEvent.Reconnecting, () => this.handlers.onReconnecting())
      .on(RoomEvent.Reconnected, () => {
        // Assina de novo o que eu assistia e só então poda quem de fato parou.
        this.applySubscriptions()
        this.emitRemoteMedia()
        this.handlers.onReconnected()
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        this.handlers.onActiveSpeakers(speakers.map((p) => p.identity))
      )
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (this.closing || reason === DisconnectReason.CLIENT_INITIATED) return
        if (reason !== undefined && reason === DisconnectReason.PARTICIPANT_REMOVED) {
          this.handlers.onRemovedByModerator?.()
          return
        }
        this.handlers.onConnectionLost(reason)
      })
  }

  async connect(url: string, token: string, mic: MediaStreamTrack, muted: boolean): Promise<void> {
    // Assinatura manual: tela e som da tela só de quem estou assistindo.
    await this.room.connect(url, token, { autoSubscribe: false })
    // TrackPublished não dispara para o que já estava publicado ao entrar.
    this.applySubscriptions()
    this.micTrack = mic
    // Sem permissão de falar o microfone nem é publicado: a pessoa entra e
    // escuta. Se a permissão chegar depois, ensureMic publica.
    if (this.canPublish('microphone')) {
      await this.publishMic(mic, muted)
    }
    this.connected = true
    this.emitRemoteMedia()
    this.emitPublishPermissions()
  }

  /** RTT até o SFU pelas estatísticas públicas das tracks, inclusive em modo ouvinte. */
  async getLatency(): Promise<number | null> {
    if (this.closing || this.room.state !== ConnectionState.Connected) return null
    const publications = [
      ...this.room.localParticipant.trackPublications.values(),
      ...Array.from(this.room.remoteParticipants.values()).flatMap((participant) =>
        Array.from(participant.trackPublications.values())
      )
    ]
    for (const publication of publications) {
      if (!publication.track) continue
      try {
        const report = await publication.track.getRTCStatsReport()
        if (this.closing || this.room.state !== ConnectionState.Connected) return null
        const ms = report ? reportLatency(report) : null
        if (ms !== null) return ms
      } catch {
        // Track removida durante a consulta: tenta outra, sem interferir na chamada.
      }
    }
    return null
  }

  /**
   * Perda de pacotes e latência para o tooltip de conexão ruim. `selfId`: eu
   * (perda do que envio + latência até o servidor); os demais: perda do áudio
   * deles que chega até mim, desde a leitura anterior.
   */
  async getQualityDetails(
    userIds: string[],
    selfId: string | null
  ): Promise<Record<string, QualityDetails>> {
    const out: Record<string, QualityDetails> = {}
    if (this.closing || this.room.state !== ConnectionState.Connected) return out
    for (const userId of userIds) {
      try {
        if (userId === selfId) {
          const mic = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)
          const report = await mic?.track?.getRTCStatsReport()
          out[userId] = {
            lossPercent: report ? reportOutboundLoss(report) : null,
            latencyMs: await this.getLatency()
          }
          continue
        }
        const participant = this.room.remoteParticipants.get(userId)
        const mic = participant?.getTrackPublication(Track.Source.Microphone)
        const report = await mic?.track?.getRTCStatsReport()
        const counters = report ? inboundCounters(report) : null
        if (!counters) {
          this.inbound.delete(userId)
          out[userId] = { lossPercent: null, latencyMs: null }
          continue
        }
        const lossPercent = lossBetween(this.inbound.get(userId) ?? null, counters)
        this.inbound.set(userId, counters)
        out[userId] = { lossPercent, latencyMs: null }
      } catch {
        // Track trocada no meio da leitura: fica sem número desta vez.
      }
      if (this.closing) return {}
    }
    return out
  }

  /** getStats() do vídeo da live, para o painel de estatísticas (só com ele aberto). */
  async readScreenStats(userId: string, local: boolean): Promise<ScreenStatsInput | null> {
    if (this.closing) return null
    return readScreenStatsInput(this.room, userId, local)
  }

  /** Pode publicar essa fonte, segundo as permissões que o servidor deu. */
  canPublish(source: PublishSource): boolean {
    return canPublishSource(this.room.localParticipant.permissions, source)
  }

  private emitPublishPermissions(): void {
    this.handlers.onPublishPermissions?.({
      microphone: this.canPublish('microphone'),
      stream: this.canPublish('screen_share')
    })
  }

  private async publishMic(mic: MediaStreamTrack, muted: boolean): Promise<void> {
    const publication = await this.room.localParticipant.publishTrack(mic, {
      source: Track.Source.Microphone,
      name: 'microphone'
    })
    if (muted) await publication.mute()
  }

  /** Publica o microfone se agora pode e ainda não está publicado. */
  async ensureMic(muted: boolean): Promise<void> {
    if (!this.connected || !this.micTrack || !this.canPublish('microphone')) return
    if (this.room.localParticipant.getTrackPublication(Track.Source.Microphone)) return
    await this.publishMic(this.micTrack, muted)
  }

  async setMicMuted(muted: boolean): Promise<void> {
    const publication = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)
    if (!publication) return
    if (muted) await publication.mute()
    else await publication.unmute()
  }

  /** Troca o microfone publicado (outro dispositivo) sem sair da sala. */
  async replaceMic(track: MediaStreamTrack): Promise<void> {
    this.micTrack = track
    const publication = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)
    if (!publication?.track) return
    // userProvidedTrack: o SDK não para nem recria a track — o store é o dono.
    await publication.track.replaceTrack(track, true)
  }

  /**
   * Troca a câmera publicada (outro dispositivo ou o stream do efeito de fundo)
   * sem despublicar: SID e assinantes continuam. Sem câmera publicada não faz nada.
   */
  async replaceCamera(stream: MediaStream): Promise<void> {
    const [video] = stream.getVideoTracks()
    const publication = this.room.localParticipant.getTrackPublication(Track.Source.Camera)
    if (!video || !publication?.track) return
    // userProvidedTrack: o SDK não para a track antiga — o store é o dono.
    await publication.track.replaceTrack(video, true)
  }

  async publishScreen(stream: MediaStream): Promise<void> {
    if (!this.connected) return
    if (!this.canPublish('screen_share')) throw new Error('no_stream_permission')
    await publishScreenTracks(this.room.localParticipant, stream)
  }

  async publishCamera(stream: MediaStream): Promise<void> {
    if (!this.connected) return
    if (!this.canPublish('camera')) throw new Error('no_stream_permission')
    const [video] = stream.getVideoTracks()
    if (!video) return
    await this.room.localParticipant.publishTrack(video, {
      source: Track.Source.Camera,
      name: 'camera'
    })
  }

  /** Não despublica: preserva SID, tracks e assinaturas de quem já está assistindo. */
  updateScreenQuality(stream: MediaStream, quality: ScreenShareQuality): Promise<void> {
    return updatePublishedScreenQuality(
      this.room.localParticipant,
      stream,
      quality,
      () => this.connected && this.room.state === ConnectionState.Connected
    )
  }

  /** Despublica as tracks do stream (quem chama é dono de parar as tracks). */
  async unpublish(stream: MediaStream): Promise<void> {
    const tracks = stream.getTracks()
    if (!this.connected || tracks.length === 0) return
    await this.room.localParticipant.unpublishTracks(tracks)
  }

  /** Passa a baixar a tela (e o som dela) só dessas pessoas. */
  setWatchedScreens(userIds: string[]): void {
    this.subscriptions.setWatched(userIds)
    this.applySubscriptions()
  }

  private applySubscriptions(): void {
    this.subscriptions.apply(this.room.remoteParticipants.values())
  }

  disconnect(): void {
    this.closing = true
    clearActiveScreenStats(this)
    this.stopWindowWatch()
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
    const reconnecting = this.room.state !== ConnectionState.Connected
    // Parou de transmitir: sai dos assistidos — se voltar, começa pausada de novo.
    // Reconectando, a lista está vazia por engano: poda no Reconnected.
    if (!reconnecting) this.subscriptions.prune(availableScreens)

    const media: RemoteMedia = {
      streams: toStreams('voice'),
      screenStreams: toStreams('screen'),
      screenAudioStreams: toStreams('screenAudio'),
      videoStreams: toStreams('camera'),
      mediaPeers,
      availableScreens,
      reconnecting
    }
    this.cache.prune(inUse)
    this.handlers.onRemoteMedia(media)
  }
}
