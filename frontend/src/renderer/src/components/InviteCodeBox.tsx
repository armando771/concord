import { useEffect, useState } from 'react'
import { getInviteCode } from '../api/servers'
import { showToast } from '../store/toastStore'
import Button from './Button'

/** Código do servidor para mandar aos amigos (entram sozinhos com ele). */
function InviteCodeBox({ serverId }: { serverId: string }): React.JSX.Element {
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getInviteCode(serverId)
      .then(({ code }) => !cancelled && setCode(code))
      .catch(() => !cancelled && setCode(null))
    return () => {
      cancelled = true
    }
  }, [serverId])

  const copy = (): void => {
    if (!code) return
    void navigator.clipboard
      .writeText(code)
      .then(() => showToast.success('Código copiado!'))
      .catch(() => showToast.error('Não foi possível copiar.'))
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Código do servidor</p>
      <div className="flex items-center gap-2">
        <code
          aria-label="Código de convite"
          className="flex-1 rounded-lg bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-white"
        >
          {code ?? '········'}
        </code>
        <Button variant="success" onClick={copy} disabled={!code}>
          Copiar
        </Button>
      </div>
      <p className="text-xs text-gray-400">
        Mande para seus amigos. Na Salinha, eles clicam em <strong>+</strong> →{' '}
        <strong>Entrar com código</strong> — não precisa ser amigo nem aceitar convite.
      </p>
    </div>
  )
}

export default InviteCodeBox
