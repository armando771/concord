import { useEffect, useState } from 'react'
import { useCallStore } from '../store/callStore'
import Button from './Button'

/**
 * "Nova atualização disponível" no canto inferior direito, quando uma versão
 * nova terminou de baixar (e passou na verificação da assinatura).
 */
function UpdateNotice(): React.JSX.Element | null {
  const updates = window.api?.updates
  const inCall = useCallStore((s) => s.status !== 'idle')
  const [version, setVersion] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!updates) return
    void updates.status().then((v) => v && setVersion(v))
    return updates.onReady((v) => {
      setVersion(v)
      setDismissed(false)
    })
  }, [updates])

  if (!updates || !version || dismissed) return null

  const install = (): void => {
    // Sai da chamada antes (avisa os outros) — o app reinicia para instalar.
    const inCall = useCallStore.getState().status !== 'idle'
    useCallStore.getState().endCall()
    // pausa curta para o "saí da chamada" sair pelo WebSocket
    setTimeout(() => updates.install(), inCall ? 250 : 0)
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-[#23a55a]/40 bg-[#111318]/95 p-4 shadow-2xl backdrop-blur"
    >
      <p className="text-sm font-semibold text-white">Nova atualização disponível</p>
      <p className="mt-0.5 text-xs text-gray-400">
        {confirming
          ? 'Atualizar agora vai te tirar da chamada. O Concord reinicia em seguida.'
          : `Versão ${version} pronta para instalar.`}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => (confirming ? setConfirming(false) : setDismissed(true))}
        >
          Depois
        </Button>
        <Button
          variant="success"
          onClick={() => (inCall && !confirming ? setConfirming(true) : install())}
        >
          {confirming ? 'Atualizar mesmo assim' : 'Atualizar'}
        </Button>
      </div>
    </div>
  )
}

export default UpdateNotice
