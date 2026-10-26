import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  title?: string
  onClose?: () => void
  /** Janela larga (editores com lista e painel lado a lado). */
  wide?: boolean
  /** Ainda mais larga (detalhe com conteúdo e conversa lado a lado). */
  xl?: boolean
  children?: ReactNode
}

function Modal({
  open,
  title,
  onClose,
  wide = false,
  xl = false,
  children
}: ModalProps): React.JSX.Element | null {
  const titleId = useId()

  if (!open) return null

  // Fora dos painéis com blur/transform, para que o viewport seja sempre a janela.
  return createPortal(
    <div
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      style={{ top: 'var(--titlebar-height, 0px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`flex max-h-full min-h-0 w-full flex-col overflow-hidden p-6 rounded-2xl border border-subtle bg-modal shadow-2xl shadow-black/70 ${
          xl ? 'max-w-5xl' : wide ? 'max-w-3xl' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          {title && (
            <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold text-strong">
              {title}
            </h2>
          )}
          {onClose && (
            <button
              type="button"
              className="app-no-drag ml-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-strong/60 transition-colors hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-violet-400"
              onClick={onClose}
              aria-label="Fechar"
            >
              ✕
            </button>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export default Modal
