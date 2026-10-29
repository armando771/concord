import { Track, type LocalParticipant } from 'livekit-client'
import { publishScreenTracks, updatePublishedScreenQuality } from './screenPublish'
import {
  captureSize,
  screenEncoding,
  screenSource,
  streamQuality,
  type ScreenShareQuality
} from './screenShareQuality'
import { loadScreenCodec, screenCodecOptions } from './screenCodec'
import {
  detectScreenCodecs,
  markSoftwareCodec,
  type ScreenCodecSupport
} from './screenCodecSupport'
import { loadScreenSimulcast, usesSimulcast } from './screenSimulcast'
import { ScreenAdapt } from './screenAdapt'
import { senderReports } from './screenStatsSource'
import { useScreenAdaptStore, type ScreenAdaptView } from '../store/screenAdaptStore'

// A minha live na sala: publicar (codec e camadas), trocar a qualidade ao vivo
// sem despublicar e o controlador que desce/sobe de degrau sozinho. O CallMedia
// delega para cá (o livekit.ts não cresce com a tela). Ver docs/adr/0020.

/** O que a placa de vídeo/navegador codifica no tamanho da live. */
function codecSupport(
  quality: ScreenShareQuality,
  settings: MediaTrackSettings
): Promise<ScreenCodecSupport> {
  const { width, height } = captureSize(quality.resolution, settings)
  const bitrate = screenEncoding(quality, settings).maxBitrate
  return detectScreenCodecs({ width, height, bitrate, framerate: quality.frameRate })
}

export class ScreenSender {
  private adapt: ScreenAdapt | null = null
  private stream: MediaStream | null = null
  /** Trocas de qualidade (minhas e do controlador) uma de cada vez. */
  private queue: Promise<void> = Promise.resolve()
  private view: ScreenAdaptView | null = null

  constructor(
    private readonly participant: LocalParticipant,
    /** A sala continua conectada (senão a troca é abandonada). */
    private readonly connected: () => boolean,
    private readonly onView: (view: ScreenAdaptView | null) => void = (view) =>
      useScreenAdaptStore.getState().setView(view)
  ) {}

  async publish(stream: MediaStream): Promise<void> {
    const [video] = stream.getVideoTracks()
    const quality = streamQuality(stream)
    const settings = video?.getSettings() ?? {}
    const simulcast = usesSimulcast(loadScreenSimulcast(), quality, settings)
    const support = await codecSupport(quality, settings)
    const codec = screenCodecOptions(loadScreenCodec(), support, simulcast)
    await publishScreenTracks(this.participant, stream, { codec, simulcast })
    if (video) this.watch(stream, quality, screenSource(video), simulcast)
  }

  /** Não despublica: preserva SID, tracks e assinaturas de quem já está assistindo. */
  update(stream: MediaStream, quality: ScreenShareQuality): Promise<void> {
    return this.enqueue(async () => {
      await updatePublishedScreenQuality(this.participant, stream, quality, this.connected)
      if (this.stream === stream) this.adapt?.choose(quality)
    })
  }

  /** Qualidade saindo agora (painel de estatísticas). */
  current(): ScreenAdaptView | null {
    return this.view
  }

  /** Parou de transmitir (sem stream: qualquer uma). */
  stop(stream?: MediaStream): void {
    if (stream && stream !== this.stream) return
    this.adapt?.stop()
    this.adapt = null
    this.stream = null
    this.report(null)
  }

  private report(view: ScreenAdaptView | null): void {
    this.view = view
    this.onView(view)
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task, task)
    this.queue = run.catch(() => {})
    return run
  }

  private watch(
    stream: MediaStream,
    quality: ScreenShareQuality,
    source: MediaTrackSettings,
    simulcast: boolean
  ): void {
    this.adapt?.stop()
    this.stream = stream
    this.adapt = new ScreenAdapt(
      {
        read: () => this.readSender(stream),
        apply: (step) =>
          this.enqueue(() =>
            updatePublishedScreenQuality(
              this.participant,
              stream,
              step,
              this.connected,
              this.adapt?.chosenQuality().frameRate
            )
          ),
        report: (view) => this.report(view),
        softwareCodec: markSoftwareCodec
      },
      quality,
      source,
      simulcast
    )
    this.adapt.start()
  }

  private async readSender(stream: MediaStream): Promise<RTCStatsReport | null> {
    const track = this.participant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack
    if (!track || track.mediaStreamTrack !== stream.getVideoTracks()[0]) return null
    return senderReports(track)
  }
}
