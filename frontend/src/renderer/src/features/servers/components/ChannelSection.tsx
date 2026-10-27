import type { DropLineSide } from '../lib/channelDrop'
import { ChannelListSkeleton } from '../../../shared/ui/skeleton/layouts'
import { PlusIcon } from '../../../shared/ui/icons'

/** Linha de soltar (reordenar canais) acima ou abaixo do bloco do canal. */
export function ChannelDropLine({ side }: { side: DropLineSide }): React.JSX.Element | null {
  if (!side) return null
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-1 z-20 h-0.5 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.8)] ${
        side === 'before' ? '-top-0.5' : '-bottom-0.5'
      }`}
    />
  )
}

interface ChannelSectionProps {
  title: string
  /** "Criar canal de ..." (só aparece para quem gerencia canais). */
  addLabel: string
  onAdd?: () => void
  /** A lista já é deste servidor. */
  ready: boolean
  count: number
  emptyText: string
  skeleton: { count: number; offset?: number }
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void
  children: React.ReactNode
}

/** Uma seção da barra de canais (texto ou voz): título, "+", skeleton ou vazio e a lista. */
function ChannelSection({
  title,
  addLabel,
  onAdd,
  ready,
  count,
  emptyText,
  skeleton,
  onDragLeave,
  children
}: ChannelSectionProps): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between px-2">
        <p className="text-ds-sm font-medium text-gray-400">{title}</p>
        {onAdd && (
          <button
            onClick={onAdd}
            title={addLabel}
            aria-label={addLabel}
            className="cursor-pointer rounded-md p-0.5 text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong [@media(pointer:coarse)]:-my-2 [@media(pointer:coarse)]:p-2.5"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-col gap-0.5" onDragLeave={onDragLeave}>
        {!ready && <ChannelListSkeleton count={skeleton.count} offset={skeleton.offset} />}
        {ready && count === 0 && (
          <p className="px-2 text-ds-sm text-gray-500 italic">{emptyText}</p>
        )}
        {children}
      </div>
    </div>
  )
}

export default ChannelSection
