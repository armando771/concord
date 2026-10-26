import { useDroppable } from '@dnd-kit/core'
import type { ProposalStatus } from '../api/proposals'
import { canDropOn } from '../lib/proposals'

/**
 * Coluna do quadro e também o alvo de soltar do card. Durante um arrasto ela
 * mostra se aceita o card (`dragFrom` é a coluna de origem): acende quando
 * aceita e fica tracejada com cursor de proibido quando não (Em votação não
 * reabre, e soltar na mesma coluna não faz nada). Nada
 * muda de tamanho durante o arrasto: o que estava embaixo do mouse continua lá.
 */
function BoardColumn({
  status,
  title,
  hint,
  count,
  dragFrom,
  children
}: {
  status: ProposalStatus
  title: string
  hint: string
  count: number
  dragFrom: ProposalStatus | null
  children: React.ReactNode
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const dragging = dragFrom != null
  const accepts = dragging && canDropOn(dragFrom, status)
  const isOrigin = dragging && dragFrom === status

  let state = 'border-subtle'
  if (accepts) state = isOver ? 'border-violet-400 bg-violet-500/10' : 'border-violet-400/30'
  else if (dragging && !isOrigin)
    state = `cursor-not-allowed border-dashed ${isOver ? 'border-red-400/70' : 'border-subtle'}`

  return (
    <section
      ref={setNodeRef}
      data-column={status}
      className={`flex min-h-0 min-w-64 flex-1 basis-64 flex-col rounded-2xl border bg-surface transition-colors ${state}`}
    >
      <div className="shrink-0 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-strong">{title}</h2>
          <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[11px] text-gray-300">
            {count}
          </span>
        </div>
        <p className="text-[11px] text-gray-500">
          {dragging && !accepts && !isOrigin && status === 'voting' ? 'A votação não reabre' : hint}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">{children}</div>
    </section>
  )
}

export default BoardColumn
