import { useRef } from 'react'
import { dragWidth, keyStepWidth, type PanelSide, type WidthBounds } from '../lib/sidebarWidth'

export interface ResizeHandleProps {
  /** Lado da janela em que o painel fica (a alça vai na borda de dentro). */
  side: PanelSide
  width: number
  /** Limites de agora (dependem da janela e das outras barras). */
  bounds: WidthBounds
  onCommit: (width: number) => void
  onReset: () => void
  label: string
}

interface DragState {
  pointerId: number
  startX: number
  startWidth: number
  bounds: WidthBounds
  current: number
}

/**
 * Alça de redimensionar na borda de dentro de uma barra lateral: arrastar
 * (pointer capture), duplo clique volta ao padrão, setas ←/→ mudam 16 px.
 * Durante o arrasto só a variável CSS --panel-w do painel (o elemento pai)
 * muda — nada de re-render.
 */
function ResizeHandle({
  side,
  width,
  bounds,
  onCommit,
  onReset,
  label
}: ResizeHandleProps): React.JSX.Element {
  const handleRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)

  const apply = (w: number): void => {
    handleRef.current?.parentElement?.style.setProperty('--panel-w', `${w}px`)
    handleRef.current?.setAttribute('aria-valuenow', String(w))
  }

  const finish = (commit: boolean): void => {
    const d = drag.current
    if (!d) return
    drag.current = null
    handleRef.current?.removeAttribute('data-dragging')
    document.body.style.removeProperty('cursor')
    if (commit) {
      if (d.current !== d.startWidth) onCommit(d.current)
    } else {
      apply(d.startWidth)
    }
  }

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      tabIndex={0}
      title="Arraste para redimensionar (duplo clique volta ao padrão)"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startWidth: width,
          bounds,
          current: width
        }
        e.currentTarget.setAttribute('data-dragging', '')
        document.body.style.cursor = 'col-resize'
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || d.pointerId !== e.pointerId) return
        const next = dragWidth(d.startWidth, e.clientX - d.startX, side, d.bounds)
        if (next === d.current) return
        d.current = next
        apply(next)
      }}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onLostPointerCapture={() => finish(true)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const next = keyStepWidth(width, e.key, side, bounds)
        if (next === null) return
        e.preventDefault()
        onCommit(next)
      }}
      // Barra da esquerda: a alça fica logo depois da borda (dentro dela está a
      // barra de rolagem). Da direita: logo dentro, longe da rolagem do chat.
      className={`group/resize absolute inset-y-0 z-20 max-md:hidden w-1.5 cursor-col-resize touch-none outline-none ${
        side === 'left' ? 'left-full -ml-px' : 'left-0'
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover/resize:bg-fg/15 group-focus-visible/resize:bg-violet-500 group-data-dragging/resize:bg-violet-500"
      />
    </div>
  )
}

export default ResizeHandle
