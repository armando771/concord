import { useRef, useState } from 'react'
import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import { MAX_STICKER_BYTES, MAX_STICKER_NAME_LEN } from '../api/stickers'
import { useStickerStore } from '../store/stickerStore'
import { showToast } from '../../../shared/store/toastStore'

interface StickerUploadModalProps {
  open: boolean
  serverId: string
  onClose: () => void
}

export default function StickerUploadModal({
  open,
  serverId,
  onClose
}: StickerUploadModalProps): React.JSX.Element | null {
  const uploadSticker = useStickerStore((s) => s.uploadSticker)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (): void => {
    setFile(null)
    setName('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setError(null)
    setSubmitting(false)
  }

  const handleClose = (): void => {
    reset()
    onClose()
  }

  const onSelectFile = (selected: File | undefined): void => {
    if (!selected) return
    if (selected.size > MAX_STICKER_BYTES) {
      setError('A imagem deve ter no máximo 1 MB.')
      return
    }
    const type = selected.type
    if (type !== 'image/png' && type !== 'image/webp' && type !== 'image/gif') {
      setError('Apenas imagens PNG, WebP ou GIF são suportadas.')
      return
    }

    setError(null)
    setFile(selected)
    if (!name) {
      const baseName = selected.name.replace(/\.[^/.]+$/, '').slice(0, MAX_STICKER_NAME_LEN)
      setName(baseName)
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!file) {
      setError('Selecione uma imagem para a figurinha.')
      return
    }
    if (!trimmedName) {
      setError('Dê um nome para a figurinha.')
      return
    }
    if (trimmedName.length > MAX_STICKER_NAME_LEN) {
      setError(`O nome pode ter no máximo ${MAX_STICKER_NAME_LEN} caracteres.`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await uploadSticker(serverId, trimmedName, file, file.name)
      showToast.success('Figurinha adicionada com sucesso!')
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a figurinha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title="Nova Figurinha" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 p-6 transition-colors hover:border-violet-500/50 hover:bg-white/10 cursor-pointer"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/webp,image/gif"
            hidden
            onChange={(e) => onSelectFile(e.target.files?.[0])}
          />
          {previewUrl ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={previewUrl}
                alt="Preview"
                className="h-28 w-28 object-contain"
              />
              <span className="text-xs text-gray-400">Clique para trocar a imagem</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-2xl">🖼️</span>
              <span className="text-xs font-medium text-white">Escolha ou arraste uma imagem</span>
              <span className="text-[10px] text-gray-400">PNG, WebP ou GIF (máx. 1 MB)</span>
            </div>
          )}
        </div>

        <Input
          label="Nome da figurinha"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: risada, valeu, gato"
          maxLength={MAX_STICKER_NAME_LEN}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !file || !name.trim()}
          >
            {submitting ? 'Enviando...' : 'Adicionar Figurinha'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
