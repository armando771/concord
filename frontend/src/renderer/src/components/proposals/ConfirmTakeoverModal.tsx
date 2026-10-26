import type { Proposal, ProposalStatus } from '../../api/proposals'
import { STATUS_ACTION_LABEL } from '../../lib/proposals'
import Avatar from '../Avatar'
import Button from '../Button'
import Modal from '../Modal'

/**
 * O card está com outro dev: mover (arrastando ou pelo menu) passa a tarefa
 * para quem moveu. Antes, o time tech confirma que quer tirar dele.
 */
function ConfirmTakeoverModal({
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
  const assignee = proposal.assignee
  return (
    <Modal open title="Tirar a tarefa do colega?" onClose={onCancel}>
      <div className="flex flex-col gap-4">
        {assignee && (
          <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
            <Avatar
              userId={assignee.id}
              name={assignee.name}
              avatarUrl={assignee.avatar_url}
              size={28}
            />
            <span className="text-sm text-gray-200">
              Está com <span className="font-semibold text-white">{assignee.name}</span>
            </span>
          </div>
        )}
        <p className="text-sm text-gray-300">
          Mover <span className="font-semibold text-white">“{proposal.title}”</span> para{' '}
          <span className="font-semibold text-white">{STATUS_ACTION_LABEL[target]}</span> passa a
          tarefa para você.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button autoFocus onClick={onConfirm}>
            Mover e assumir
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmTakeoverModal
