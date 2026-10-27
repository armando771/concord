import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { initialFocusTarget, trapTab } from '../../../shared/lib/focusTrap'
import { XIcon } from '../../../shared/ui/icons'
import '../../../assets/enquete.css'

interface Props {
  /** id do título dentro de `children` (aria-labelledby). */
  titleId: string
  /** Sem `onFechar` o diálogo é obrigatório: sem X, sem Esc e sem fechar por fora. */
  onFechar?: () => void
  children: React.ReactNode
}

/**
 * O diálogo da enquete: fundo escuro, Tab preso dentro e foco devolvido ao
 * fechar. Com `onFechar`, X, Esc e clicar fora fecham; sem ele, só o conteúdo
 * (ex.: confirmar a escolha) tira a pessoa daqui. O cartão ocupa a largura da
 * tela até 24 rem, de 360 px para cima.
 */
function EnqueteCamada({ titleId, onFechar, children }: Props): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Foco no item marcado com data-autofocus (o Voltar da confirmação, para Enter
  // repetido não confirmar) ou no primeiro (o X, quando existe) e, ao sair, de volta para onde estava.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    if (dialogRef.current) initialFocusTarget(dialogRef.current)?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  // Captura na janela: Esc não chega nos outros atalhos (e só fecha se puder).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onFechar?.()
        return
      }
      trapTab(e, dialogRef.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onFechar])

  return createPortal(
    <div
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden overscroll-contain bg-black/60 p-4 backdrop-blur-sm"
      style={{ top: 'var(--titlebar-height, 0px)' }}
      onClick={onFechar}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="enquete-card relative my-auto w-full max-w-sm rounded-2xl border border-subtle bg-primary p-6 text-center text-gray-200 shadow-2xl"
      >
        {onFechar && (
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute right-1 top-1 flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

export default EnqueteCamada
