import type { Message } from '../api/messages'
import { splitMentions } from '../lib/mentions'
import { useServerStore } from '../store/serverStore'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Mensagem enviada pelo próprio servidor (ex.: feliz aniversário): aparece
 * com o nome do servidor, não de quem responde por ele, e com o nome do
 * servidor em destaque no texto.
 */
function SystemMessage({ message }: { message: Message }): React.JSX.Element {
  const serverName = useServerStore((s) => s.currentServer?.name) ?? 'Servidor'
  const marker = `O servidor ${serverName}`
  const at = message.content.indexOf(marker)

  const renderText = (text: string, offset: number): React.ReactNode[] =>
    splitMentions(text).map((part, i) =>
      part.mention ? (
        <span
          key={`${offset}-${i}`}
          className="rounded bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]"
        >
          {part.text}
        </span>
      ) : (
        <span key={`${offset}-${i}`}>{part.text}</span>
      )
    )

  return (
    <div
      id={`msg-${message.id}`}
      className="mx-2 my-1 flex gap-3 rounded-lg border border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-pink-500/5 to-transparent px-3 py-2.5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500 text-ds-md font-bold text-white shadow-md">
        {serverName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-ds-chat font-medium text-amber-200">{serverName}</span>
          <span className="rounded bg-amber-400/20 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-amber-200">
            Servidor
          </span>
          <span className="text-ds-xs font-medium text-gray-500">
            {formatTime(message.created_at)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-ds-chat text-gray-100">
          {at >= 0 ? (
            <>
              {renderText(message.content.slice(0, at), 0)}O servidor{' '}
              <strong className="font-bold text-white">{serverName}</strong>
              {renderText(message.content.slice(at + marker.length), 1)}
            </>
          ) : (
            renderText(message.content, 0)
          )}
        </p>
      </div>
    </div>
  )
}

export default SystemMessage
