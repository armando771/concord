import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AVATAR_OUTPUT,
  BANNER_OUTPUT,
  MAX_ZOOM,
  MIN_ZOOM,
  clampOffset,
  coverScale,
  sourceRect,
  type Point,
  type Size
} from '../../profile/lib/imageCrop'
import { cropMedia } from '../../profile/lib/cropMedia'
import type { MediaChange } from '../../profile/lib/profileValidation'

export type ImageKind = 'avatar' | 'banner'

/** Quadro do recorte na tela (o banner tem a proporção do Discord, 17:6). */
const FRAME: Record<ImageKind, Size> = {
  avatar: { width: 300, height: 300 },
  banner: { width: 476, height: 168 }
}
const OUTPUT: Record<ImageKind, Size> = { avatar: AVATAR_OUTPUT, banner: BANNER_OUTPUT }
/**
 * "Editar imagem" do Discord: arrastar e zoom antes de aplicar. GIF também
 * recorta: cada quadro é recortado e a animação continua.
 */
function ImageCropModal({
  file,
  src,
  kind,
  onCancel,
  onApply
}: {
  file: File
  /** URL local do arquivo (quem abre cria e libera). */
  src: string
  kind: ImageKind
  onCancel: () => void
  onApply: (change: Extract<MediaChange, { kind: 'set' }>) => void
}): React.JSX.Element {
  const frame = FRAME[kind]
  const [natural, setNatural] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ start: Point; from: Point } | null>(null)

  // ESC fecha só o recorte, não as Configurações por trás (captura + preventDefault).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const scale = natural ? coverScale(natural, frame) * zoom : 1
  const shown = natural ? clampOffset(natural, frame, zoom, offset) : { x: 0, y: 0 }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (!natural) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { start: { x: e.clientX, y: e.clientY }, from: shown }
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!drag.current || !natural) return
    const { start, from } = drag.current
    setOffset(
      clampOffset(natural, frame, zoom, {
        x: from.x + e.clientX - start.x,
        y: from.y + e.clientY - start.y
      })
    )
  }
  const endDrag = (): void => {
    drag.current = null
  }

  const apply = async (): Promise<void> => {
    if (!natural || !imgRef.current) return
    setBusy(true)
    setError(null)
    try {
      const out = OUTPUT[kind]
      onApply(await cropMedia(file, imgRef.current, sourceRect(natural, frame, zoom, offset), out))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar essa imagem.')
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="app-no-drag fixed inset-x-0 bottom-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      style={{ top: 'var(--titlebar-height, 0px)' }}
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar imagem"
        className="w-full max-w-[540px] rounded-xl border border-subtle bg-floating shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5">
          <h2 className="text-lg font-bold text-strong">Editar imagem</h2>
        </div>

        <div className="mt-4 flex justify-center bg-black/40 py-6">
          <div
            className={`relative overflow-hidden ${kind === 'avatar' ? 'rounded-full' : 'rounded-lg'} cursor-grab active:cursor-grabbing`}
            style={{ width: frame.width, height: frame.height, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNatural({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight
                })
              }
              onError={() => setError('Não foi possível abrir essa imagem.')}
              className="absolute max-w-none select-none"
              style={
                !natural
                  ? undefined
                  : {
                      width: natural.width * scale,
                      height: natural.height * scale,
                      left: (frame.width - natural.width * scale) / 2 + shown.x,
                      top: (frame.height - natural.height * scale) / 2 + shown.y
                    }
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pt-4">
          <span className="text-xs text-gray-400">−</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-brand"
          />
          <span className="text-sm text-gray-400">+</span>
        </div>
        {error && <p className="px-6 pt-3 text-xs text-danger">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-2 rounded-b-xl bg-input px-5 py-4">
          <button
            type="button"
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
            className="mr-auto cursor-pointer text-sm text-gray-300 hover:underline"
          >
            Redefinir
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-md px-4 py-2 text-sm text-strong hover:underline"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy || !natural}
            className="cursor-pointer rounded-md bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? 'Aplicando...' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ImageCropModal
