import type { ProfileEditor } from '../../hooks/useProfileEditor'
import EntranceSoundSettings from '../../../profile/components/EntranceSoundSettings'
import { BirthdaySettings } from '../AppSettings'
import { EditorSection } from './controls'
import ProfileLinksField from './ProfileLinksField'
import ProfileMediaFields from './ProfileMediaFields'
import { BioField, DisplayNameField, NoteField, PronounsField } from './ProfileTextFields'

/**
 * Aba "Identidade": imagens, nome e pronomes, o que aparece no cartão e, no
 * fim, o que salva na hora (aniversário e som de entrada).
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
      <EditorSection title="Nome">
        <div className="grid gap-3 sm:grid-cols-2">
          <DisplayNameField
            value={draft.display_name}
            error={errors.display_name}
            onChange={(v) => set('display_name', v)}
          />
          <PronounsField
            value={draft.pronouns}
            error={errors.pronouns}
            onChange={(v) => set('pronouns', v)}
          />
        </div>
      </EditorSection>
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
      {/* Aniversário e som de entrada salvam na hora (fora do "Salvar alterações"). */}
      <p className="-mb-1 px-1 text-xs text-gray-400">Estes dois salvam na hora:</p>
      <div className="grid gap-3 xl:grid-cols-2">
        <BirthdaySettings />
        <EntranceSoundSettings />
      </div>
    </>
  )
}
