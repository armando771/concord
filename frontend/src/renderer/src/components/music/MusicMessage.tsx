import type { Message } from '../../api/messages'
import { splitMentions } from '../../lib/mentions'
import { MAESTRO_NAME, splitBold, T18 } from '../../lib/music'
import MaestroAvatar from './MaestroAvatar'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Texto do Maestro: **negrito** e @menções destacadas. */
export function MaestroText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {splitBold(text).map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-bold text-strong">
            {part.text}
          </strong>
        ) : (
          splitMentions(part.text).map((m, j) =>
            m.mention ? (
              <span key={`${i}-${j}`} className="rounded bg-brand/30 px-0.5 font-medium text-brand">
                {m.text}
              </span>
            ) : (
              <span key={`${i}-${j}`}>{m.text}</span>
            )
          )
        )
      )}
    </>
  )
}

function MusicMessage({ message }: { message: Message }): React.JSX.Element {
  return (
    <div
      id={`msg-${message.id}`}
      className="mx-2 my-1 flex gap-3 rounded-lg border border-violet-400/20 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent px-3 py-2.5"
    >
      <MaestroAvatar />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-violet-200">{MAESTRO_NAME}</span>
          <span className="rounded bg-violet-400/20 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-violet-200">
            {T18.tag}
          </span>
          <span className="text-[10px] text-gray-500">{formatTime(message.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-100">
          <MaestroText text={message.content} />
        </p>
      </div>
    </div>
  )
}

export default MusicMessage
