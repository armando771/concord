import { useEffect } from 'react'
import Button from '../../../shared/ui/Button'
import Modal from '../../../shared/ui/Modal'
import { useReactionLimitStore } from '../store/reactionLimitStore'

/**
 * A mensagem já tem 20 reações diferentes (o limite do Discord): a nova não
 * foi enviada. Fecha no "Ok", no Esc ou clicando fora.
 */
function ReactionLimitModal(): React.JSX.Element | null {
  const open = useReactionLimitStore((s) => s.open)
  const close = useReactionLimitStore((s) => s.close)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <Modal open={open} title="Calma lá, empolgação!" onClose={close}>
      <div className="flex flex-col gap-4">
        <p className="text-ds-sm text-gray-300">
          Sua reação não foi adicionada porque esta mensagem já tem reações demais.
        </p>
        <div className="flex justify-end">
          <Button autoFocus onClick={close} className="w-full sm:w-auto sm:min-w-24">
            Ok
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ReactionLimitModal
