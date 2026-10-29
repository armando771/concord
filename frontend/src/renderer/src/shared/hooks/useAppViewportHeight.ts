import { useEffect } from 'react'
import { appViewportHeight } from '../lib/appViewport'

/**
 * Mantém --app-height no <html> com a área visível quando o teclado virtual
 * cobre parte da tela (iOS). Ver lib/appViewport.
 */
export function useAppViewportHeight(): void {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = (): void => {
      const h = appViewportHeight({
        visualHeight: vv.height,
        scale: vv.scale,
        innerHeight: window.innerHeight
      })
      if (h === null) root.style.removeProperty('--app-height')
      else root.style.setProperty('--app-height', `${h}px`)
    }
    update()
    vv.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      root.style.removeProperty('--app-height')
    }
  }, [])
}
