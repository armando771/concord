import { useEffect, useRef, useState } from 'react'
import { useServerStore } from '../../store/serverStore'
import { showToast } from '../../store/toastStore'
import { actionErrorMessage } from '../../lib/permissionErrors'
import { imageFileError, type MediaChange } from '../../lib/profileValidation'
import { serverIconSrc } from '../../lib/serverIcon'
import Button from '../Button'
import Input from '../Input'
import ImageCropModal from '../settings/ImageCropModal'

/** Nome e ícone do servidor (antes era o modal "Editar servidor"). */
function OverviewSection(): React.JSX.Element {
  const server = useServerStore((s) => s.currentServer)
  const updateServer = useServerStore((s) => s.updateServer)
  const setServerIcon = useServerStore((s) => s.setServerIcon)
  const [name, setName] = useState(server?.name ?? '')
  // Mesmo fluxo do avatar: escolher, recortar, ver a prévia e só enviar ao salvar.
  const [icon, setIcon] = useState<MediaChange>({ kind: 'keep' })
  const [cropping, setCropping] = useState<{ file: File; src: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)

  const releasePreview = (): void => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
  }
  useEffect(() => releasePreview, [])

  if (!server) return <p className="text-sm text-gray-400">Abra um servidor primeiro.</p>

  const changeIcon = (change: MediaChange): void => {
    releasePreview()
    if (change.kind === 'set') previewRef.current = change.previewUrl
    setIcon(change)
  }

  const pickFile = (file: File | undefined): void => {
    if (!file) return
    const error = imageFileError(file)
    if (error) {
      showToast.error(error)
      return
    }
    setCropping({ file, src: URL.createObjectURL(file) })
  }

  const shown =
    icon.kind === 'set' ? icon.previewUrl : icon.kind === 'remove' ? undefined : server.icon_url
  const iconSrc = serverIconSrc(shown)
  const dirty = name.trim() !== server.name || icon.kind !== 'keep'

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (name.trim() !== server.name) await updateServer(server.id, name.trim())
      if (icon.kind === 'set') {
        await setServerIcon(server.id, { file: icon.file, staticFrame: icon.staticFrame })
      } else if (icon.kind === 'remove') {
        await setServerIcon(server.id, null)
      }
      changeIcon({ kind: 'keep' })
      showToast.success('Servidor atualizado!')
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Falha ao salvar servidor.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="max-w-md space-y-4">
      <Input
        label="Nome do servidor"
        placeholder="ex.: Meu Servidor"
        value={name}
        maxLength={32}
        onChange={(e) => setName(e.target.value)}
      />
      <div>
        <p className="mb-2 text-ds-sm font-medium text-gray-300">Ícone do servidor</p>
        <p className="mb-2 text-xs text-gray-400">PNG, JPG, WebP ou GIF animado, até 10 MB.</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 text-xl font-bold text-white">
            {iconSrc ? (
              <img src={iconSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>{(name.trim() || server.name).charAt(0).toUpperCase()}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-md bg-[#5865f2] px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-[#4752c4]"
          >
            Alterar ícone
          </button>
          {iconSrc && (
            <button
              type="button"
              onClick={() => changeIcon({ kind: 'remove' })}
              className="cursor-pointer rounded-md bg-white/10 px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-white/15"
            >
              Remover ícone
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            aria-label="Arquivo do ícone"
            onChange={(e) => {
              pickFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </div>
      <Button type="submit" variant="primary" disabled={saving || !dirty || !name.trim()}>
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
      {cropping && (
        <ImageCropModal
          file={cropping.file}
          src={cropping.src}
          kind="avatar"
          onCancel={() => {
            URL.revokeObjectURL(cropping.src)
            setCropping(null)
          }}
          onApply={(change) => {
            URL.revokeObjectURL(cropping.src)
            setCropping(null)
            changeIcon(change)
          }}
        />
      )}
    </form>
  )
}

export default OverviewSection
