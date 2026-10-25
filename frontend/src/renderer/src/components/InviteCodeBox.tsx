import { useEffect, useState } from 'react'
import { getInviteCode } from '../api/servers'
import { showToast } from '../store/toastStore'
import { inviteLink } from '../lib/inviteLink'
import Button from './Button'

/** Link de convite do servidor para mandar aos amigos (entram sozinhos com ele). */
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

  const link = code ? inviteLink(code) : null

  const copy = (): void => {
    if (!link) return
    void navigator.clipboard
      .writeText(link)
      .then(() => showToast.success('Link copiado!'))
      .catch(() => showToast.error('Não foi possível copiar.'))
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Link de convite</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Link de convite"
          value={link ?? ''}
          placeholder="Gerando link…"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        <Button variant="success" onClick={copy} disabled={!link}>
          Copiar
        </Button>
      </div>
      <p className="text-xs text-gray-400">
        Mande para seus amigos: o link abre no navegador ou no app. Também dá para colar o link (ou
        o código <code className="font-mono text-gray-300">{code ?? '········'}</code>) em{' '}
        <strong>+</strong> → <strong>Entrar com código</strong>.
      </p>
    </div>
  )
}

export default InviteCodeBox
