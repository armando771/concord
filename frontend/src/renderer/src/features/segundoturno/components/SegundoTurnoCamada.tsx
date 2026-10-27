import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { trapTab } from '../../../shared/lib/focusTrap'
import { XIcon } from '../../../shared/ui/icons'
import '../../../assets/segundoTurno.css'

interface Props {
  /** id do título dentro de `children` (aria-labelledby). */
  titleId: string
  onFechar: () => void
  children: React.ReactNode
}

/**
 * O diálogo do segundo turno: fundo escuro (clicar fora fecha), Esc fecha, o
 * Tab fica preso dentro e o foco volta para onde estava ao fechar. O cartão
 * ocupa a largura da tela até 24 rem, de 360 px para cima.
 */
function SegundoTurnoCamada({ titleId, onFechar, children }: Props): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  // Captura na janela: Esc fecha só este diálogo e o Tab não escapa dele.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onFechar()
        return
      }
      trapTab(e, dialogRef.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onFechar])

  return createPortal(
    <div
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 backdrop-blur-sm"
      style={{ top: 'var(--titlebar-height, 0px)' }}
      onClick={onFechar}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="segundo-turno-card relative my-auto w-full max-w-sm rounded-2xl border border-subtle bg-primary p-6 text-center text-gray-200 shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors touch-manipulation hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          <XIcon className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

export default SegundoTurnoCamada
