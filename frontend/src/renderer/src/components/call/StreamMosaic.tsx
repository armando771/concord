import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStreamLayoutStore } from '../../store/streamLayoutStore'
import {
  adaptToSize,
  GUTTER,
  leafIds,
  minExtent,
  syncLayout,
  type DropSide,
  type LayoutNode,
  type LayoutPreset
} from '../../lib/streamLayout'

const DRAG_TYPE = 'application/x-concord-stream'

interface StreamMosaicProps {
  /** Quem está transmitindo, na ordem de chegada. */
  ids: string[]
  renderTile: (id: string) => ReactNode
  /** Nome de quem transmite (rótulos de arrastar/soltar). */
  nameOf: (id: string) => string
}

const PRESET_OPTIONS: { preset: LayoutPreset; label: string; cells: string }[] = [
  { preset: 'grid', label: 'Grade', cells: 'grid-cols-2 grid-rows-2' },
  { preset: 'row', label: 'Lado a lado', cells: 'grid-cols-4 grid-rows-1' },
  { preset: 'column', label: 'Empilhado', cells: 'grid-cols-1 grid-rows-3' },
  { preset: 'focus', label: 'Destaque', cells: 'grid-cols-[2fr_1fr] grid-rows-2' }
]

/** Miniatura do formato (quadradinhos) usada nos botões. */
function PresetGlyph({
  preset,
  cells
}: {
  preset: LayoutPreset
  cells: string
}): React.JSX.Element {
  const count = preset === 'column' || preset === 'focus' ? 3 : 4
  return (
    <span className={`grid h-3.5 w-5 gap-px ${cells}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`rounded-[1px] bg-current ${preset === 'focus' && i === 0 ? 'row-span-2' : ''}`}
        />
      ))}
    </span>
  )
}

/** Lado em que o ponteiro está sobre um bloco: bordas (25%) ou centro. */
function dropSideAt(e: React.DragEvent<HTMLElement>): DropSide {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  const edges: [DropSide, number][] = [
    ['left', x],
    ['right', 1 - x],
    ['top', y],
    ['bottom', 1 - y]
  ]
  const [side, distance] = edges.reduce((best, cur) => (cur[1] < best[1] ? cur : best))
  return distance < 0.25 ? side : 'center'
}

const DROP_HIGHLIGHT: Record<DropSide, string> = {
  center: 'inset-0',
  left: 'inset-y-0 left-0 w-1/2',
  right: 'inset-y-0 right-0 w-1/2',
  top: 'inset-x-0 top-0 h-1/2',
  bottom: 'inset-x-0 bottom-0 h-1/2'
}

const DROP_LABEL: Record<DropSide, string> = {
  center: 'Trocar de lugar',
  left: 'Colocar à esquerda',
  right: 'Colocar à direita',
  top: 'Colocar acima',
  bottom: 'Colocar abaixo'
}

function Leaf({
  id,
  renderTile,
  name
}: {
  id: string
  renderTile: (id: string) => ReactNode
  name: string
}): React.JSX.Element {
  const move = useStreamLayoutStore((s) => s.move)
  const [drop, setDrop] = useState<DropSide | null>(null)

  return (
    <div
      className="group relative flex h-full w-full items-center justify-center [container-type:size]"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDrop(dropSideAt(e))
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop(null)
      }}
      onDrop={(e) => {
        const dragged = e.dataTransfer.getData(DRAG_TYPE)
        const side = dropSideAt(e)
        setDrop(null)
        if (dragged && dragged !== id) {
          e.preventDefault()
          move(dragged, id, side)
        }
      }}
    >
      {renderTile(id)}

      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={(e) => e.stopPropagation()}
        title="Arraste para mover esta transmissão"
        aria-label={`Mover a transmissão de ${name}`}
        className="absolute left-2 top-2 z-20 flex h-7 cursor-grab items-center gap-1 rounded-md bg-black/60 px-1.5 text-gray-200 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 hover:text-white focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          {[2, 6, 10].flatMap((y) =>
            [4, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />)
          )}
        </svg>
        <span className="text-[10px] font-semibold">Mover</span>
      </button>

      {drop && (
        <div className="pointer-events-none absolute inset-0 z-30 rounded-2xl ring-2 ring-[#5865f2]/60">
          <div
            className={`absolute flex items-center justify-center rounded-2xl bg-[#5865f2]/30 transition-all ${DROP_HIGHLIGHT[drop]}`}
          >
            <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
              {DROP_LABEL[drop]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function Divider({
  direction,
  onDrag,
  onReset
}: {
  direction: 'row' | 'column'
  /** Deslocamento em px desde o último movimento. */
  onDrag: (deltaPx: number) => void
  onReset: () => void
}): React.JSX.Element {
  const last = useRef<number | null>(null)
  const horizontal = direction === 'row'

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      title="Arraste para redimensionar · duplo clique para igualar"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = horizontal ? e.clientX : e.clientY
      }}
      onPointerMove={(e) => {
        if (last.current === null) return
        const pos = horizontal ? e.clientX : e.clientY
        const delta = pos - last.current
        if (delta !== 0) {
          last.current = pos
          onDrag(delta)
        }
      }}
      onPointerUp={(e) => {
        last.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onDoubleClick={onReset}
      style={horizontal ? { width: GUTTER } : { height: GUTTER }}
      className={`group/divider relative flex shrink-0 touch-none items-center justify-center ${
        horizontal ? 'cursor-col-resize' : 'cursor-row-resize'
      }`}
    >
      <span
        className={`rounded-full bg-white/10 transition-colors group-hover/divider:bg-[#5865f2] group-active/divider:bg-[#5865f2] ${
          horizontal ? 'h-10 w-1' : 'h-1 w-10'
        }`}
      />
    </div>
  )
}

function NodeView({
  node,
  path,
  width,
  height,
  renderTile,
  nameOf
}: {
  node: LayoutNode
  path: number[]
  width: number
  height: number
  renderTile: (id: string) => ReactNode
  nameOf: (id: string) => string
}): React.JSX.Element {
  const resize = useStreamLayoutStore((s) => s.resize)
  const equalize = useStreamLayoutStore((s) => s.equalize)

  if (node.type === 'leaf') {
    return <Leaf id={node.id} renderTile={renderTile} name={nameOf(node.id)} />
  }

  const horizontal = node.direction === 'row'
  const axis = horizontal ? width : height
  const usable = Math.max(1, axis - GUTTER * (node.children.length - 1))
  const mins = node.children.map((c) => minExtent(c, node.direction) / usable)

  return (
    <div className={`flex h-full w-full min-h-0 min-w-0 ${horizontal ? 'flex-row' : 'flex-col'}`}>
      {node.children.map((child, i) => (
        <div key={leafIds(child).join('|')} className="contents">
          {i > 0 && (
            <Divider
              direction={node.direction}
              onDrag={(deltaPx) => resize(path, i - 1, deltaPx / usable, mins)}
              onReset={() => equalize(path)}
            />
          )}
          <div className="min-h-0 min-w-0" style={{ flex: `${node.sizes[i]} 1 0px` }}>
            <NodeView
              node={child}
              path={[...path, i]}
              width={horizontal ? usable * node.sizes[i] : width}
              height={horizontal ? height : usable * node.sizes[i]}
              renderTile={renderTile}
              nameOf={nameOf}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Mosaico das transmissões (multistream): cada tela compartilhada ocupa um
 * bloco; dá para redimensionar pelas divisórias, arrastar para outro lugar
 * e escolher um formato pronto. Os blocos nunca passam das bordas nem ficam
 * menores que o mínimo, e o arranjo se adapta ao tamanho da janela.
 */
function StreamMosaic({ ids, renderTile, nameOf }: StreamMosaicProps): React.JSX.Element {
  const stored = useStreamLayoutStore((s) => s.layout)
  const preset = useStreamLayoutStore((s) => s.preset)
  const sync = useStreamLayoutStore((s) => s.sync)
  const applyPreset = useStreamLayoutStore((s) => s.applyPreset)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const idsKey = ids.join('|')

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = (): void => setSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    sync(idsKey ? idsKey.split('|') : [])
  }, [idsKey, sync])

  // Enquanto o store não acompanhou a lista nova, mostra o que ele vai virar.
  const layout = useMemo(() => {
    const current = idsKey ? idsKey.split('|') : []
    const inStore = leafIds(stored)
    const same = inStore.length === current.length && current.every((id) => inStore.includes(id))
    return same ? stored : syncLayout(stored, current, preset)
  }, [stored, idsKey, preset])

  const view = layout && size.width > 0 ? adaptToSize(layout, size.width, size.height) : layout

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
      {ids.length > 1 && (
        <div className="flex shrink-0 items-center justify-end gap-2">
          <span className="hidden text-[11px] text-gray-500 md:inline">
            Arraste as divisórias para redimensionar · use “Mover” para reorganizar
          </span>
          <div
            role="group"
            aria-label="Formato das transmissões"
            className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5"
          >
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.preset}
                type="button"
                onClick={() => applyPreset(option.preset, ids)}
                title={option.label}
                aria-label={option.label}
                aria-pressed={preset === option.preset}
                className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors ${
                  preset === option.preset
                    ? 'bg-[#5865f2] text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <PresetGlyph preset={option.preset} cells={option.cells} />
                <span className="hidden lg:inline">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {view && (
          <NodeView
            node={view}
            path={[]}
            width={size.width}
            height={size.height}
            renderTile={renderTile}
            nameOf={nameOf}
          />
        )}
      </div>
    </div>
  )
}

export default StreamMosaic
