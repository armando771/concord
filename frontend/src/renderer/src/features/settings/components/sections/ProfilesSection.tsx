import { useRef, useState } from 'react'
import { PROFILE_IMAGE_TYPES } from '../../../profile/lib/profileValidation'
import ImageCropModal, { type ImageKind } from '../ImageCropModal'
import { useProfileEditor, type ProfileEditor } from '../../hooks/useProfileEditor'
import { cardNotice, panelId, tabAlert, tabId, type ProfileTab } from '../../lib/profileTabs'
import { spotOpensFile, type CardSpot } from '../../../profile/lib/cardSpots'
import { previewMedia } from '../../lib/saveProfile'
import AppearanceTab from '../profile/AppearanceTab'
import IdentityTab from '../profile/IdentityTab'
import ProfileEditorTabs from '../profile/ProfileEditorTabs'
import ProfilePreviewPanel from '../profile/ProfilePreviewPanel'
import ProfileSpotModal from '../profile/modals/ProfileSpotModal'
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
          aria-label={kind === 'avatar' ? 'Arquivo do avatar' : 'Arquivo do banner'}
          onChange={(e) => {
            onPick(kind, e.target.files?.[0])
            e.target.value = ''
          }}
        />
      ))}
    </>
  )
}

function CropModal({ editor }: { editor: ProfileEditor }): React.JSX.Element | null {
  const { cropping } = editor
  if (!cropping) return null
  return (
    <ImageCropModal
      file={cropping.file}
      src={cropping.src}
      kind={cropping.kind}
      onCancel={() => editor.closeCrop()}
      onApply={(change) => editor.closeCrop(change)}
    />
  )
}

/**
 * Configurações → Perfis, como no Discord: o editor em duas abas (Identidade
 * e Aparência) à esquerda e, à direita, o cartão como os outros veem, ao vivo
 * e fixo na rolagem; no celular ele vai para cima. Clicar numa parte do
 * cartão abre o editor dela (avatar e banner: o arquivo; nome, pronomes,
 * nota, Sobre mim e links: um modal com prévia). Nada vai para o servidor até
 * "Salvar alterações"; com algo pendente, a barra de aviso aparece embaixo (e
 * treme se tentar sair).
 */
function ProfilesSection(): React.JSX.Element | null {
  const editor = useProfileEditor()
  const inputs: FileInputs = { avatar: useRef(null), banner: useRef(null) }
  const [tab, setTab] = useState<ProfileTab>('identity')
  const [spot, setSpot] = useState<CardSpot | null>(null)
  const { user, draft } = editor
  if (!user) return null

  const avatarUrl = previewMedia(draft.avatar, user.avatar_url)
  const bannerUrl = previewMedia(draft.banner, user.banner_url)
  const open = (kind: ImageKind): void => inputs[kind].current?.click()
  const edit = (target: CardSpot): void => (spotOpensFile(target) ? open(target) : setSpot(target))

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <ProfilePreviewPanel
          user={user}
          draft={draft}
          avatarUrl={avatarUrl}
          bannerUrl={bannerUrl}
          onEdit={edit}
          notice={cardNotice(editor.errors)}
        />
        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          <ProfileEditorTabs value={tab} alert={tabAlert(editor.errors)} onChange={setTab} />
          <div
            role="tabpanel"
            id={panelId(tab)}
            aria-labelledby={tabId(tab)}
            className="flex flex-col gap-4"
          >
            {tab === 'identity' ? (
              <IdentityTab
                editor={editor}
                avatarUrl={avatarUrl}
                bannerUrl={bannerUrl}
                onPick={open}
              />
            ) : (
              <AppearanceTab editor={editor} onEditName={() => setSpot('name')} />
            )}
          </div>
        </div>
      </div>

      <FileInputs inputs={inputs} onPick={editor.pickFile} />
      <CropModal editor={editor} />
      <ProfileSpotModal
        spot={spot}
        base={{ user, avatarUrl, bannerUrl }}
        editor={editor}
        onClose={() => setSpot(null)}
      />

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
