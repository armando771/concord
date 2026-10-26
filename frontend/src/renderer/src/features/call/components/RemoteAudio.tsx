import { useEffect, useRef } from 'react'
import { outputVolume, useUserAudioStore } from '../store/userAudioStore'
import { routeStreamToOutput, type VoiceRoute } from '../lib/voiceOutput'

function RemoteAudio({
  stream,
  muted,
  userId,
  gain = 1
}: {
  stream: MediaStream
  muted: boolean
  /** Voz de alguém: aplica o volume/silenciar escolhido para essa pessoa. */
  userId?: string
  /** Multiplicador do volume (ex.: música que abaixa quando alguém fala). */
  gain?: number
}): React.JSX.Element {
  const ref = useRef<HTMLAudioElement | null>(null)
  const routeRef = useRef<VoiceRoute | null>(null)
  const volume = useUserAudioStore((s) => (userId ? outputVolume(s.get(userId)) : 1))
  // Ensurdecido = volume 0 (a saída geral aplica o volume de saída por cima).
  const level = muted ? 0 : volume * gain
  const levelRef = useRef(level)

  useEffect(() => {
    levelRef.current = level
    routeRef.current?.setVolume(level)
  }, [level])

  // O <audio> fica mudo e só segura o fluxo; o som sai pelo Web Audio (voiceOutput).
  useEffect(() => {
    const el = ref.current
    if (el) {
      el.srcObject = stream
      void el.play().catch(() => {})
    }
    const route = routeStreamToOutput(stream, levelRef.current)
    routeRef.current = route
    return () => {
      route.stop()
      routeRef.current = null
    }
  }, [stream])

  return <audio ref={ref} autoPlay muted data-audio={userId} className="hidden" />
}

export default RemoteAudio
