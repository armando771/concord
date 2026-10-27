import {
  ChannelHeaderSkeleton,
  ComposerSkeleton,
  MessageListSkeleton
} from '../../../shared/ui/skeleton/layouts'

const MAIN_BG = 'var(--bg-primary)'

/**
 * No lugar do grupo enquanto ele não aparece: o esqueleto, antes da primeira
 * resposta da lista (ainda não dá para saber se existe), ou o aviso de que
 * a conversa não existe.
 */
function GroupChatPlaceholder({ loaded }: { loaded: boolean }): React.JSX.Element {
  if (!loaded) {
    return (
      <div className="flex h-full flex-1 flex-col" style={{ background: MAIN_BG }}>
        <ChannelHeaderSkeleton />
        <div className="min-h-0 flex-1">
          <MessageListSkeleton label="Abrindo conversa…" />
        </div>
        <ComposerSkeleton />
      </div>
    )
  }
  return (
    <div
      className="flex h-full flex-1 items-center justify-center text-ds-md text-gray-400"
      style={{ background: MAIN_BG }}
    >
      Conversa não encontrada.
    </div>
  )
}

export default GroupChatPlaceholder
