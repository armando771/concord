import { useLayoutEffect } from 'react'
import { SalinhaMarkIcon } from './icons'

const HEIGHT = '32px'

/**
 * Faixa no topo da janela, na cor de fundo do tema (--bg-app, a mesma dos
 * botões nativos; ver store/themeStore.ts): arrasta a janela (duplo
 * clique maximiza) e deixa o canto direito livre para os botões nativos de
 * minimizar, maximizar e fechar, que o Electron desenha por cima.
 */
function TitleBar(): React.JSX.Element {
  // Toasts e avisos fixos no topo descem essa altura (var --titlebar-height).
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--titlebar-height', HEIGHT)
    return () => {
      document.documentElement.style.removeProperty('--titlebar-height')
    }
  }, [])

  return (
    <div
      style={{ height: HEIGHT }}
      className="app-drag flex shrink-0 items-center gap-2 bg-app pl-3 pr-[140px]"
    >
      <SalinhaMarkIcon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-semibold tracking-wide text-gray-400">Salinha</span>
    </div>
  )
}

export default TitleBar
