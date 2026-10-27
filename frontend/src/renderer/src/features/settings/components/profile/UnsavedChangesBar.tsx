import { saveLabel } from '../../lib/saveProfile'

/**
 * "Cuidado — você tem alterações não salvas!", como no Discord: aparece com
 * algo pendente e treme (vermelha) se tentar sair sem salvar.
 */
export default function UnsavedChangesBar({
  shaking,
  saving,
  invalid,
  progress,
  onReset,
  onSave
}: {
  shaking: boolean
  saving: boolean
  invalid: boolean
  progress: number | null
  onReset: () => void
  onSave: () => void
}): React.JSX.Element {
  return (
    <div className="sticky bottom-4 z-10 mt-6">
      <div
        role="status"
        className={`flex flex-col gap-2 rounded-xl px-4 py-2.5 shadow-2xl transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
          shaking ? 'unsaved-shake bg-danger-strong' : 'bg-floating border border-subtle'
        }`}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-strong">
            Cuidado — você tem alterações não salvas!
          </p>
          {invalid && (
            <p className="text-xs text-gray-300">Corrija os campos em vermelho para salvar.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="min-h-10 cursor-pointer rounded-lg px-3 text-sm text-strong hover:underline disabled:opacity-50"
          >
            Redefinir
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || invalid}
            title={invalid ? 'Corrija os campos em vermelho' : undefined}
            className="min-h-10 cursor-pointer rounded-lg bg-success-strong px-4 text-ds-sm font-medium text-white transition-colors hover:bg-success-strong-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveLabel(saving, progress)}
          </button>
        </div>
      </div>
    </div>
  )
}
