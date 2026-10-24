import { useEffect, useRef } from 'react'
import { useCallStore } from '../../store/callStore'

function RemoteAudio({
  stream,
  muted
}: {
  stream: MediaStream
  muted: boolean
}): React.JSX.Element {
  const ref = useRef<HTMLAudioElement | null>(null)
  const outputDeviceId = useCallStore((s) => s.outputDeviceId)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  // Saída escolhida nas configurações ('' = padrão do sistema).
  useEffect(() => {
    const el = ref.current as
      (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null
    void el?.setSinkId?.(outputDeviceId).catch(() => {})
  }, [outputDeviceId])

  return <audio ref={ref} autoPlay muted={muted} className="hidden" />
}

export default RemoteAudio
