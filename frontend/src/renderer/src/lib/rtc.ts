// Captura de mídia local. O transporte (envio/recebimento) fica no LiveKit —
// ver lib/livekit.ts.

import { openMicrophone, type MicHandle } from './noiseSuppression'
import { pickerError, resetPickerCancel } from './screenPickerCancel'
import { displayMediaOptions, retryWithoutAudio } from './displayMedia'
import { IS_WEB } from './config'
import { requestScreenQuality } from '../store/screenQualityStore'
import {
  loadScreenQuality,
  rememberScreenSource,
  rememberStreamQuality,
  screenVideoConstraints
} from './screenShareQuality'

/** Microfone local (com RNNoise). `deviceId` vazio = padrão do sistema. */
export function getAudioStream(deviceId = ''): Promise<MicHandle> {
  return openMicrophone(deviceId)
}

// Captura de tela com o som do que está sendo compartilhado. No desktop o
// picker visual é o modal do app — o Electron resolve a fonte escolhida via
// setDisplayMediaRequestHandler no processo main. No navegador, o seletor é o
// do próprio navegador (ver lib/displayMedia.ts). Rejeita com NotAllowedError
// quando o usuário cancela.
export async function getDisplayStream(): Promise<MediaStream> {
  resetPickerCancel()
  // Web: confirmar o modal precede o seletor nativo. Desktop: a qualidade é
  // escolhida no picker que atende ao pedido já pendente do Electron.
  const requestedQuality = IS_WEB ? await requestScreenQuality() : null
  const capture = (audio: boolean): Promise<MediaStream> =>
    navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions(IS_WEB, {
        audio,
        frameRate: requestedQuality?.frameRate ?? 60
      })
    )
  const stream = await capture(true)
    .catch((err: unknown) => {
      // Navegador sem captura de som de tela: compartilha só o vídeo.
      if (IS_WEB && retryWithoutAudio(err)) return capture(false)
      throw err
    })
    .catch((err: unknown) => {
      throw pickerError(err)
    })
  const quality = requestedQuality ?? loadScreenQuality()
  stream.getVideoTracks().forEach(rememberScreenSource)
  try {
    await Promise.all(
      stream
        .getVideoTracks()
        .map((track) =>
          track.applyConstraints(screenVideoConstraints(quality, track.getSettings()))
        )
    )
  } catch (err) {
    stream.getTracks().forEach((track) => track.stop())
    window.api?.screenShare?.ended()
    throw err
  }
  rememberStreamQuality(stream, quality)
  stream.getVideoTracks().forEach((track) => {
    track.contentHint = 'detail'
    track.addEventListener('ended', () => window.api?.screenShare?.ended())
  })
  stream.getAudioTracks().forEach((track) => {
    track.contentHint = 'music'
  })
  return stream
}

// Câmera local. Só vídeo — o microfone já vem de getAudioStream().
export async function getCameraStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: false
  })
  stream.getVideoTracks().forEach((track) => {
    track.contentHint = 'motion'
  })
  return stream
}
