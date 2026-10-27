import type { ReactNode } from 'react'
import Button from '../../../../../shared/ui/Button'
import Modal from '../../../../../shared/ui/Modal'

/**
 * Esqueleto dos modais de edição do cartão, como no Discord: os controles à
 * esquerda e a prévia ao vivo à direita (no celular a prévia vai para cima).
 * Enter ou "Aplicar" confirmam; "Cancelar", Esc e o fundo descartam.
 */
export default function EditModalShell({
  title,
  size = 'wide',
  onClose,
  onApply,
  canApply,
  busy = false,
  applyLabel = 'Aplicar',
  extraAction,
  preview,
  children
}: {
  title: string
  size?: 'wide' | 'xl'
  onClose: () => void
  onApply: () => void
  canApply: boolean
  /** Salvando no servidor: trava os botões e o fechar. */
  busy?: boolean
  applyLabel?: string
  /** Ação extra à esquerda dos botões (ex.: "Surpreenda-me"). */
  extraAction?: ReactNode
  preview: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <Modal open title={title} onClose={busy ? undefined : onClose} wide xl={size === 'xl'}>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (canApply && !busy) onApply()
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">{children}</div>
          <aside
            aria-label="Prévia"
            className="order-1 mx-auto flex w-full min-w-0 max-w-[300px] flex-col gap-3 lg:sticky lg:top-0 lg:order-2"
          >
            {preview}
          </aside>
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 bg-modal pt-3">
          {extraAction && <div className="mr-auto">{extraAction}</div>}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="min-h-10">
            Cancelar
          </Button>
          <Button type="submit" disabled={!canApply || busy} className="min-h-10">
            {busy ? 'Salvando…' : applyLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
