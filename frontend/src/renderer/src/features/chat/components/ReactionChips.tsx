import { useCallback, useEffect, useRef, useState } from 'react'
import ReactionTooltip from './ReactionTooltip'

export interface ReactionSummary {
  emoji: string
  count: number
  user_ids: string[]
}

/** Espera antes de abrir: não abre o popover só de passar por cima do chip. */
const HOVER_OPEN_MS = 120
/** Tolerância para o mouse sair do chip e entrar no popover. */
const HOVER_CLOSE_MS = 120

/** Chip do popover aberto: o emoji e o chip que serve de âncora. */
interface HoveredReaction {
  emoji: string
  anchor: HTMLElement
}

/** Chips de reação sob a mensagem, com o "+" para abrir o seletor de emoji. */
function ReactionChips({
  reactions,
  meId,
  canReact,
  serverId,
  onReact,
  onOpenPicker
}: {
  reactions: ReactionSummary[]
  meId: string | undefined
  /** Sem permissão ainda dá para tirar a própria reação. */
  canReact: boolean
  /** Canal de servidor: o "quem reagiu" usa o apelido de lá. */
  serverId?: string
  onReact: (emoji: string) => void
  onOpenPicker: () => void
}): React.JSX.Element | null {
  const [hovered, setHovered] = useState<HoveredReaction | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelOpen = useCallback(() => {
    if (openTimer.current !== null) {
      clearTimeout(openTimer.current)
      openTimer.current = null
    }
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const closeTooltip = useCallback(() => setHovered(null), [])

  const openTooltip = useCallback(
    (emoji: string, anchor: HTMLElement) => {
      cancelClose()
      cancelOpen()
      openTimer.current = setTimeout(() => {
        openTimer.current = null
        setHovered({ emoji, anchor })
      }, HOVER_OPEN_MS)
    },
    [cancelClose, cancelOpen]
  )

  // O mouse pode sair do chip e entrar no popover: fecha só depois de um instante.
  const scheduleClose = useCallback(() => {
    cancelOpen()
    cancelClose()
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      closeTooltip()
    }, HOVER_CLOSE_MS)
  }, [cancelOpen, cancelClose, closeTooltip])

  useEffect(
    () => () => {
      cancelOpen()
      cancelClose()
    },
    [cancelOpen, cancelClose]
  )

  if (reactions.length === 0) return null

  const hoveredReaction = hovered
    ? reactions.find((reaction) => reaction.emoji === hovered.emoji)
    : undefined

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const meReacted = meId ? reaction.user_ids.includes(meId) : false
        const locked = !canReact && !meReacted
        return (
          <button
            key={reaction.emoji}
            type="button"
            // Sem `disabled`: botão desabilitado não dispara hover, e o popover
            // de "quem reagiu" precisa abrir também nesse chip.
            aria-disabled={locked || undefined}
            onClick={() => {
              if (locked) return
              onReact(reaction.emoji)
              // A própria última reação: o chip some, então o popover também.
              if (meReacted && reaction.count <= 1) closeTooltip()
            }}
            onMouseEnter={(e) => openTooltip(reaction.emoji, e.currentTarget)}
            onMouseLeave={scheduleClose}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
              locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${
              meReacted
                ? 'border-brand bg-brand/25 text-strong'
                : 'border-subtle bg-fg/5 text-gray-300 hover:bg-fg/10'
            }`}
          >
            <span>{reaction.emoji}</span>
            <span className="font-semibold">{reaction.count}</span>
          </button>
        )
      })}
      {canReact && (
        <button
          type="button"
          onClick={onOpenPicker}
          title="Adicionar reação"
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-subtle bg-fg/5 text-xs text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
        >
          +
        </button>
      )}
      {hovered && hoveredReaction && hoveredReaction.user_ids.length > 0 && (
        <ReactionTooltip
          emoji={hoveredReaction.emoji}
          userIds={hoveredReaction.user_ids}
          anchor={hovered.anchor}
          serverId={serverId}
          meId={meId}
          onClose={closeTooltip}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  )
}

export default ReactionChips
