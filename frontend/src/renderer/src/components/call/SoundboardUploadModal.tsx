import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MAX_SOUNDBOARD_BYTES,
  MAX_SOUNDBOARD_DURATION_MS,
  MAX_SOUNDBOARD_NAME_LEN,
  MIN_SOUNDBOARD_DURATION_MS
} from '../../api/soundboard'
import { useSoundboardStore } from '../../store/soundboardStore'
import { showToast } from '../../store/toastStore'
import Button from '../Button'
import { readMediaMeta } from '../chat/readMediaMeta'
import { PauseIcon, PlayIcon } from '../icons'
import Input from '../Input'

const PRESET_EMOJIS = ['🎺', '😂', '🔥', '💀', '🎉', '👏', '🚨', '💥', '🥁', '🐸', '🎸', '🔔']

interface SoundboardUploadModalProps {
  open: boolean
  serverId: string
  onClose: () => void
}

function SoundboardUploadModal({
  open,
  serverId,
  onClose
}: SoundboardUploadModalProps): React.JSX.Element | null {
  const uploadSound = useSoundboardStore((s) => s.uploadSound)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎺')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      // Fechou o modal: zera o formulário para a próxima abertura.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFile(null)
      setDurationMs(null)
      setName('')
      setEmoji('🎺')
      setPreviewPlaying(false)
      setSubmitting(false)
      setError(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
    }
  }, [open, previewUrl])

  if (!open) return null

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return

    setError(null)
    if (selected.size > MAX_SOUNDBOARD_BYTES) {
      setError('O arquivo excede o limite de 5 MB.')
      return
    }

    const meta = await readMediaMeta(selected, 'audio')
    const dur = meta.duration_ms ?? 0
    if (!dur || dur < MIN_SOUNDBOARD_DURATION_MS || dur > MAX_SOUNDBOARD_DURATION_MS) {
      setError('O áudio precisa ser válido e ter entre 0,1s e 15s de duração.')
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const nextUrl = URL.createObjectURL(selected)
    setFile(selected)
    setDurationMs(dur)
    setPreviewUrl(nextUrl)
    setPreviewPlaying(false)

    if (!name.trim()) {
      const baseName = selected.name.replace(/\.[^.]+$/, '').slice(0, MAX_SOUNDBOARD_NAME_LEN)
      setName(baseName)
    }
  }

  const togglePreview = (): void => {
    const el = previewAudioRef.current
    if (!el || !previewUrl) return
    if (previewPlaying) {
      el.pause()
      el.currentTime = 0
      setPreviewPlaying(false)
    } else {
      el.currentTime = 0
      void el
        .play()
        .then(() => setPreviewPlaying(true))
        .catch(() => setPreviewPlaying(false))
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!file || !durationMs || submitting) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Digite um nome para o som.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await uploadSound(serverId, file, {
        name: trimmedName,
        emoji: emoji.trim() || undefined,
        duration_ms: durationMs,
        filename: file.name
      })
      showToast.success('Som adicionado à mesa de áudio!')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o áudio.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111214] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Adicionar Som à Mesa de Áudio</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-gray-400 transition-colors hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Arquivo de áudio (máx. 15s e 5 MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,audio/webm,.mp3,.wav,.ogg,.m4a,.webm"
              className="hidden"
              onChange={(e) => void handleSelectFile(e)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-1 cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2.5 text-left text-xs text-gray-200 transition-colors hover:border-white/40 hover:bg-white/10"
              >
                <span className="truncate">
                  {file ? file.name : 'Escolher arquivo (.mp3, .wav, .ogg, .m4a)'}
                </span>
                {durationMs !== null && (
                  <span className="ml-2 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-gray-300">
                    {(durationMs / 1000).toFixed(1)}s • {(file!.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </button>
              {previewUrl && (
                <button
                  type="button"
                  onClick={togglePreview}
                  title={previewPlaying ? 'Parar prévia' : 'Ouvir prévia'}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#5865f2] text-white transition-colors hover:bg-[#4752c4]"
                >
                  {previewPlaying ? (
                    <PauseIcon className="h-4 w-4" />
                  ) : (
                    <PlayIcon className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
            {previewUrl && (
              <audio
                ref={previewAudioRef}
                src={previewUrl}
                onEnded={() => setPreviewPlaying(false)}
                className="hidden"
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Nome do botão
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_SOUNDBOARD_NAME_LEN))}
              placeholder="Ex.: Corneta, Risada, Tambores…"
              maxLength={MAX_SOUNDBOARD_NAME_LEN}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Ícone / Emoji
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-base transition-colors ${
                    emoji === em
                      ? 'bg-[#5865f2] text-white ring-2 ring-white/40'
                      : 'bg-white/5 hover:bg-white/15'
                  }`}
                >
                  {em}
                </button>
              ))}
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                placeholder="🎵"
                aria-label="Emoji personalizado"
                className="h-8 w-12 rounded-lg border border-white/10 bg-white/5 text-center text-sm text-white focus:border-[#5865f2] focus:outline-none"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-[#f23f43]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!file || !name.trim() || submitting}>
              {submitting ? 'Enviando…' : 'Salvar na Mesa'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default SoundboardUploadModal
