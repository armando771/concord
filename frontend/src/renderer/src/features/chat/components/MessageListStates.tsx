import type { ReactNode } from 'react'
import { MessageListSkeleton } from '../../../shared/ui/skeleton/layouts'
import MusicEphemeralList from '../../music/components/MusicEphemeralList'
import PendingMessages from './PendingMessages'

/**
 * Lista da sala: o skeleton enquanto a primeira página carrega. closeRoom
 * apaga a lista ao sair do canal, então carregando é sempre a primeira carga.
 */
export function RoomLoadingGate({
  loading,
  children
}: {
  loading: boolean
  children: ReactNode
}): React.JSX.Element {
  return loading ? <MessageListSkeleton /> : <>{children}</>
}

/** Aviso da sala sem nenhuma mensagem. */
export function EmptyRoomNotice({ empty }: { empty: boolean }): React.JSX.Element | null {
  if (!empty) return null
  return (
    <div className="flex items-center justify-center py-8 text-center text-sm text-gray-500">
      Nenhuma mensagem por aqui ainda. Seja o primeiro a escrever!
    </div>
  )
}

/** Fim da lista: as minhas "enviando…", as respostas do Maestro e a marca do fim. */
export function MessageListTail({
  room,
  serverId,
  bottomRef
}: {
  room: string
  serverId?: string
  bottomRef: React.Ref<HTMLDivElement>
}): React.JSX.Element {
  return (
    <>
      <PendingMessages room={room} />
      <MusicEphemeralList room={room} serverId={serverId ?? null} />
      <div ref={bottomRef} />
    </>
  )
}

/** Aviso por cima do chat enquanto a pessoa arrasta arquivos para ele. */
export function DropOverlay({ visible }: { visible: boolean }): React.JSX.Element | null {
  if (!visible) return null
  return (
    <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-violet-400/70 bg-black/60 text-sm font-semibold text-white on-media">
      Solte os arquivos para enviar
    </div>
  )
}
