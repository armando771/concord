import { useRef } from 'react'
import {
  PRESET_BACKGROUNDS,
  type BackgroundPreset,
  type CustomBackground,
  type VideoBackground
} from '../lib/videoBackground'
import { CheckIcon, XIcon } from '../../../shared/ui/icons'

const BASE_TILE =
  'relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 text-ds-xs font-medium transition-colors'

const tile = (selected: boolean): string =>
  `${BASE_TILE} ${
    selected
      ? 'border-brand text-strong'
      : 'border-transparent text-gray-300 hover:border-fg/20 hover:text-strong'
  }`

function NoneIcon(): React.JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  )
}

function BlurIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z" />
      <path
        d="M3 4h2M3 8h1M19 4h2M20 8h1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity=".6"
      />
    </svg>
  )
}

function UploadIcon(): React.JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
      <path d="M17 3v4M15 5h4" />
    </svg>
  )
}

/**
 * "Fundo do vídeo" (como no Discord): Nenhum, Borrar, Personalizado e as
 * imagens prontas e salvas. Controlado: quem usa decide se vale na hora
 * (Configurações) ou só ao confirmar (modal).
 */
function BackgroundPicker({
  value,
  customs,
  presets = PRESET_BACKGROUNDS,
  error,
  onChange,
  onUpload,
  onRemoveCustom
}: {
  value: VideoBackground
  customs: readonly CustomBackground[]
  presets?: readonly BackgroundPreset[]
  error?: string | null
  onChange: (bg: VideoBackground) => void
  onUpload: (file: File) => void
  onRemoveCustom: (id: string) => void
}): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)
  const isImage = (kind: 'preset' | 'custom', id: string): boolean =>
    value.mode === 'image' && value.image?.kind === kind && value.image.id === id

  return (
    <div role="group" aria-label="Fundo do vídeo" className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          aria-pressed={value.mode === 'none'}
          onClick={() => onChange({ mode: 'none', image: null })}
          className={`${tile(value.mode === 'none')} bg-fg/5`}
        >
          <NoneIcon />
          Nenhum
        </button>
        <button
          type="button"
          aria-pressed={value.mode === 'blur'}
          onClick={() => onChange({ mode: 'blur', image: null })}
          className={`${tile(value.mode === 'blur')} bg-fg/5`}
        >
          <BlurIcon />
          Borrar
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`${tile(false)} bg-brand/15`}
        >
          <UploadIcon />
          Personalizado
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
        {customs.map((c) => {
          const selected = isImage('custom', c.id)
          return (
            <div key={c.id} className="group relative">
              <button
                type="button"
                aria-pressed={selected}
                aria-label="Imagem personalizada"
                onClick={() => onChange({ mode: 'image', image: { kind: 'custom', id: c.id } })}
                className={tile(selected)}
              >
                <img
                  src={c.dataUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {c.animated && (
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">
                    GIF
                  </span>
                )}
                {selected && <Selected />}
              </button>
              <button
                type="button"
                aria-label="Remover imagem"
                title="Remover imagem"
                onClick={() => onRemoveCustom(c.id)}
                className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white [@media(hover:hover)]:opacity-0 transition-opacity hover:bg-danger-strong focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          )
        })}
        {presets.map((p) => {
          const selected = isImage('preset', p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              aria-label={p.label}
              title={p.label}
              onClick={() => onChange({ mode: 'image', image: { kind: 'preset', id: p.id } })}
              className={tile(selected)}
            >
              <img src={p.dataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              {selected && <Selected />}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="text-xs text-warning">
          {error}
        </p>
      )}
    </div>
  )
}

function Selected(): React.JSX.Element {
  return (
    <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
      <CheckIcon className="h-3 w-3" />
    </span>
  )
}

export default BackgroundPicker
