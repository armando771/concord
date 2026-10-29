import { hintPositionClass } from '../features/overlay/lib/overlayDrag'
import type { OverlayBoxPx, OverlaySize } from '../features/overlay/lib/overlayLayout'
import {
  normalizeOverlayShortcut,
  overlayEditHint as editHint
} from '../features/overlay/lib/overlayShortcut'

/** Moldura do modo de edição: canto de redimensionar e a dica do atalho. */
function OverlayEditChrome({
  editing,
  pos,
  box,
  area,
  shortcut,
  onResizeStart
}: {
  editing: boolean
  pos: OverlayBoxPx
  box: OverlaySize
  area: OverlaySize
  shortcut: string
  onResizeStart: (e: React.PointerEvent) => void
}): React.JSX.Element | null {
  if (!editing) return null
  return (
    <>
      <div
        aria-label="Redimensionar"
        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-brand bg-floating"
        onPointerDown={onResizeStart}
      />
      <div
        className={`pointer-events-none absolute whitespace-nowrap rounded-md bg-floating px-2 py-1 text-xs font-medium text-normal ${hintPositionClass(pos, box, area)}`}
      >
        {editHint(normalizeOverlayShortcut(shortcut))}
      </div>
    </>
  )
}

export default OverlayEditChrome
