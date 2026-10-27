import {
  ChannelHeaderSkeleton,
  ComposerSkeleton,
  MemberListSkeleton,
  MessageListSkeleton
} from '../../../shared/ui/skeleton/layouts'
import { MembersAside } from './ServerMemberList'
import { serverLayoutClasses, type RightColumn } from '../lib/serverLayout'

interface ServerViewLayoutProps {
  /** O que ocupa a coluna da direita (decide a grade). */
  right: RightColumn
  /** Começo da barra de cima: título e ações do canal. */
  bar: React.ReactNode
  /** A busca, no canto direito da barra. */
  search: React.ReactNode
  content: React.ReactNode
  rightPanel: React.ReactNode
  /** Modais e sobreposições, fora da grade. */
  children?: React.ReactNode
}

/**
 * A tela do servidor como no Discord: a barra do canal atravessa o conteúdo e
 * a coluna da direita (a busca fica em cima dela); com o chat da call aberto,
 * ele toma a coluna da direita de cima a baixo e a barra fica só sobre a
 * chamada. As classes de cada caso estão em lib/serverLayout.
 */
function ServerViewLayout({
  right,
  bar,
  search,
  content,
  rightPanel,
  children
}: ServerViewLayoutProps): React.JSX.Element {
  const c = serverLayoutClasses(right)
  return (
    <div
      data-coluna-direita={right}
      className="grid h-full w-full grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-primary backdrop-blur-2xl text-gray-100"
    >
      <header className={c.header}>
        {/* relative: as fixadas abrem logo abaixo das ações. */}
        <div className="relative flex h-14 min-w-0 flex-1 items-center gap-2 pl-4 pr-2">
          {bar}
        </div>
        <div className={c.search}>{search}</div>
      </header>
      <div className={c.content}>{content}</div>
      <div className={c.right}>{rightPanel}</div>
      {children}
    </div>
  )
}

/** O mesmo desenho da tela pronta (barra, conteúdo e membros), em skeleton. */
export function ServerViewSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-primary text-gray-100">
      <ChannelHeaderSkeleton />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            <MessageListSkeleton label="Carregando servidor…" />
          </div>
          <ComposerSkeleton />
        </div>
        <MembersAside>
          <MemberListSkeleton />
        </MembersAside>
      </div>
    </div>
  )
}

export default ServerViewLayout
