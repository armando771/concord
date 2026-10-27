import Button from '../../../shared/ui/Button'
import { commentEditKeyAction } from '../lib/commentKeys'
import { MAX_COMMENT } from '../lib/proposals'

/** Campo para editar um comentário: Enter salva, Esc cancela. */
function CommentEditForm({
  draft,
  onDraft,
  saveDisabled,
  onSave,
  onCancel
}: {
  draft: string
  onDraft: (value: string) => void
  saveDisabled: boolean
  onSave: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <div className="mt-1 flex flex-col gap-2">
      <textarea
        value={draft}
        maxLength={MAX_COMMENT}
        rows={2}
        aria-label="Editar comentário"
        autoFocus
        className="glass-input w-full resize-none rounded-lg px-3 py-2 text-ds-sm text-strong"
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          const action = commentEditKeyAction(e.key, e.shiftKey)
          if (!action) return
          // Esc aqui só cancela a edição: sem marcar, fecharia o modal da proposta.
          e.preventDefault()
          e.stopPropagation()
          if (action === 'save') onSave()
          else onCancel()
        }}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="px-3 py-1 text-xs" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" className="px-3 py-1 text-xs" disabled={saveDisabled} onClick={onSave}>
          Salvar
        </Button>
      </div>
    </div>
  )
}

export default CommentEditForm
