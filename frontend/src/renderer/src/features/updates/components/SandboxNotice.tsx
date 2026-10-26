import { useEffect, useState } from 'react'
import Button from '../../../shared/ui/Button'

/** Página com os dois jeitos de religar a proteção (perfil do AppArmor ou user namespaces). */
export const SANDBOX_HELP_URL = 'https://salinha.bhrx.com.br/#sandbox'

/**
 * Linux: o lançador abriu o app sem o sandbox do Chromium (o sistema não deixa
 * sem root). Aviso pequeno, uma vez só — o main guarda que já mostrou.
 */
function SandboxNotice(): React.JSX.Element | null {
  const [reason, setReason] = useState<string | null>(null)

  useEffect(() => {
    void window.api?.updates
      ?.sandboxNotice?.()
      .then(setReason)
      .catch(() => {})
  }, [])

  if (!reason) return null
  return (
    <div
      role="status"
      className="pointer-events-auto w-full rounded-xl border border-warning/40 bg-floating p-4 shadow-2xl backdrop-blur"
    >
      <p className="text-sm text-strong">
        Proteção do navegador (sandbox) desativada neste sistema —{' '}
        <a
          href={SANDBOX_HELP_URL}
          target="_blank"
          rel="noreferrer"
          className="text-warning underline"
        >
          veja como ativar
        </a>
      </p>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={() => setReason(null)}>
          Ok
        </Button>
      </div>
    </div>
  )
}

export default SandboxNotice
