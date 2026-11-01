import { useEffect, useRef, useState } from 'react'
import { showToast } from '../../../shared/store/toastStore'
import { imageFileError, type MediaChange } from '../../profile/lib/profileValidation'
import { serverIconSrc } from '../lib/serverIcon'
import ImageCropModal from '../../settings/components/ImageCropModal'

/**
 * Seletor do ícone do servidor, igual ao do avatar: escolher arquivo, recortar,
 * prévia e remover. Não envia nada: quem usa decide quando subir (`value`).
 */
function ServerIconPicker({
  name,
  currentUrl,
  value,
  onChange
}: {
  name: string
  /** Ícone já salvo (vazio num servidor novo). */
  currentUrl?: string | null
  value: MediaChange
  onChange: (change: MediaChange) => void
}): React.JSX.Element {
  const [cropping, setCropping] = useState<{ file: File; src: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)

  const releasePreview = (): void => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
  }
  useEffect(() => releasePreview, [])

  // Quem reinicia o valor (depois de salvar) também solta a prévia antiga.
  useEffect(() => {
    if (value.kind !== 'set') releasePreview()
  }, [value])

  const change = (next: MediaChange): void => {
    releasePreview()
    if (next.kind === 'set') previewRef.current = next.previewUrl
    onChange(next)
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
    value.kind === 'set' ? value.previewUrl : value.kind === 'remove' ? undefined : currentUrl
  const iconSrc = serverIconSrc(shown)

  return (
    <div>
      <p className="mb-2 text-ds-sm font-medium text-gray-300">Ícone do servidor</p>
      <p className="mb-2 text-xs text-gray-400">PNG, JPG, WebP ou GIF animado, até 10 MB.</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 text-xl font-bold text-white">
          {iconSrc ? (
            <img src={iconSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{(name.trim() || '?').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-md bg-brand px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          Alterar ícone
        </button>
        {iconSrc && (
          <button
            type="button"
            onClick={() => change({ kind: 'remove' })}
            className="cursor-pointer rounded-md bg-fg/10 px-4 py-2 text-ds-sm font-medium text-strong transition-colors hover:bg-fg/15"
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
      {cropping && (
        <ImageCropModal
          file={cropping.file}
          src={cropping.src}
          kind="avatar"
          onCancel={() => {
            URL.revokeObjectURL(cropping.src)
            setCropping(null)
          }}
          onApply={(next) => {
            URL.revokeObjectURL(cropping.src)
            setCropping(null)
            change(next)
          }}
        />
      )}
    </div>
  )
}

export default ServerIconPicker
