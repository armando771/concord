import { useEffect, useRef } from 'react'
import { useCallStore } from '../../store/callStore'
import { outputVolume, useUserAudioStore } from '../../store/userAudioStore'

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
  const outputDeviceId = useCallStore((s) => s.outputDeviceId)
  const volume = useUserAudioStore((s) => (userId ? outputVolume(s.get(userId)) : 1))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    if (ref.current) ref.current.volume = Math.max(0, Math.min(1, volume * gain))
  }, [volume, gain])

  // Saída escolhida nas configurações ('' = padrão do sistema).
  useEffect(() => {
    const el = ref.current as
      (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null
    void el?.setSinkId?.(outputDeviceId).catch(() => {})
  }, [outputDeviceId])

  return <audio ref={ref} autoPlay muted={muted} data-audio={userId} className="hidden" />
}

export default RemoteAudio
