import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStreamLayoutStore } from '../store/streamLayoutStore'
import {
  adaptToSize,
  featuredLeaf,
  GUTTER,
  leafIds,
  minExtent,
  syncLayout,
  type LayoutNode,
  type LayoutPreset
} from '../lib/streamLayout'

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

/**
 * Como se reorganiza cada formato: no Destaque, clicar numa transmissão a
 * leva para o bloco grande; nos demais, arrastar uma sobre a outra troca as
 * duas de lugar. Com uma transmissão só não há o que reorganizar.
 */
export type TileInteraction = 'swap' | 'feature' | 'none'

function Leaf({
  id,
  renderTile,
  name,
  interaction,
  featured
}: {
  id: string
  renderTile: (id: string) => ReactNode
  name: string
  interaction: TileInteraction
  /** Está no bloco grande do Destaque. */
  featured: boolean
}): React.JSX.Element {
  const swap = useStreamLayoutStore((s) => s.swap)
  const feature = useStreamLayoutStore((s) => s.feature)
  const [over, setOver] = useState(false)
  const [dragging, setDragging] = useState(false)
  const canDrag = interaction === 'swap'
  const clickToFeature = interaction === 'feature' && !featured

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => {
        if (!canDrag || dragging || !e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        const dragged = e.dataTransfer.getData(DRAG_TYPE)
        setOver(false)
        if (dragged && dragged !== id) {
          e.preventDefault()
          swap(dragged, id)
        }
      }}
      // No Destaque, o clique numa transmissão pequena a põe em destaque em
      // vez de abrir o modo foco (botões dentro do bloco continuam valendo).
      onClickCapture={(e) => {
        if (!clickToFeature) return
        if ((e.target as HTMLElement).closest('button')) return
        e.stopPropagation()
        feature(id)
      }}
      title={
        canDrag
          ? 'Arraste sobre outra transmissão para trocar de lugar'
          : clickToFeature
            ? 'Clique para pôr em destaque'
            : undefined
      }
      className={`relative flex h-full w-full items-center justify-center transition-opacity [container-type:size] ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : clickToFeature ? 'cursor-pointer' : ''
      } ${dragging ? 'opacity-40' : ''}`}
    >
      {renderTile(id)}

      {over && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-brand/30 ring-2 ring-brand">
          <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white on-media">
            Trocar com {name}
          </span>
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
        className={`rounded-full bg-fg/10 transition-colors group-hover/divider:bg-brand group-active/divider:bg-brand ${
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
  nameOf,
  interaction,
  featuredId
}: {
  node: LayoutNode
  path: number[]
  width: number
  height: number
  renderTile: (id: string) => ReactNode
  nameOf: (id: string) => string
  interaction: TileInteraction
  /** Quem está no bloco grande do Destaque. */
  featuredId: string | null
}): React.JSX.Element {
  const resize = useStreamLayoutStore((s) => s.resize)
  const equalize = useStreamLayoutStore((s) => s.equalize)

  if (node.type === 'leaf') {
    return (
      <Leaf
        id={node.id}
        renderTile={renderTile}
        name={nameOf(node.id)}
        interaction={interaction}
        featured={node.id === featuredId}
      />
    )
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
              interaction={interaction}
              featuredId={featuredId}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Mosaico das transmissões (multistream): cada tela/câmera ocupa um bloco.
 * O formato vem dos botões (Grade, Lado a lado, Empilhado, Destaque). No
 * Destaque, clicar numa transmissão a leva para o bloco grande; nos demais,
 * arrastar uma sobre a outra troca as duas de lugar. As divisórias
 * redimensionam. Os blocos nunca passam das bordas
 * nem ficam menores que o mínimo, e o arranjo se adapta ao tamanho da janela.
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
        <div className="flex shrink-0 items-center justify-start gap-2">
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
                    ? 'bg-brand text-white'
                    : 'text-gray-400 hover:bg-fg/10 hover:text-strong'
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
            interaction={ids.length < 2 ? 'none' : preset === 'focus' ? 'feature' : 'swap'}
            featuredId={preset === 'focus' ? featuredLeaf(layout) : null}
          />
        )}
      </div>
    </div>
  )
}

export default StreamMosaic
