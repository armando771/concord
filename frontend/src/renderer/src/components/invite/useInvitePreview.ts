import { useEffect, useState } from 'react'
import { getInvitePreview, type InvitePreview } from '../../api/invites'
import { inviteErrorMessage } from '../../lib/invitePreview'

export type InvitePreviewState =
  | { status: 'loading' }
  | { status: 'ready'; preview: InvitePreview }
  | { status: 'error'; message: string }

type Loaded = Exclude<InvitePreviewState, { status: 'loading' }> & { code: string }

/**
 * Prévia do código (nome, ícone, membros, online). signedIn: manda o token e
 * recebe também o id do servidor e se já é membro (modal dentro do app).
 */
export function useInvitePreview(code: string, signedIn = false): InvitePreviewState {
  // Guarda de qual código é o resultado: trocou o código, volta a "carregando".
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    getInvitePreview(code, signedIn)
      .then((preview) => !cancelled && setLoaded({ code, status: 'ready', preview }))
      .catch((err: unknown) => {
        if (!cancelled) setLoaded({ code, status: 'error', message: inviteErrorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [code, signedIn])

  return loaded && loaded.code === code ? loaded : { status: 'loading' }
}
