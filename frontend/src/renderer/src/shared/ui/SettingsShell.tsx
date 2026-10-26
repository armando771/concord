import { createPortal } from 'react-dom'
import { XIcon } from './icons'

const NAV_BG = 'var(--bg-secondary)'
const CONTENT_BG = 'var(--bg-primary)'

interface SettingsShellProps {
  /** Rótulo do diálogo para leitor de tela. */
  ariaLabel: string
  /** O que fica na coluna da esquerda (perfil, busca, lista de seções). */
  nav: React.ReactNode
  title: string
  titleClassName: string
  /** Largura máxima da coluna do conteúdo (ex.: `max-w-[740px]`). */
  contentClassName: string
  closeLabel: string
  onClose: () => void
  /** Irmãos do conteúdo dentro do diálogo (ex.: confirmações). */
  overlay?: React.ReactNode
  children: React.ReactNode
}

/**
 * Casco das telas de configuração em tela cheia (usuário e servidor):
 * navegação à esquerda, seção à direita e o ✕ com ESC.
 */
function SettingsShell({
  ariaLabel,
  nav,
  title,
  titleClassName,
  contentClassName,
  closeLabel,
  onClose,
  overlay,
  children
}: SettingsShellProps): React.JSX.Element {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex text-gray-200"
      style={{ top: 'var(--titlebar-height, 0px)', background: CONTENT_BG }}
    >
      <aside
        className="flex w-[260px] shrink-0 flex-col border-r border-subtle"
        style={{ background: NAV_BG }}
      >
        {nav}
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <div className={`mx-auto w-full px-10 pb-28 pt-14 ${contentClassName}`}>
          <h1 className={`mb-6 ${titleClassName}`}>{title}</h1>
          {children}
        </div>
        <div
          className="fixed right-8 flex flex-col items-center gap-1"
          style={{ top: 'calc(var(--titlebar-height, 0px) + 56px)' }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-gray-500 text-gray-400 transition-colors hover:border-[var(--text-strong)] hover:text-strong"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-bold text-gray-500">ESC</span>
        </div>
      </main>

      {overlay}
    </div>,
    document.body
  )
}

export default SettingsShell
