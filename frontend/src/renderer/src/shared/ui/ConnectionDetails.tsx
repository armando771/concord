import { useState } from 'react'
import { WS_URL } from '../lib/config'
import { copyText } from '../lib/clipboard'
import { detailsText } from '../lib/connectionReport'
import { hasServerDiagnostics } from '../api/serverDiagnostics'
import { useServerDiagnostics } from '../hooks/useServerDiagnostics'
import { useConnectionStore } from '../store/connectionStore'

const LINK =
  'shrink-0 cursor-pointer rounded font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-default disabled:opacity-60'

export function DetailsPanel(): React.JSX.Element {
  const online = useConnectionStore((s) => s.online)
  const { diag, testing, retest } = useServerDiagnostics()
  const text = detailsText(diag, testing, { wsUrl: WS_URL, online, now: new Date() })

  return (
    <div className="w-full basis-full rounded-lg border border-white/10 bg-black/20 p-3 text-left">
      <p className="text-xs text-gray-400">
        Copie e mande para quem cuida da Salinha: mostra onde a conexão para.
      </p>
      <pre
        data-testid="connection-details"
        className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-normal"
      >
        {text}
      </pre>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <button type="button" onClick={retest} disabled={testing} className={`${LINK} text-brand`}>
          {testing ? 'Testando…' : 'Testar de novo'}
        </button>
        <button type="button" onClick={() => copyText(text)} className={`${LINK} text-brand`}>
          Copiar
        </button>
      </div>
    </div>
  )
}

/**
 * "Detalhes" da falta de conexão (só no app desktop): versão, endereço do
 * servidor e o erro real do teste de rede, para copiar. Num container
 * `flex-wrap`, o painel abre numa linha própria embaixo.
 */
function ConnectionDetails({ className = '' }: { className?: string }): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (!hasServerDiagnostics()) return null
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${LINK} ${className}`}
      >
        {open ? 'Ocultar detalhes' : 'Detalhes'}
      </button>
      {open && <DetailsPanel />}
    </>
  )
}

export default ConnectionDetails
