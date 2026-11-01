import Button from '../../../../../shared/ui/Button'
import Modal from '../../../../../shared/ui/Modal'
import StatusIcon from '../../../../../shared/ui/StatusIcon'
import {
  CHOSEN_STATUSES,
  STATUS_META,
  type ChosenStatus
} from '../../../../friends/lib/presenceStatus'

/** Modal de status nas configurações de perfil: Online, Ausente, Não perturbe e Invisível. */
export default function StatusModal({
  status,
  onClose,
  onSelect
}: {
  status: ChosenStatus
  onClose: () => void
  onSelect: (status: ChosenStatus) => void
}): React.JSX.Element {
  const choose = (s: ChosenStatus): void => {
    onSelect(s)
    onClose()
  }

  return (
    <Modal open title="Status" onClose={onClose}>
      <div role="radiogroup" aria-label="Status de presença" className="flex flex-col gap-2">
        {CHOSEN_STATUSES.map((s) => {
          const meta = STATUS_META[s]
          const isSelected = status === s
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => choose(s)}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? 'border-[var(--brand)] bg-white/5'
                  : 'border-subtle hover:border-white/20 hover:bg-white/[0.02]'
              }`}
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                <StatusIcon status={s} size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-strong">{meta.label}</span>
                {meta.description && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {meta.description}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={onClose} className="min-h-10">
          Pronto
        </Button>
      </div>
    </Modal>
  )
}
