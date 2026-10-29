import { useCallback, useEffect, useRef } from 'react'
import { dragLayout, startBoxDrag, type BoxDrag } from '../features/overlay/lib/overlayDrag'
import type {
  OverlayBoxPx,
  OverlayDraft,
  OverlayLayout,
  OverlaySize
} from '../features/overlay/lib/overlayLayout'

interface BoxDragInput {
  editing: boolean
  boxRef: React.RefObject<HTMLDivElement | null>
  /** Onde a caixa está, o tamanho dela, o layout em uso e o salvo. */
  pos: OverlayBoxPx
  box: OverlaySize
  layout: OverlayLayout
  saved: OverlayLayout
  area: OverlaySize
  setDraft: (draft: OverlayDraft | null) => void
}

interface BoxDragHandlers {
  begin: (mode: BoxDrag['mode'], e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

/** Arrastar (mover/redimensionar) a caixa no modo de edição; salva ao soltar. */
export function useBoxDrag(input: BoxDragInput): BoxDragHandlers {
  const { editing, boxRef, pos, box, layout, saved, area, setDraft } = input
  const drag = useRef<BoxDrag | null>(null)
  const draftRef = useRef<OverlayDraft | null>(null)

  const commit = useCallback((): void => {
    drag.current = null
    const current = draftRef.current
    draftRef.current = null
    if (current) window.api?.overlay?.saveLayout(current.layout)
  }, [])

  // Saiu do modo de edição no meio do arraste (Esc/Shift+Tab): salva onde parou.
  useEffect(() => {
    if (!editing && drag.current) commit()
  }, [editing, commit])

  const begin = (mode: BoxDrag['mode'], e: React.PointerEvent): void => {
    if (!editing || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    boxRef.current?.setPointerCapture(e.pointerId)
    drag.current = startBoxDrag({
      mode,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pos,
      box,
      layout,
      area,
      saved
    })
    draftRef.current = null
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    const next = dragLayout(d, e.clientX - d.x0, e.clientY - d.y0, area)
    const nextDraft = { layout: next, base: d.base }
    draftRef.current = nextDraft
    setDraft(nextDraft)
  }

  const onPointerUp = (e: React.PointerEvent): void => {
    if (drag.current?.pointerId === e.pointerId) commit()
  }

  return { begin, onPointerMove, onPointerUp }
}
