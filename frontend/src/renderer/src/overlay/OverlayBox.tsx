import { useEffect, useRef } from 'react'
import type { OverlaySnapshot } from '../features/overlay/lib/overlayState'
import { boxClassName } from '../features/overlay/lib/overlayDrag'
import {
  placeOverlayBox,
  shownOverlayLayout,
  type OverlayDraft,
  type OverlayFrame,
  type OverlayLayout,
  type OverlaySize
} from '../features/overlay/lib/overlayLayout'
import OverlayEditChrome from './OverlayEditChrome'
import OverlayList from './OverlayList'
import { useBoxDrag } from './useBoxDrag'

interface OverlayBoxProps {
  snapshot: OverlaySnapshot
  editing: boolean
  frame: OverlayFrame
  saved: OverlayLayout
  draft: OverlayDraft | null
  setDraft: (draft: OverlayDraft | null) => void
  box: OverlaySize
  setBox: (update: (prev: OverlaySize) => OverlaySize) => void
}

/** Tamanho da caixa (muda com a escala e com quem entra/sai) → estado e main. */
function useBoxSize(
  boxRef: React.RefObject<HTMLDivElement | null>,
  setBox: OverlayBoxProps['setBox']
): void {
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const size = { width: el.offsetWidth, height: el.offsetHeight }
      window.api?.overlay?.reportBox(size)
      setBox((prev) => (prev.width === size.width && prev.height === size.height ? prev : size))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [boxRef, setBox])
}

/**
 * A caixa da lista, posicionada em coordenadas da área de trabalho. No modo de
 * edição ganha moldura e aceita arrastar (mover) e o canto (redimensionar).
 */
function OverlayBox(props: OverlayBoxProps): React.JSX.Element {
  const { snapshot, editing, frame, saved, draft, setDraft, box, setBox } = props
  const { area, origin } = frame
  const boxRef = useRef<HTMLDivElement | null>(null)
  useBoxSize(boxRef, setBox)

  const layout = shownOverlayLayout(saved, draft)
  const pos = placeOverlayBox(layout.position, area, box)
  const { begin, onPointerMove, onPointerUp } = useBoxDrag({
    editing,
    boxRef,
    pos,
    box,
    layout,
    saved,
    area,
    setDraft
  })

  return (
    <div className="relative h-full w-full">
      <div
        ref={boxRef}
        // w-max (em boxClassName): a largura não depende da janela, que é do tamanho da caixa.
        className={boxClassName(editing)}
        // Escondida até medir: sem o tamanho, não dá para centralizar nem encaixar.
        style={{
          left: pos.left - origin.x,
          top: pos.top - origin.y,
          visibility: box.width ? 'visible' : 'hidden'
        }}
        onPointerDown={(e) => begin('move', e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex flex-col gap-1.5" style={{ zoom: layout.scale }}>
          <OverlayList snapshot={snapshot} />
        </div>
        <OverlayEditChrome
          editing={editing}
          pos={pos}
          box={box}
          area={area}
          shortcut={snapshot.shortcut}
          onResizeStart={(e) => begin('resize', e)}
        />
      </div>
    </div>
  )
}

export default OverlayBox
