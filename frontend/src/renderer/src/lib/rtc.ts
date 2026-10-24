// Captura de mídia local. O transporte (envio/recebimento) fica no LiveKit —
// ver lib/livekit.ts.

import { createProcessedAudioStream } from './audio'
import { pickerError, resetPickerCancel } from './screenPickerCancel'

/** Microfone local. `deviceId` vazio = padrão do sistema. */
export async function getAudioStream(deviceId = ''): Promise<MediaStream> {
  const rawStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: false, // desativado para usar RNNoise próprio
      autoGainControl: true
    },
    video: false
  })

  try {
    return await createProcessedAudioStream(rawStream)
  } catch {
    return rawStream
  }
}

/** Stream de áudio bruto (sem processamento RNNoise) */
export async function getRawAudioStream(deviceId = ''): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  })
}

// Captura de tela com o som do que está sendo compartilhado. O picker visual é
// o modal do app — o Electron resolve a fonte escolhida via
// setDisplayMediaRequestHandler no processo main. `restrictOwnAudio` tira o
// áudio do próprio Concord (vozes da chamada) do loopback, evitando eco para
// quem assiste. Rejeita com NotAllowedError quando o usuário cancela.
export async function getDisplayStream(): Promise<MediaStream> {
  resetPickerCancel()
  const stream = await navigator.mediaDevices
    .getDisplayMedia({
      video: { frameRate: 30 },
      audio: {
        restrictOwnAudio: true,
        suppressLocalAudioPlayback: false,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } as MediaTrackConstraints
    })
    .catch((err: unknown) => {
      throw pickerError(err)
    })
  stream.getVideoTracks().forEach((track) => {
    track.contentHint = 'detail'
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
