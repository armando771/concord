import { useRef, useState } from 'react'
import { useChromaKeyStore } from '../store/chromaKeyStore'
import { CHROMA_KEY_PRESETS } from '../lib/chromaKey'
import { imageFileToBackground } from '../lib/chromaKeyImage'
import { useChromaKeyPreview } from './useChromaKeyPreview'
import Switch from './Switch'

interface EyeDropperApi {
  open: () => Promise<{ sRGBHex: string }>
}
const EyeDropper = (globalThis as { EyeDropper?: new () => EyeDropperApi }).EyeDropper

function Slider({
  label,
  hint,
  value,
  onChange
}: {
  label: string
  hint: string
  value: number
  onChange: (v: number) => void
}): React.JSX.Element {
  const percent = Math.round(value * 100)
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-ds-sm font-medium text-gray-400">
        {label}
        <span className="text-strong">{percent}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full cursor-pointer accent-brand"
      />
      <span className="text-xs text-gray-400">{hint}</span>
    </label>
  )
}

function PreviewVideo({
  stream,
  label
}: {
  stream: MediaStream
  label: string
}): React.JSX.Element {
  return (
    <figure className="flex-1 space-y-1">
      <video
        ref={(el) => {
          if (el && el.srcObject !== stream) {
            el.srcObject = stream
            void el.play().catch(() => {})
          }
        }}
        muted
        playsInline
        aria-label={label}
        className="aspect-video w-full -scale-x-100 rounded-lg bg-black object-cover"
      />
      <figcaption className="text-center text-xs text-gray-400">{label}</figcaption>
    </figure>
  )
}

const choice = (active: boolean): string =>
  `rounded-lg border px-3 py-1.5 text-sm ${
    active ? 'border-brand text-strong' : 'border-subtle text-gray-300'
  }`

/** Configurações → Voz: chroma key da câmera (remove/substitui o fundo). */
function ChromaKeySettings(): React.JSX.Element {
  const s = useChromaKeyStore()
  const [testing, setTesting] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { preview, error } = useChromaKeyPreview(testing && s.enabled)

  async function pickImage(file: File | undefined): Promise<void> {
    if (!file) return
    try {
      const image = await imageFileToBackground(file)
      s.setBackground({ mode: 'image', image })
      setImageError(null)
    } catch (err) {
      setImageError((err as Error).message)
    }
  }

  async function pickFromScreen(): Promise<void> {
    if (!EyeDropper) return
    try {
      const { sRGBHex } = await new EyeDropper().open()
      s.setKeyColor(sRGBHex)
    } catch {
      /* cancelado (Esc) */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-ds-md font-medium text-strong">Chroma key</p>
          <p className="text-xs text-gray-400">
            Remove o fundo da câmera (pano verde ou azul). Quem está na chamada vê o resultado.
          </p>
        </div>
        <Switch checked={s.enabled} onChange={s.setEnabled} label="Chroma key" />
      </div>

      {s.enabled && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-ds-sm font-medium text-gray-400">Cor removida</span>
            <div className="flex flex-wrap items-center gap-2">
              {CHROMA_KEY_PRESETS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => s.setKeyColor(p.color)}
                  aria-pressed={s.keyColor.toLowerCase() === p.color}
                  className={`flex items-center gap-2 ${choice(s.keyColor.toLowerCase() === p.color)}`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
              <input
                type="color"
                value={s.keyColor}
                onChange={(e) => s.setKeyColor(e.target.value)}
                aria-label="Cor removida"
                className="h-8 w-10 cursor-pointer rounded border border-subtle bg-transparent"
              />
              {EyeDropper && (
                <button
                  type="button"
                  onClick={() => void pickFromScreen()}
                  className={choice(false)}
                >
                  Conta-gotas
                </button>
              )}
            </div>
          </div>

          <Slider
            label="Sensibilidade"
            hint="Mais à direita, remove tons mais distantes da cor escolhida."
            value={s.similarity}
            onChange={s.setSimilarity}
          />
          <Slider
            label="Suavidade da borda"
            hint="Mais à direita, a borda do corpo fica mais macia."
            value={s.smoothness}
            onChange={s.setSmoothness}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-ds-sm font-medium text-gray-400">Fundo</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => s.setBackground({ mode: 'color' })}
                aria-pressed={s.background.mode === 'color'}
                className={choice(s.background.mode === 'color')}
              >
                Cor sólida
              </button>
              <button
                type="button"
                onClick={() =>
                  s.background.image ? s.setBackground({ mode: 'image' }) : fileRef.current?.click()
                }
                aria-pressed={s.background.mode === 'image'}
                className={choice(s.background.mode === 'image')}
              >
                Imagem personalizada
              </button>
              {s.background.image && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm text-link hover:underline"
                >
                  Trocar imagem
                </button>
              )}
              {s.background.mode === 'color' && (
                <input
                  type="color"
                  value={s.background.color}
                  onChange={(e) => s.setBackground({ color: e.target.value })}
                  aria-label="Cor do fundo"
                  className="h-8 w-10 cursor-pointer rounded border border-subtle bg-transparent"
                />
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void pickImage(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
            <p className="text-xs text-gray-400">
              A chamada de vídeo não carrega transparência: o fundo removido é preenchido com a cor
              ou a imagem escolhida.
            </p>
            {imageError && <p className="text-xs text-warning">{imageError}</p>}
          </div>

          <div className="space-y-2">
            <button type="button" onClick={() => setTesting((v) => !v)} className={choice(false)}>
              {testing ? 'Parar prévia' : 'Testar com a câmera'}
            </button>
            {error && <p className="text-xs text-warning">{error}</p>}
            {preview && (
              <div className="flex gap-2">
                <PreviewVideo stream={preview.original} label="Original" />
                <PreviewVideo stream={preview.result} label="Resultado" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChromaKeySettings
