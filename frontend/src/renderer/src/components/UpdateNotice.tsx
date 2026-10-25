import { useEffect, useState } from 'react'
import { useCallStore } from '../store/callStore'
import Button from './Button'

/**
 * "Nova atualização disponível" no canto inferior direito, assim que existe
 * versão nova (mesmo antes de baixar). Atualizar baixa (se ainda não baixou),
 * verifica a assinatura e reinicia o app.
 */
function UpdateNotice(): React.JSX.Element | null {
  const updates = window.api?.updates
  const inCall = useCallStore((s) => s.status !== 'idle')
  const callType = useCallStore((s) => s.type)
  const [version, setVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [readyVersion, setReadyVersion] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  // O download também roda sozinho em segundo plano: o progresso só aparece
  // depois que a pessoa clica em Atualizar.
  const [requested, setRequested] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!updates) return
    void updates.status().then((s) => {
      if (!s) return
      setVersion(s.version)
      if (s.ready) setReadyVersion(s.version)
    })
    const offAvailable = updates.onAvailable(setVersion)
    const offReady = updates.onReady((v) => {
      setVersion(v)
      setReadyVersion(v)
    })
    const offProgress = updates.onProgress(setProgress)
    const offError = updates.onError((message) => {
      setRequested(false)
      setError(message)
    })
    return () => {
      offAvailable()
      offReady()
      offProgress()
      offError()
    }
  }, [updates])

  // "Depois" esconde só esta versão — uma mais nova aparece de novo.
  if (!updates || !version || dismissed === version) return null

  const installing = requested
  const ready = readyVersion === version

  const install = (): void => {
    setError(null)
    setConfirming(false)
    setRequested(true)
    const call = useCallStore.getState()
    // Canal: mantém a chamada durante o download e preserva o snapshot até
    // o main gravá-lo imediatamente antes de instalar. DM não é retomada.
    if (call.type === 'channel' && call.status === 'active') {
      updates.install()
    } else {
      const wasInCall = call.status !== 'idle'
      call.endCall()
      setTimeout(() => updates.install(), wasInCall ? 250 : 0)
    }
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-[#23a55a]/40 bg-[#111318]/95 p-4 shadow-2xl backdrop-blur"
    >
      <p className="text-sm font-semibold text-white">Nova atualização disponível</p>
      <p className="mt-0.5 text-xs text-gray-400">
        {error
          ? error
          : installing
            ? ready || progress >= 100
              ? `Reiniciando para instalar a versão ${version}…`
              : `Baixando a versão ${version}… ${progress}%`
            : confirming
              ? callType === 'channel'
                ? 'A chamada será interrompida ao reiniciar. Você voltará automaticamente ao canal.'
                : 'Atualizar agora vai te tirar da chamada. A Salinha reinicia em seguida.'
              : `Versão ${version}.`}
      </p>
      {installing && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-[#23a55a]" style={{ width: `${ready ? 100 : progress}%` }} />
        </div>
      )}
      {!installing && (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => (confirming ? setConfirming(false) : setDismissed(version))}
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
      )}
    </div>
  )
}

export default UpdateNotice
