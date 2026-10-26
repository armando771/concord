import { MAX_ZOOM, MIN_ZOOM } from '../../profile/lib/imageCrop'

export function ZoomSlider({
  zoom,
  onZoom
}: {
  zoom: number
  onZoom: (zoom: number) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-6 pt-4">
      <span className="text-xs text-gray-400">−</span>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={(e) => onZoom(Number(e.target.value))}
        aria-label="Zoom"
        className="flex-1 accent-brand"
      />
      <span className="text-sm text-gray-400">+</span>
    </div>
  )
}

export function CropFooter({
  busy,
  canApply,
  onReset,
  onCancel,
  onApply
}: {
  busy: boolean
  canApply: boolean
  onReset: () => void
  onCancel: () => void
  onApply: () => void
}): React.JSX.Element {
  return (
    <div className="mt-5 flex items-center justify-end gap-2 rounded-b-xl bg-input px-5 py-4">
      <button
        type="button"
        onClick={onReset}
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
        onClick={onApply}
        disabled={busy || !canApply}
        className="cursor-pointer rounded-md bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? 'Aplicando...' : 'Aplicar'}
      </button>
    </div>
  )
}
