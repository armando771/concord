import { useState, type ReactNode } from 'react'
import Modal from '../Modal'
import Button from '../Button'

interface ConfirmModalProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  /** Vermelho para ações que desfazem algo (remover, bloquear, sair). */
  danger?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

/** Confirmação no estilo do Discord ("Remover 'Fulano'"). */
function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  danger = true,
  onConfirm,
  onClose
}: ConfirmModalProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  const confirm = async (): Promise<void> => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onClose}>
      <div className="text-sm leading-relaxed text-gray-300">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={confirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export default ConfirmModal
