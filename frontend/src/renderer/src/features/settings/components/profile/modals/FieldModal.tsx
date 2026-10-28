import { useState } from 'react'
import { hasErrors, type ProfileDraft } from '../../../../profile/lib/profileValidation'
import { patchErrors, patchedDraft, type DraftPatch } from '../../../lib/draftPatch'
import ProfilePreview, { type PreviewBase } from '../ProfilePreview'
import EditModalShell from './EditModalShell'
import type { SpotField } from './spotFields'

/**
 * Pronomes, nota, Sobre mim, links, cor do banner ou tema: o campo à
 * esquerda e o cartão ao vivo à direita. "Aplicar" já salva (`busy` enquanto
 * vai para o servidor).
 */
export default function FieldModal({
  field,
  base,
  draft,
  busy,
  onClose,
  onApply
}: {
  field: SpotField
  base: PreviewBase
  draft: ProfileDraft
  busy?: boolean
  onClose: () => void
  onApply: (patch: DraftPatch) => void
}): React.JSX.Element {
  const [value, setValue] = useState<ProfileDraft[typeof field.key]>(draft[field.key])
  const patch: DraftPatch = { [field.key]: value }
  const merged = patchedDraft(draft, patch)
  const errors = patchErrors(merged, [field.key])

  return (
    <EditModalShell
      title={field.title}
      size={field.size}
      busy={busy}
      canApply={!hasErrors(errors)}
      onClose={onClose}
      onApply={() => onApply(patch)}
      preview={
        <ProfilePreview
          user={base.user}
          draft={merged}
          avatarUrl={base.avatarUrl}
          bannerUrl={base.bannerUrl}
        />
      }
    >
      {field.render(value, errors, setValue)}
    </EditModalShell>
  )
}
