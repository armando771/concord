import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IS_WEB } from '../../../shared/lib/config'
import { guestTokenFromClick } from '../lib/guestLink'

/**
 * Link de visitante nosso clicado dentro do app (chat, DM...): abre a tela do
 * visitante aqui mesmo, com a conta logada, em vez do navegador de fora.
 */
export function useGuestLinkClicks(): void {
  const navigate = useNavigate()
  useEffect(() => {
    const origins = [IS_WEB ? location.origin : import.meta.env.VITE_SERVER_URL]
    const onClick = (e: MouseEvent): void => {
      const anchor = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]')
      const href = anchor?.href ?? null
      const token = guestTokenFromClick(
        {
          href,
          button: e.button,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          defaultPrevented: e.defaultPrevented
        },
        origins
      )
      if (!token) return
      e.preventDefault()
      navigate(`/visitante/${token}`)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate])
}
