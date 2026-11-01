import { useCallback, useEffect, useState } from 'react'
import { loadServerDiagnostics } from '../api/serverDiagnostics'
import type { ServerDiagnostics } from '../../../../shared/serverConnection'

interface ServerDiagnosticsState {
  diag: ServerDiagnostics | null
  testing: boolean
  /** "Testar de novo": refaz o teste de rede agora. */
  retest: () => void
}

/** Teste de rede do app: o da abertura ao montar; um novo no retest. */
export function useServerDiagnostics(): ServerDiagnosticsState {
  const [diag, setDiag] = useState<ServerDiagnostics | null>(null)
  const [testing, setTesting] = useState(true)

  const finish = useCallback((retest: boolean) => {
    loadServerDiagnostics(retest)
      .then(setDiag, () => setDiag(null))
      .finally(() => setTesting(false))
  }, [])

  useEffect(() => finish(false), [finish])

  const retest = useCallback(() => {
    setTesting(true)
    finish(true)
  }, [finish])

  return { diag, testing, retest }
}
