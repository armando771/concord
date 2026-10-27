import { useRef } from 'react'
import { PROFILE_IMAGE_TYPES } from '../../../profile/lib/profileValidation'
import { BirthdaySettings } from '../AppSettings'
import ImageCropModal, { type ImageKind } from '../ImageCropModal'
import NameStyleEditor from '../NameStyleEditor'
import ProfileThemeEditor from '../ProfileThemeEditor'
import { useProfileEditor, type ProfileEditor } from '../../hooks/useProfileEditor'
import { previewMedia } from '../../lib/saveProfile'
import { Field } from '../profile/ProfileField'
import ProfileLinksField from '../profile/ProfileLinksField'
import { AvatarField, BannerField } from '../profile/ProfileMediaFields'
import ProfilePreview from '../profile/ProfilePreview'
import { BioField, DisplayNameField, NoteField, PronounsField } from '../profile/ProfileTextFields'
import UnsavedChangesBar from '../profile/UnsavedChangesBar'

const MEDIA_KINDS: ImageKind[] = ['avatar', 'banner']

type FileInputs = Record<ImageKind, React.RefObject<HTMLInputElement | null>>

function FileInputs({
  inputs,
  onPick
}: {
  inputs: FileInputs
  onPick: ProfileEditor['pickFile']
}): React.JSX.Element {
  return (
    <>
      {MEDIA_KINDS.map((kind) => (
        <input
          key={kind}
          ref={inputs[kind]}
          type="file"
          accept={PROFILE_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            onPick(kind, e.target.files?.[0])
            e.target.value = ''
          }}
        />
      ))}
    </>
  )
}

/**
 * Configurações → Perfis, como no Discord: o editor à esquerda e a prévia do
 * cartão à direita, ao vivo. Nada vai para o servidor até "Salvar alterações";
 * com algo pendente, a barra de aviso aparece embaixo (e treme se tentar sair).
 */
function ProfilesSection(): React.JSX.Element | null {
  const editor = useProfileEditor()
  const inputs: FileInputs = { avatar: useRef(null), banner: useRef(null) }
  const { user, draft, errors, set } = editor
  if (!user) return null

  const avatarUrl = previewMedia(draft.avatar, user.avatar_url)
  const bannerUrl = previewMedia(draft.banner, user.banner_url)
  const open = (kind: ImageKind): void => inputs[kind].current?.click()

  return (
    <>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <DisplayNameField
            value={draft.display_name}
            error={errors.display_name}
            onChange={(v) => set('display_name', v)}
          />
          <Field label="Estilo do nome" hint="Fonte e efeito do seu nome de exibição.">
            <NameStyleEditor
              value={draft.name_style}
              previewName={draft.display_name.trim()}
              onChange={(next) => set('name_style', next)}
            />
          </Field>
          <PronounsField
            value={draft.pronouns}
            error={errors.pronouns}
            onChange={(v) => set('pronouns', v)}
          />
          <AvatarField
            hasAvatar={Boolean(avatarUrl)}
            onPick={() => open('avatar')}
            onRemove={() => editor.setMedia('avatar', { kind: 'remove' })}
          />
          <BannerField
            hasBanner={Boolean(bannerUrl)}
            color={draft.banner_color}
            error={errors.banner_color}
            onPick={() => open('banner')}
            onRemove={() => editor.setMedia('banner', { kind: 'remove' })}
            onColor={(c) => set('banner_color', c)}
          />
          <Field
            label="Tema do perfil"
            hint="Borda, fundo e efeito do seu cartão de perfil, do jeito que os outros veem."
          >
            <ProfileThemeEditor
              value={draft.profile_theme}
              onChange={(next) => set('profile_theme', next)}
            />
          </Field>
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
          {/* Aniversário salva na hora, como antes (fora do "Salvar alterações"). */}
          <BirthdaySettings />
        </div>

        {/* Prévia */}
        <div className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[300px]">
          <p className="mb-2 text-ds-sm font-medium text-gray-300">Prévia</p>
          <ProfilePreview
            user={user}
            draft={draft}
            avatarUrl={avatarUrl}
            bannerUrl={bannerUrl}
            onEditAvatar={() => open('avatar')}
            onEditBanner={() => open('banner')}
          />
          <p className="mt-2 text-xs text-gray-500">
            Passe o mouse no avatar ou no banner para trocar a imagem.
          </p>
        </div>
      </div>

      <FileInputs inputs={inputs} onPick={editor.pickFile} />

      {editor.cropping && (
        <ImageCropModal
          file={editor.cropping.file}
          src={editor.cropping.src}
          kind={editor.cropping.kind}
          onCancel={() => editor.closeCrop()}
          onApply={(change) => editor.closeCrop(change)}
        />
      )}

      {editor.dirty && (
        <UnsavedChangesBar
          shaking={editor.shaking}
          saving={editor.saving}
          invalid={editor.invalid}
          progress={editor.progress}
          onReset={editor.reset}
          onSave={() => void editor.save()}
        />
      )}
    </>
  )
}

export default ProfilesSection
