// Captura de mídia local. O transporte (envio/recebimento) fica no LiveKit —
// ver lib/livekit.ts.

import { openMicrophone, type MicHandle } from './noiseSuppression'
import { pickerError, resetPickerCancel } from './screenPickerCancel'
import { displayMediaOptions, retryWithoutAudio } from './displayMedia'
import { IS_WEB } from './config'

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
  const capture = (audio: boolean): Promise<MediaStream> =>
    navigator.mediaDevices.getDisplayMedia(displayMediaOptions(IS_WEB, { audio }))
  const stream = await capture(true)
    .catch((err: unknown) => {
      // Navegador sem captura de som de tela: compartilha só o vídeo.
      if (IS_WEB && retryWithoutAudio(err)) return capture(false)
      throw err
    })
    .catch((err: unknown) => {
      throw pickerError(err)
    })
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
