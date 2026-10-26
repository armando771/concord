import {
  useAnnotationStore,
  selectMyStrokeIds,
  PRESET_COLORS,
  PRESET_WIDTHS,
  type AnnotationTool
} from '../../store/annotationStore'
import {
  PencilIcon,
  HighlighterIcon,
  LaserIcon,
  EraserIcon,
  UndoIcon,
  TrashIcon,
  XIcon
} from '../icons'

interface ScreenAnnotationToolbarProps {
  sharerId: string
  callId: string
  onClose: () => void
  className?: string
}

export default function ScreenAnnotationToolbar({
  sharerId,
  callId,
  onClose,
  className = ''
}: ScreenAnnotationToolbarProps): React.JSX.Element {
  const tool = useAnnotationStore((s) => s.tool)
  const setTool = useAnnotationStore((s) => s.setTool)
  const color = useAnnotationStore((s) => s.color)
  const setColor = useAnnotationStore((s) => s.setColor)
  const width = useAnnotationStore((s) => s.width)
  const setWidth = useAnnotationStore((s) => s.setWidth)
  const undo = useAnnotationStore((s) => s.undo)
  const clear = useAnnotationStore((s) => s.clear)
  const myStrokes = useAnnotationStore(selectMyStrokeIds(sharerId))

  const tools: { id: AnnotationTool; label: string; icon: React.ReactNode }[] = [
    { id: 'pen', label: 'Caneta', icon: <PencilIcon className="h-4 w-4" /> },
    { id: 'highlighter', label: 'Marca-texto', icon: <HighlighterIcon className="h-4 w-4" /> },
    { id: 'laser', label: 'Laser (Desaparece)', icon: <LaserIcon className="h-4 w-4" /> },
    { id: 'eraser', label: 'Borracha', icon: <EraserIcon className="h-4 w-4" /> }
  ]

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`z-30 flex items-center gap-2 rounded-2xl border border-subtle bg-floating px-3 py-1.5 shadow-2xl backdrop-blur-md select-none text-strong transition-all ${className}`}
    >
      {/* Ferramentas de traço */}
      <div className="flex items-center gap-1 border-r border-subtle pr-2">
        {tools.map((t) => {
          const isActive = tool === t.id
          return (
            <button
              key={t.id}
              type="button"
              title={t.label}
              onClick={() => setTool(t.id)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'bg-fg/20 text-strong shadow-sm ring-1 ring-fg/30'
                  : 'text-gray-400 hover:bg-fg/10 hover:text-gray-200'
              }`}
            >
              {t.icon}
            </button>
          )
        })}
      </div>

      {/* Cores */}
      {tool !== 'eraser' && (
        <div className="flex items-center gap-1.5 border-r border-subtle pr-2">
          {PRESET_COLORS.map((c) => {
            const isSelected = color === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-4.5 w-4.5 rounded-full transition-transform ${
                  isSelected
                    ? 'scale-125 ring-2 ring-white shadow-md'
                    : 'opacity-80 hover:scale-110 hover:opacity-100'
                }`}
              />
            )
          })}
        </div>
      )}

      {/* Espessura */}
      {tool !== 'eraser' && (
        <div className="flex items-center gap-1 border-r border-subtle pr-2">
          {PRESET_WIDTHS.map((w) => {
            const isSelected = width === w
            return (
              <button
                key={w}
                type="button"
                title={`Espessura ${w}px`}
                onClick={() => setWidth(w)}
                className={`flex h-7 w-6 items-center justify-center rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-fg/20 text-strong ring-1 ring-fg/30'
                    : 'text-gray-400 hover:bg-fg/10'
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{
                    width: `${Math.max(3, w)}px`,
                    height: `${Math.max(3, w)}px`
                  }}
                />
              </button>
            )
          })}
        </div>
      )}

      {/* Ações: Desfazer e Limpar */}
      <div className="flex items-center gap-1 border-r border-subtle pr-2">
        <button
          type="button"
          title="Desfazer meu último traço"
          disabled={myStrokes.length === 0}
          onClick={() => undo(callId, sharerId)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            myStrokes.length > 0
              ? 'text-gray-300 hover:bg-fg/10 hover:text-strong cursor-pointer'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <UndoIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          title="Limpar todas as anotações"
          onClick={() => clear(callId, sharerId)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Fechar modo desenho */}
      <button
        type="button"
        title="Fechar ferramentas de desenho"
        onClick={onClose}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
