import type { Proposal, ProposalStatus } from '../api/proposals'
import { STATUS_ACTION_LABEL } from '../lib/proposals'
import Button from '../../../shared/ui/Button'
import Modal from '../../../shared/ui/Modal'

/**
 * Tirar um card de "Em votação" encerra a votação agora e não dá para reabri-la:
 * antes de mover (arrastando ou pelo menu), o time tech confirma com o placar.
 */
function ConfirmCloseModal({
  proposal,
  target,
  onConfirm,
  onCancel
}: {
  proposal: Proposal
  target: ProposalStatus
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <Modal open title="Encerrar a votação?" onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-300">
          Mover <span className="font-semibold text-strong">“{proposal.title}”</span> para{' '}
          <span className="font-semibold text-strong">{STATUS_ACTION_LABEL[target]}</span> encerra a
          votação agora, com <span className="text-discord-green">{proposal.yes_votes} sim</span> e{' '}
          <span className="text-discord-dnd">{proposal.no_votes} não</span>. Não dá para reabri-la.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button autoFocus onClick={onConfirm}>
            Encerrar e mover
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmCloseModal
