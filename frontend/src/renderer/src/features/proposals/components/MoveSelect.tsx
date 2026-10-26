import type { ProposalStatus } from '../api/proposals'
import { moveTargets, STATUS_ACTION_LABEL } from '../lib/proposals'

/** "Mover para…" do time tech: qualquer coluna, a qualquer hora. */
function MoveSelect({
  status,
  disabled,
  onMove
}: {
  status: ProposalStatus
  disabled?: boolean
  onMove: (status: ProposalStatus) => void
}): React.JSX.Element {
  return (
    <select
      aria-label="Mover proposta para"
      value=""
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value) onMove(e.target.value as ProposalStatus)
      }}
      className="glass-input cursor-pointer rounded-lg px-2 py-1 text-xs text-strong disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>
        Mover para…
      </option>
      {moveTargets(status).map((target) => (
        <option key={target} value={target} className="bg-surface">
          {STATUS_ACTION_LABEL[target]}
        </option>
      ))}
    </select>
  )
}

export default MoveSelect
