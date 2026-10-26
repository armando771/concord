import { useEffect, useState } from 'react'
import { serverIconSrc } from '../lib/serverIcon'
import Button from '../../../shared/ui/Button'
import { InboxIcon } from '../../../shared/ui/icons'
import { InviteListSkeleton } from '../../../shared/ui/skeleton/layouts'
import { useInviteStore } from '../store/inviteStore'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../../../shared/store/toastStore'

function Invites(): React.JSX.Element {
  const invites = useInviteStore((s) => s.invites)
  const loading = useInviteStore((s) => s.loading)
  const fetchInvites = useInviteStore((s) => s.fetchInvites)
  const acceptInvite = useInviteStore((s) => s.accept)
  const declineInvite = useInviteStore((s) => s.decline)
  const fetchServers = useServerStore((s) => s.fetchServers)

  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  const handleAccept = async (inviteId: string, serverName: string): Promise<void> => {
    setActionId(inviteId)
    try {
      await acceptInvite(inviteId)
      await fetchServers()
      showToast.success(`Você entrou no servidor ${serverName}!`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao aceitar o convite.')
    } finally {
      setActionId(null)
    }
  }

  const handleDecline = async (inviteId: string): Promise<void> => {
    setActionId(inviteId)
    try {
      await declineInvite(inviteId)
      showToast.info('Convite recusado.')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao recusar o convite.')
    } finally {
      setActionId(null)
    }
  }

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-primary backdrop-blur-2xl text-gray-100">
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-subtle px-4">
          <InboxIcon className="h-6 w-6 text-gray-300" />
          <span className="font-bold text-strong text-base tracking-wide">Convites</span>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-2 text-ds-sm font-mediumr text-gray-400">
            Convites pendentes{loading ? '' : ` — ${invites.length}`}
          </p>

          {loading ? (
            <InviteListSkeleton />
          ) : invites.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Nenhum convite pendente no momento. Quando alguém te convidar para um servidor, ele
              aparecerá aqui.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {invites.map((invite) => {
                const initialChar = (invite.server_name ?? '?').charAt(0).toUpperCase()
                const isActioning = actionId === invite.id
                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-xl border border-subtle bg-fg/3 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-violet-600 to-indigo-600 font-bold text-white text-base shadow-md">
                        {invite.server_icon_url ? (
                          <img
                            src={serverIconSrc(invite.server_icon_url)}
                            alt={invite.server_name ?? ''}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initialChar
                        )}
                      </div>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate font-semibold text-strong text-sm">
                          {invite.server_name}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          @{invite.inviter_username} convidou você
                          {invite.created_at ? ` • ${formatDate(invite.created_at)}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="success"
                        disabled={isActioning}
                        onClick={() => handleAccept(invite.id, invite.server_name ?? '')}
                      >
                        {isActioning ? 'Entrando...' : 'Aceitar'}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={isActioning}
                        onClick={() => handleDecline(invite.id)}
                      >
                        Recusar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Invites
