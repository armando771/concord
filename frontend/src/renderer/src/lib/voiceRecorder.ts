import { loadAudioPrefs } from './audioDevices'

export interface VoiceRecording {
  /** Para e devolve o áudio gravado. */
  stop(): Promise<Blob>
  /** Para e joga fora. */
  cancel(): void
}

/** Começa a gravar do microfone escolhido nas configurações de voz. */
export async function startVoiceRecording(): Promise<VoiceRecording> {
  const { inputId } = loadAudioPrefs()
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: inputId ? { ideal: inputId } : undefined }
  })
  const stopTracks = (): void => stream.getTracks().forEach((t) => t.stop())

  let recorder: MediaRecorder
  try {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    recorder = new MediaRecorder(stream, { mimeType })
  } catch (err) {
    stopTracks()
    throw err
  }

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start()

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        // O tipo vai no upload: "audio/..." faz o backend tratar o webm como áudio.
        const finish = (): void => {
          stopTracks()
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
        if (recorder.state === 'inactive') {
          finish()
          return
        }
        recorder.onstop = finish
        recorder.stop()
      }),
    cancel: () => {
      recorder.ondataavailable = null
      recorder.onstop = null
      if (recorder.state !== 'inactive') recorder.stop()
      stopTracks()
    }
  }
}
