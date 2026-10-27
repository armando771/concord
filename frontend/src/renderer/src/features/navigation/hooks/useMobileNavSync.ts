import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { useMobileNavStore } from '../store/mobileNavStore'

/**
 * Leva cada troca de rota ao store da navegação do celular (qual coluna fica
 * na frente). Montado uma vez, na casca do app.
 */
export function useMobileNavSync(): void {
  const location = useLocation()
  const action = useNavigationType()
  const last = useRef({ key: location.key, path: location.pathname })

  useEffect(() => {
    // A mesma entrada do histórico (1º render, re-render) não é navegação.
    if (last.current.key === location.key) return
    useMobileNavStore
      .getState()
      .navigated({ prev: last.current.path, next: location.pathname, action })
    last.current = { key: location.key, path: location.pathname }
  }, [location.key, location.pathname, action])
}
