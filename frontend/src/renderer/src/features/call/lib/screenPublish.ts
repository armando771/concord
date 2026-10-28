import { AudioPresets, Track, type LocalParticipant, type LocalVideoTrack } from 'livekit-client'
import { canEncodeH264, loadScreenCodec, screenCodecOptions } from './screenCodec'
import {
  screenEncoding,
  screenMotion,
  screenSource,
  screenVideoConstraints,
  streamQuality,
  type ScreenShareQuality
} from './screenShareQuality'

// Publicação da tela (vídeo + som) e troca de qualidade ao vivo, sem
// despublicar. Quem decide se a sala está conectada é o CallMedia (`connected`).

type ScreenEncoding = ReturnType<typeof screenEncoding>

export async function publishScreenTracks(
  participant: LocalParticipant,
  stream: MediaStream
): Promise<void> {
  const [video] = stream.getVideoTracks()
  if (video) {
    const quality = streamQuality(stream)
    await participant.publishTrack(video, {
      source: Track.Source.ScreenShare,
      name: 'screen',
      simulcast: false,
      screenShareEncoding: screenEncoding(quality, video.getSettings()),
      // Codec por publicação: só a tela; a câmera segue o padrão da sala (VP8).
      ...screenCodecOptions(loadScreenCodec(), canEncodeH264()),
      degradationPreference: screenMotion(quality.frameRate).degradationPreference
    })
  }
  const [audio] = stream.getAudioTracks()
  if (audio) {
    await participant.publishTrack(audio, {
      source: Track.Source.ScreenShareAudio,
      name: 'screen-audio',
      audioPreset: AudioPresets.musicHighQualityStereo,
      forceStereo: true,
      dtx: false,
      red: false
    })
  }
}

/** A tela publicada e o que a troca de qualidade precisa dela. */
function publishedScreen(participant: LocalParticipant, stream: MediaStream) {
  const publication = participant.getTrackPublication(Track.Source.ScreenShare)
  const track = publication?.videoTrack
  const video = stream.getVideoTracks()[0]
  const sender = track?.sender
  if (!publication || !track || !video || !sender || track.mediaStreamTrack !== video) return null
  return { publication, track, video, sender }
}

async function setSenderEncoding(sender: RTCRtpSender, encoding: RTCRtpEncodingParameters) {
  const parameters = sender.getParameters()
  Object.assign(parameters.encodings[0], encoding)
  await sender.setParameters(parameters)
}

/**
 * Não despublica: preserva SID, tracks e assinaturas de quem já está assistindo.
 * `connected`: a sala continua conectada (senão a troca é abandonada).
 */
export async function updatePublishedScreenQuality(
  participant: LocalParticipant,
  stream: MediaStream,
  quality: ScreenShareQuality,
  connected: () => boolean
): Promise<void> {
  const screen = publishedScreen(participant, stream)
  const current = (): boolean =>
    connected() &&
    screen?.video.readyState === 'live' &&
    participant.getTrackPublication(Track.Source.ScreenShare) === screen.publication &&
    screen.track.sender === screen.sender
  if (!screen || !current()) throw new Error('screen_not_available')
  const { publication, track, video, sender } = screen
  const previous = video.getConstraints()
  const oldParameters = sender.getParameters()
  if (oldParameters.encodings.length !== 1) throw new Error('unsupported_screen_encodings')
  const oldEncoding = { ...oldParameters.encodings[0] }
  const encoding: ScreenEncoding = screenEncoding(quality, screenSource(video))
  let encodingApplied = false
  try {
    // applyConstraints substitui as restrições anteriores; Fonte remove width/height.
    await video.applyConstraints(screenVideoConstraints(quality, screenSource(video)))
    if (!current()) throw new Error('screen_changed')
    await setSenderEncoding(sender, encoding)
    encodingApplied = true
    if (!current()) throw new Error('screen_changed')
    // Reconexões internas do SDK também precisam conhecer o novo orçamento.
    track.publishOptions = { ...track.publishOptions, screenShareEncoding: encoding }
    publication.options = { ...publication.options, screenShareEncoding: encoding }
  } catch (error) {
    // Nunca encerra a transmissão caso o browser recuse a alteração.
    if (video.readyState === 'live') await video.applyConstraints(previous).catch(() => {})
    if (encodingApplied && current()) {
      const parameters = sender.getParameters()
      parameters.encodings[0] = { ...oldEncoding }
      await sender.setParameters(parameters).catch(() => {})
    }
    throw error
  }
  await applyScreenMotion(video, track, quality)
}

/** Dica de conteúdo e degradação seguem o fps: jogo (60) fluido, texto (30) nítido. */
async function applyScreenMotion(
  video: MediaStreamTrack,
  track: LocalVideoTrack,
  quality: ScreenShareQuality
): Promise<void> {
  const { contentHint, degradationPreference } = screenMotion(quality.frameRate)
  video.contentHint = contentHint
  track.publishOptions = { ...track.publishOptions, degradationPreference }
  // Recusar a preferência não derruba a troca já aplicada.
  await track.setDegradationPreference(degradationPreference).catch(() => {})
}
