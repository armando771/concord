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
    <div className="sticky bottom-6 z-10 mt-8">
      <div
        role="status"
        className={`flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 shadow-2xl transition-colors ${
          shaking ? 'unsaved-shake bg-danger-strong' : 'bg-floating border border-subtle'
        }`}
      >
        <p className="text-sm font-medium text-strong">Cuidado — você tem alterações não salvas!</p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="cursor-pointer text-sm text-strong hover:underline disabled:opacity-50"
          >
            Redefinir
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || invalid}
            title={invalid ? 'Corrija os campos em vermelho' : undefined}
            className="cursor-pointer rounded-md bg-success-strong px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-success-strong-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveLabel(saving, progress)}
          </button>
        </div>
      </div>
    </div>
  )
}
