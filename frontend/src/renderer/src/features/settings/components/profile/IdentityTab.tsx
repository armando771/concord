import type { ProfileEditor } from '../../hooks/useProfileEditor'
import EntranceSoundSettings from '../../../profile/components/EntranceSoundSettings'
import { EditorSection } from './controls'
import ProfileLinksField from './ProfileLinksField'
import ProfileMediaFields from './ProfileMediaFields'
import { BioField, NoteField } from './ProfileTextFields'

/**
 * Aba "Identidade": imagens, o que aparece no cartão e, no fim, o som de
 * entrada (que salva na hora). Nome e pronomes se editam clicando no cartão
 * ao lado; o aniversário fica em Minha conta.
 */
export default function IdentityTab({
  editor,
  avatarUrl,
  bannerUrl,
  onPick
}: {
  editor: ProfileEditor
  avatarUrl: string | null
  bannerUrl: string | null
  onPick: (kind: 'avatar' | 'banner') => void
}): React.JSX.Element {
  const { draft, errors, set } = editor
  return (
    <>
      <ProfileMediaFields
        name={draft.display_name.trim() || (editor.user?.username ?? '')}
        avatarUrl={avatarUrl}
        bannerUrl={bannerUrl}
        bannerColor={draft.banner_color}
        error={errors.banner_color}
        onPick={onPick}
        onRemove={(kind) => editor.setMedia(kind, { kind: 'remove' })}
        onBannerColor={(c) => set('banner_color', c)}
      />
      <EditorSection title="Sobre você">
        <NoteField
          value={draft.status_text}
          error={errors.status_text}
          onChange={(v) => set('status_text', v)}
        />
        <BioField value={draft.bio} error={errors.bio} onChange={(v) => set('bio', v)} />
        <ProfileLinksField
          links={draft.links}
          error={errors.links}
          linkErrors={errors.linkErrors}
          onChange={(links) => set('links', links)}
        />
      </EditorSection>
      {/* O som de entrada salva na hora (fora do "Salvar alterações"). */}
      <EntranceSoundSettings />
    </>
  )
}
