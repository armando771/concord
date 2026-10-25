import { useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useServerStore } from '../store/serverStore'
import { useServerAccess } from '../store/useServerAccess'
import { showToast } from '../store/toastStore'
import { deleteChannelOverwrite, setChannelOverwrite, type Channel } from '../api/channels'
import { actionErrorMessage } from '../lib/permissionErrors'
import { serverDisplayName } from '../lib/serverNames'
import {
  findOverwrite,
  isEmptyOverwrite,
  isPrivateChannel,
  overwriteRows,
  privateOverwrite,
  triState,
  withTriState,
  type OverwriteTargetRef,
  type TriState
} from '../lib/channelPermissions'
import {
  Perm,
  canGrant,
  channelPermissionGroups,
  everyoneRole,
  roleColorCss,
  type ChannelKind,
  type ChannelOverwrite
} from '../lib/permissions'
import Button from './Button'
import Input from './Input'
import Modal from './Modal'
import Switch from './Switch'

interface ChannelPermissionsModalProps {
  channel: Channel | null
  onClose: () => void
}

const STATES: { id: TriState; label: string; symbol: string; active: string }[] = [
  { id: 'deny', label: 'Negar', symbol: '✗', active: 'bg-[#f23f43] text-white' },
  { id: 'inherit', label: 'Herdar do servidor', symbol: '/', active: 'bg-white/25 text-white' },
  { id: 'allow', label: 'Permitir', symbol: '✓', active: 'bg-[#23a55a] text-white' }
]

/**
 * Permissões de um canal: torna o canal privado e libera ou nega permissões
 * para cargos e membros específicos (por cima do que o servidor dá).
 */
