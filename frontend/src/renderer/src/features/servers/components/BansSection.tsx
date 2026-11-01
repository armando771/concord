import { useEffect, useState } from 'react'
import { listBans, unbanMember, type ServerBan } from '../api/servers'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../../../shared/store/toastStore'
import { actionErrorMessage } from '../lib/permissionErrors'
import Avatar from '../../../shared/ui/Avatar'
import Button from '../../../shared/ui/Button'
import { BanListSkeleton } from '../../../shared/ui/skeleton/layouts'

/** Quem está banido do servidor, com o motivo, e o botão de desbanir. */
function BansSection(): React.JSX.Element {
  const serverId = useServerStore((s) => s.currentServer?.id)
  const [bans, setBans] = useState<ServerBan[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  /** Sobe a cada "tentar de novo". */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!serverId) return
    let cancelled = false
    listBans(serverId)
      .then((list) => {
        if (cancelled) return
        setBans(list)
        setFailed(false)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [serverId, attempt])

  if (!serverId) return <p className="text-sm text-gray-400">Abra um servidor primeiro.</p>

  const unban = async (ban: ServerBan): Promise<void> => {
    setBusyId(ban.user_id)
    try {
      await unbanMember(serverId, ban.user_id)
      setBans((cur) => (cur ?? []).filter((b) => b.user_id !== ban.user_id))
      showToast.success(`${ban.display_name || ban.username} foi desbanido(a).`)
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível desbanir.'))
    } finally {
      setBusyId(null)
    }
  }

  if (failed) {
    return (
      <div className="text-sm text-gray-400">
        Não foi possível carregar os banimentos.{' '}
        <button
          type="button"
          onClick={() => {
            setFailed(false)
            setBans(null)
            setAttempt((n) => n + 1)
          }}
          className="cursor-pointer font-semibold text-brand hover:underline"
        >
          Tentar de novo
        </button>
      </div>
    )
  }
  if (bans === null) return <BanListSkeleton />
  if (bans.length === 0) {
    return <p className="text-sm text-gray-500">Ninguém está banido deste servidor.</p>
  }

  return (
    <ul className="divide-y divide-subtle rounded-lg border border-subtle">
      {bans.map((ban) => {
        const name = ban.display_name || ban.username
        return (
          <li key={ban.user_id} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <Avatar userId={ban.user_id} name={name} avatarUrl={ban.avatar_url} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-strong">{name}</span>
                <span className="block truncate text-xs text-gray-400">
                  {ban.reason ? `Motivo: ${ban.reason}` : 'Sem motivo informado'}
                </span>
              </span>
            </span>
            <Button
              variant="ghost"
              className="shrink-0 px-3 py-1 text-xs"
              disabled={busyId === ban.user_id}
              onClick={() => void unban(ban)}
            >
              Desbanir
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

export default BansSection
