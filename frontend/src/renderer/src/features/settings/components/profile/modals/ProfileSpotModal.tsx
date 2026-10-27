import { spotOpensFile, type CardSpot } from '../../../../profile/lib/cardSpots'
import type { ProfileDraft } from '../../../../profile/lib/profileValidation'
import type { ProfileEditor } from '../../../hooks/useProfileEditor'
import type { DraftPatch } from '../../../lib/draftPatch'
import type { PreviewBase } from '../ProfilePreview'
import FieldModal from './FieldModal'
import NameStyleModal from './NameStyleModal'
import { SPOT_FIELDS } from './spotFields'

/** "Aplicar" passa a mudança do modal para o rascunho (o "Salvar alterações" grava). */
export function applyPatch(set: ProfileEditor['set'], patch: DraftPatch): void {
  for (const [key, value] of Object.entries(patch)) {
    set(key as keyof ProfileDraft, value as ProfileDraft[keyof ProfileDraft])
  }
}

/** O modal da parte do cartão que foi clicada (avatar e banner abrem o arquivo, não modal). */
export default function ProfileSpotModal({
  spot,
  base,
  editor,
  onClose
}: {
  spot: CardSpot | null
  base: PreviewBase
  editor: Pick<ProfileEditor, 'draft' | 'set'>
  onClose: () => void
}): React.JSX.Element | null {
  if (!spot || spotOpensFile(spot)) return null
  const apply = (patch: DraftPatch): void => {
    applyPatch(editor.set, patch)
    onClose()
  }
  if (spot === 'name') {
    return <NameStyleModal base={base} draft={editor.draft} onClose={onClose} onApply={apply} />
  }
  return (
    <FieldModal
      key={spot}
      field={SPOT_FIELDS[spot]}
      base={base}
      draft={editor.draft}
      onClose={onClose}
      onApply={apply}
    />
  )
}