function ChannelPermissionsModal({
  channel,
  onClose
}: ChannelPermissionsModalProps): React.JSX.Element | null {
  const serverId = useServerStore((s) => s.currentServer?.id)
  const roles = useServerStore((s) => s.roles)
  const members = useServerStore((s) => s.currentMembers)
  const fetchChannels = useServerStore((s) => s.fetchChannels)
  const liveChannel = useServerStore((s) => s.channels.find((c) => c.id === channel?.id))
  const access = useServerAccess()
  const meId = useAuthStore((s) => s.user?.id) ?? ''
  const [selected, setSelected] = useState<OverwriteTargetRef | null>(null)
  const [draft, setDraft] = useState<ChannelOverwrite | null>(null)
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)

  const overwrites = liveChannel?.overwrites
  const everyone = everyoneRole(roles)
  const memberName = (id: string): string | undefined => {
    const m = members.find((x) => x.user_id === id)
    return m ? serverDisplayName(m, m) : undefined
  }
  const rows = useMemo(
    () => overwriteRows(overwrites, roles, (id) => memberName(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overwrites, roles, members]
  )

  if (!channel || !liveChannel || !serverId) return null

  const kind: ChannelKind = liveChannel.type === 'voice' ? 'voice' : 'text'
  const groups = channelPermissionGroups(kind)
  const myChannelPerms = access.channelPerms(channel.id)
  const isPrivate = isPrivateChannel(overwrites, everyone?.id)
  const current = selected ?? (rows[0] ? { type: rows[0].type, id: rows[0].id } : null)
  const saved = current ? findOverwrite(overwrites, current) : undefined
  const working =
    draft && current && draft.target_id === current.id && draft.target_type === current.type
      ? draft
      : saved
  const dirty =
    !!draft && (draft.allow !== (saved?.allow ?? 0) || draft.deny !== (saved?.deny ?? 0))

  const run = async (action: () => Promise<unknown>, okMessage?: string): Promise<boolean> => {
    setBusy(true)
    try {
      await action()
      await fetchChannels(serverId)
      if (okMessage) showToast.success(okMessage)
      return true
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível mudar as permissões do canal.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const put = (o: ChannelOverwrite): Promise<unknown> =>
    setChannelOverwrite(serverId, channel.id, o.target_type, o.target_id, o.allow, o.deny)

  const togglePrivate = async (makePrivate: boolean): Promise<void> => {
    if (!everyone) return
    await run(async () => {
      await put(privateOverwrite(overwrites, everyone.id, makePrivate))
      // Quem torna privado sem ter acesso garantido por cargo não se tranca fora.
      if (makePrivate && !access.isOwner && !(access.perms & Perm.ADMINISTRATOR)) {
        await put(
          withTriState(
            findOverwrite(overwrites, { type: 'member', id: meId }),
            { type: 'member', id: meId },
            kind === 'voice' ? Perm.VIEW_CHANNEL | Perm.CONNECT : Perm.VIEW_CHANNEL,
            'allow'
          )
        )
      }
    })
  }

  const setState = (bit: number, state: TriState): void => {
    if (!current) return
    setDraft(withTriState(working, current, bit, state))
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    const ok = isEmptyOverwrite(draft)
      ? await run(
          () => deleteChannelOverwrite(serverId, channel.id, draft.target_type, draft.target_id),
          'Permissões salvas!'
        )
      : await run(() => put(draft), 'Permissões salvas!')
    if (ok) setDraft(null)
  }

  const removeRules = async (): Promise<void> => {
    if (!current) return
    const ok = await run(
      () => deleteChannelOverwrite(serverId, channel.id, current.type, current.id),
      'Regras removidas.'
    )
    if (ok) {
      setDraft(null)
      setSelected(null)
    }
  }

  const addTarget = (ref: OverwriteTargetRef): void => {
    setSelected(ref)
    setDraft({ target_type: ref.type, target_id: ref.id, allow: 0, deny: 0 })
    setAdding('')
  }

  const term = adding.trim().toLowerCase()
  const candidates = [
    ...roles
      .filter((r) => !findOverwrite(overwrites, { type: 'role', id: r.id }))
      .filter((r) => !term || r.name.toLowerCase().includes(term))
      .map((r) => ({ ref: { type: 'role' as const, id: r.id }, name: r.name, color: r.color })),
    ...(term
      ? members
          .filter((m) => !findOverwrite(overwrites, { type: 'member', id: m.user_id }))
          .filter((m) =>
            [m.nickname, m.display_name, m.username].some((v) => v?.toLowerCase().includes(term))
          )
          .slice(0, 6)
          .map((m) => ({
            ref: { type: 'member' as const, id: m.user_id },
            name: serverDisplayName(m, m),
            color: null as number | null
          }))
      : [])
  ].slice(0, 10)

  const pendingRow =
    current && !rows.some((r) => r.type === current.type && r.id === current.id)
      ? {
          ...current,
          name: roles.find((r) => r.id === current.id)?.name ?? memberName(current.id) ?? '?',
          color: null as number | null
        }
      : null
  const allRows = pendingRow ? [...rows, pendingRow] : rows

  return (
    <Modal
      open
      title={`Permissões de ${kind === 'voice' ? '' : '#'}${liveChannel.name}`}
      onClose={onClose}
      wide
    >
      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-white/8 bg-white/3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Canal privado</p>
          <p className="text-xs text-gray-400">
            Só os cargos e membros que você liberar abaixo conseguem ver{' '}
            {kind === 'voice' ? 'e entrar n' : ''}este canal.
          </p>
        </div>
        <Switch
          checked={isPrivate}
          label="Canal privado"
          onChange={(on) => void togglePrivate(on)}
        />
      </div>

      <div className="flex gap-4">
        <div className="w-52 shrink-0">
          <Input
            placeholder="Adicionar cargo ou membro"
            aria-label="Adicionar cargo ou membro"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            className="mb-2 text-xs"
          />
          {term && (
            <ul className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-1">
              {candidates.length === 0 && (
                <li className="px-2 py-1.5 text-xs text-gray-500">Ninguém encontrado.</li>
              )}
              {candidates.map((c) => (
                <li key={`${c.ref.type}:${c.ref.id}`}>
                  <button
                    type="button"
                    onClick={() => addTarget(c.ref)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10"
                  >
                    <span className="text-gray-500">{c.ref.type === 'role' ? '◆' : '@'}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-0.5">
            {allRows.map((row) => {
              const active = current?.type === row.type && current.id === row.id
              return (
                <li key={`${row.type}:${row.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected({ type: row.type, id: row.id })
                      setDraft(null)
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium ${
                      active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="shrink-0 text-xs"
                      style={{ color: roleColorCss(row.color) ?? '#6b7280' }}
                    >
                      {row.type === 'role' ? '◆' : '@'}
                    </span>
                    <span className="truncate">{row.name}</span>
                  </button>
                </li>
              )
            })}
            {allRows.length === 0 && (
              <li className="px-2 text-xs text-gray-500">
                Sem regras: o canal segue as permissões do servidor.
              </li>
            )}
          </ul>
        </div>

        <div className="min-w-0 flex-1">
          {current ? (
            <>
              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.title}>
                    <h3 className="mb-2 text-ds-sm font-medium text-gray-400">{group.title}</h3>
                    <ul className="divide-y divide-white/6 rounded-lg border border-white/8 bg-white/3">
                      {group.permissions.map((p) => {
                        const bit = Perm[p.name]
                        const allowed = canGrant(myChannelPerms, bit)
                        const state = triState(working, bit)
                        return (
                          <li
                            key={p.name}
                            className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                              allowed ? '' : 'opacity-50'
                            }`}
                            title={allowed ? undefined : 'Você não tem essa permissão neste canal.'}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">{p.label}</p>
                              <p className="text-[11px] leading-snug text-gray-400">
                                {p.description}
                              </p>
                            </div>
                            <div
                              role="group"
                              aria-label={p.label}
                              className="flex shrink-0 overflow-hidden rounded-md border border-white/12"
                            >
                              {STATES.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  disabled={!allowed || busy}
                                  aria-label={`${p.label}: ${s.label}`}
                                  aria-pressed={state === s.id}
                                  title={s.label}
                                  onClick={() => setState(bit, s.id)}
                                  className={`h-7 w-8 cursor-pointer text-sm font-bold transition-colors disabled:cursor-not-allowed ${
                                    state === s.id ? s.active : 'text-gray-400 hover:bg-white/10'
                                  }`}
                                >
                                  {s.symbol}
                                </button>
                              ))}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  disabled={busy || !saved}
                  onClick={() => void removeRules()}
                >
                  Remover regras
                </Button>
                <Button variant="success" disabled={busy || !dirty} onClick={() => void save()}>
                  {busy ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Adicione um cargo ou membro para dar ou negar permissões só neste canal.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ChannelPermissionsModal
