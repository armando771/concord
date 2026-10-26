import { useEffect, useState } from 'react'
import { useCallStore } from '../store/callStore'
import { useConnectionStore } from '../../../shared/store/connectionStore'
import {
  callConnectionView,
  nextCallConnectionChange,
  type CallConnectionView
} from '../lib/callConnection'

/** Estado da conexão de voz para a tela; vira "lento" sozinho depois de ~10 s. */
export function useCallConnectionView(): CallConnectionView {
  const connection = useCallStore((s) => s.connection)
  const online = useConnectionStore((s) => s.online)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const current = Date.now()
    // Evento novo com a hora velha: acerta logo; senão, na próxima virada.
    const at = current - now > 100 ? current : nextCallConnectionChange(connection, current)
    if (at === null) return
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, at - current) + 20)
    return () => window.clearTimeout(id)
  }, [connection, now])

  return callConnectionView(connection, now, online)
}
