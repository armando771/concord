import type { PinnedMessage } from '../api/messages'
import { PinIcon } from '../../../shared/ui/icons'
import { messageAuthorName, morePinsLabel, pinnedPreview } from '../lib/chatPaneView'

/** Barra com a última mensagem fixada no topo do canal; clicar pula até ela. */
export default function PinnedMessageBar({
  pins,
  nicknames,
  onJump
}: {
  /** Fixadas do canal, a mais recente primeiro. */
  pins: PinnedMessage[]
  nicknames: Record<string, string> | undefined
  onJump: (messageId: string) => void
}): React.JSX.Element | null {
  const latestPin = pins[0]
  if (!latestPin) return null
  const more = morePinsLabel(pins.length)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onJump(latestPin.id)}
      onKeyDown={(e) => e.key === 'Enter' && onJump(latestPin.id)}
      title="Clique para ir até a mensagem fixada"
      className="group relative z-10 flex shrink-0 cursor-pointer items-center justify-between border-b border-subtle bg-floating px-4 py-2 backdrop-blur transition hover:bg-surface"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400/15 text-amber-400">
          <PinIcon className="h-3.5 w-3.5" />
        </span>
        <div className="flex min-w-0 items-center gap-1.5 text-ds-xs">
          <span className="shrink-0 font-semibold text-strong">
            {messageAuthorName(latestPin, nicknames)}:
          </span>
          <span className="truncate text-gray-300">{pinnedPreview(latestPin)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-3">
        {more && (
          <span className="rounded bg-fg/5 px-2 py-0.5 text-[10px] font-medium text-gray-400">
            {more}
          </span>
        )}
        <span className="text-[11px] font-medium text-violet-400 opacity-80 group-hover:opacity-100 group-hover:underline">
          Ir para mensagem →
        </span>
      </div>
    </div>
  )
}
