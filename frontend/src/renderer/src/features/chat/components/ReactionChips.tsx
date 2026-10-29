import { useCallback, useEffect, useRef, useState } from 'react'
import ReactionTooltip from './ReactionTooltip'
import { AddReactionIcon } from '../../../shared/ui/icons'

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

/** Pílula de uma reação, no tamanho do Discord: emoji de 20px e a contagem. */
function ReactionChip({
  reaction,
  meId,
  canReact,
  onToggle,
  onMouseEnter,
  onMouseLeave
}: {
  reaction: ReactionSummary
  meId: string | undefined
  canReact: boolean
  /** Põe ou tira a minha reação (só chega aqui quando é permitido). */
  onToggle: () => void
  onMouseEnter: (anchor: HTMLElement) => void
  onMouseLeave: () => void
}): React.JSX.Element {
  const meReacted = meId ? reaction.user_ids.includes(meId) : false
  // Sem permissão ainda dá para tirar a própria reação.
  const locked = !canReact && !meReacted
  const label = `${reaction.emoji}: ${reaction.count} ${reaction.count === 1 ? 'reação' : 'reações'}`
  return (
    <button
      type="button"
      // Sem `disabled`: botão desabilitado não dispara hover, e o popover
      // de "quem reagiu" precisa abrir também nesse chip.
      aria-disabled={locked || undefined}
      aria-pressed={meReacted}
      aria-label={label}
      onClick={() => {
        if (!locked) onToggle()
      }}
      onMouseEnter={(e) => onMouseEnter(e.currentTarget)}
      onMouseLeave={onMouseLeave}
      className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
        locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${
        meReacted
          ? 'border-brand bg-brand/15 hover:bg-brand/25'
          : 'border-transparent bg-fg/5 hover:border-strong hover:bg-fg/10'
      }`}
    >
      {/* Emoji (ou imagem de emoji) sempre em 20px. */}
      <span className="flex h-5 min-w-5 items-center justify-center text-[20px] leading-none [&>img]:h-5 [&>img]:w-5 [&>img]:object-contain">
        {reaction.emoji}
      </span>
      <span
        className={`min-w-[9px] text-ds-sm font-semibold tabular-nums ${
          meReacted ? 'text-brand' : 'text-gray-300'
        }`}
      >
        {reaction.count}
      </span>
    </button>
  )
}

/**
 * "Adicionar reação" no fim das pílulas: aparece ao passar o mouse na
 * mensagem (como no Discord), no foco do teclado e sempre no toque.
 */
function AddReactionChip({
  onClick
}: {
  /** Recebe o próprio botão: é nele que o seletor de emoji se ancora. */
  onClick: (button: HTMLElement) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.currentTarget)}
      title="Adicionar reação"
      aria-label="Adicionar reação"
      className="inline-flex h-7 w-9 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-fg/5 text-gray-400 transition-colors hover:border-strong hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-brand [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
    >
      <AddReactionIcon className="h-5 w-5" />
    </button>
  )
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
  /** Abre o seletor de emoji ancorado no botão "+" (`anchor`). */
  onOpenPicker: (anchor: HTMLElement) => void
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
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <ReactionChip
          key={reaction.emoji}
          reaction={reaction}
          meId={meId}
          canReact={canReact}
          onToggle={() => {
            onReact(reaction.emoji)
            // A própria última reação: o chip some, então o popover também.
            if (reaction.count <= 1 && meId && reaction.user_ids.includes(meId)) closeTooltip()
          }}
          onMouseEnter={(anchor) => openTooltip(reaction.emoji, anchor)}
          onMouseLeave={scheduleClose}
        />
      ))}
      {canReact && <AddReactionChip onClick={onOpenPicker} />}
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
