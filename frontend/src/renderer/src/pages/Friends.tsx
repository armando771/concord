import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Input from '../components/Input'
import { FriendsIcon, SearchIcon, DotsIcon, ChatBubbleIcon, TrashIcon } from '../components/icons'
import { useAuthStore, type User } from '../store/authStore'
import { useFriendStore } from '../store/friendStore'
import { useUIStore, type FriendsTab } from '../store/uiStore'
import { useChatStore } from '../store/chatStore'
import { searchUsers } from '../api/users'
import { showToast } from '../store/toastStore'

const friendUsernames = (friends: User[]): Set<string> => new Set(friends.map((f) => f.username))

function Avatar({
  user,
  size = 'md',
  online
}: {
  user: Pick<User, 'display_name' | 'username'>
  size?: 'md' | 'lg'
  online?: boolean
}): React.JSX.Element {
  const initial = (user.display_name ?? user.username ?? '?').charAt(0).toUpperCase()
  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-indigo-600 font-bold text-white shadow-md ${
          size === 'lg' ? 'h-11 w-11 text-base' : 'h-9 w-9 text-sm'
        }`}
      >
        {initial}
      </div>
      {online !== undefined && (
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#07080b] ${
            online ? 'bg-[#23a55a]' : 'bg-gray-600'
          }`}
        />
      )}
    </div>
  )
}

function Friends(): React.JSX.Element {
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const friends = useFriendStore((s) => s.friends)
  const pending = useFriendStore((s) => s.pending)
  const loading = useFriendStore((s) => s.loading)
  const loadAll = useFriendStore((s) => s.loadAll)
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const accept = useFriendStore((s) => s.accept)
  const decline = useFriendStore((s) => s.decline)
  const cancel = useFriendStore((s) => s.cancel)
  const remove = useFriendStore((s) => s.remove)

  const presence = useChatStore((s) => s.presence)
  const fetchPresenceFor = useChatStore((s) => s.fetchPresenceFor)

  const tab = useUIStore((s) => s.friendsTab)
  const setTab = useUIStore((s) => s.setFriendsTab)

  const [filterText, setFilterText] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [actionUser, setActionUser] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (friends.length > 0) {
      fetchPresenceFor(friends.map((f) => f.id))
    }
  }, [friends, fetchPresenceFor])

  const handleSearch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const term = query.trim()
    if (!term) {
      setResults(null)
      return
    }

    setSearching(true)
    try {
      const found = await searchUsers(term)
      const filtered = found.filter((u) => u.username !== me?.username)
      setResults(filtered)
      if (filtered.length === 0) {
        showToast.error('Nenhum usuário encontrado.')
      }
    } catch (err) {
      setResults(null)
      showToast.error(err instanceof Error ? err.message : 'Falha na busca.')
    } finally {
      setSearching(false)
    }
  }

  const handleSend = async (username: string): Promise<void> => {
    setSendingTo(username)
    try {
      await sendRequest(username)
      showToast.success(`Solicitação de amizade enviada para @${username}!`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao enviar solicitação.')
    } finally {
      setSendingTo(null)
    }
  }

  const runAction = async (action: () => Promise<void>, successMessage: string): Promise<void> => {
    try {
      await action()
      showToast.success(successMessage)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha na operação.')
    } finally {
      setActionUser(null)
    }
  }

  const isFriend = friendUsernames(friends)

  const outgoingUsernames: Set<string> = new Set(
    pending.filter((p) => p.direction === 'outgoing').map((p) => p.username)
  )

  const incoming = pending.filter((p) => p.direction === 'incoming')
  const outgoing = pending.filter((p) => p.direction === 'outgoing')

  const filteredFriends = friends.filter(
    (f) =>
      (f.display_name ?? '').toLowerCase().includes(filterText.toLowerCase()) ||
      f.username.toLowerCase().includes(filterText.toLowerCase())
  )

  const tabs: { id: FriendsTab; label: string; badge?: number }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendentes', badge: pending.length > 0 ? pending.length : undefined },
    { id: 'add', label: 'Adicionar amigo' }
  ]

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07080b]/90 backdrop-blur-2xl text-gray-100">
      {/* Central View Column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/6 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 text-gray-300">
              <FriendsIcon className="h-6 w-6 text-gray-300" />
              <span className="font-bold text-white text-base tracking-wide">Amigos</span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {tabs.map((t) => {
                const isAdd = t.id === 'add'
                const isActive = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold transition-all cursor-pointer ${
                      isAdd
                        ? isActive
                          ? 'bg-discord-green text-white shadow-md shadow-discord-green/25'
                          : 'bg-discord-green text-white hover:bg-discord-green-hover shadow-md shadow-discord-green/20'
                        : isActive
                          ? 'bg-white/15 text-white'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    }`}
                  >
                    <span>{t.label}</span>
                    {t.badge && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {t.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab !== 'add' && (
            <div className="mb-4">
              <div className="relative">
                <Input
                  placeholder="Buscar"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="glass-input pl-9 text-sm"
                />
                <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
          )}

          {loading && tab !== 'add' ? (
            <div className="py-8 text-center text-sm text-gray-400">Carregando amigos...</div>
          ) : tab === 'all' ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Todos os amigos — {filteredFriends.length}
              </p>

              {filteredFriends.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  {friends.length === 0
                    ? 'Você ainda não possui amigos adicionados. Clique em "Adicionar amigo" acima para buscar novos usuários!'
                    : 'Nenhum amigo encontrado na busca.'}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredFriends.map((f) => (
                    <div
                      key={f.username}
                      className="group flex items-center justify-between rounded-xl border border-transparent p-2.5 transition-all hover:border-white/6 hover:bg-white/4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar user={f} online={Boolean(presence[f.id])} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white text-sm">
                            {f.display_name}
                          </p>
                          <p className="truncate text-xs text-gray-400">@{f.username}</p>
                        </div>
                      </div>

                      {/* Action Icon Buttons on Hover */}
                      <div className="flex items-center gap-2">
                        <button
                          title="Enviar mensagem"
                          onClick={() => navigate(`/dm/${f.id}`)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-gray-300 transition-colors hover:bg-violet-600/30 hover:text-violet-300 cursor-pointer"
                        >
                          <ChatBubbleIcon className="h-5 w-5" />
                        </button>
                        <div className="relative">
                          <button
                            title="Opções"
                            aria-label={`Opções de ${f.display_name}`}
                            onClick={() => setMenuFor(menuFor === f.username ? null : f.username)}
                            className={`flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-gray-300 transition-colors cursor-pointer ${
                              menuFor === f.username
                                ? 'bg-white/10 text-white'
                                : 'hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <DotsIcon className="h-5 w-5" />
                          </button>
                          {menuFor === f.username && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuFor(null)}
                              />
                              <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#12141d] py-1 shadow-2xl">
                                <button
                                  disabled={actionUser === f.username}
                                  onClick={() => {
                                    setMenuFor(null)
                                    setActionUser(f.username)
                                    runAction(
                                      () => remove(f.username),
                                      `Amigo @${f.username} removido.`
                                    )
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                  <span>
                                    {actionUser === f.username ? 'Removendo...' : 'Deletar amigo'}
                                  </span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'pending' ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Solicitações pendentes — {pending.length}
              </p>
              {pending.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Nenhuma solicitação pendente no momento.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {incoming.map((p) => (
                    <div
                      key={p.user_id}
                      className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar user={p} />
                        <div>
                          <p className="font-semibold text-white text-sm">{p.display_name}</p>
                          <p className="text-xs text-gray-400">
                            Solicitação de amizade recebida (@{p.username})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="success"
                          disabled={actionUser === p.username}
                          onClick={() => {
                            setActionUser(p.username)
                            runAction(
                              () => accept(p.username),
                              `Solicitação de @${p.username} aceita!`
                            )
                          }}
                        >
                          {actionUser === p.username ? 'Aceitando...' : 'Aceitar'}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={actionUser === p.username}
                          onClick={() => {
                            setActionUser(p.username)
                            runAction(
                              () => decline(p.username),
                              `Solicitação de @${p.username} recusada.`
                            )
                          }}
                        >
                          Recusar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {outgoing.map((p) => (
                    <div
                      key={p.user_id}
                      className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar user={p} />
                        <div>
                          <p className="font-semibold text-white text-sm">{p.display_name}</p>
                          <p className="text-xs text-gray-400">
                            Solicitação enviada — aguardando @{p.username} aceitar
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={actionUser === p.username}
                        onClick={() => {
                          setActionUser(p.username)
                          runAction(
                            () => cancel(p.username),
                            `Solicitação para @${p.username} cancelada.`
                          )
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Tab: Adicionar Amigo */
            <div className="mx-auto max-w-xl py-6">
              <h2 className="text-xl font-bold text-white">Adicionar Amigo</h2>
              <p className="mt-1 text-xs text-gray-400">
                Você pode adicionar um amigo usando o nome de usuário da Salinha.
              </p>

              <form
                className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-2 backdrop-blur-xl"
                onSubmit={handleSearch}
              >
                <Input
                  placeholder="Digite o nome de usuário"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="bg-transparent border-0 focus:ring-0"
                />
                <Button type="submit" variant="success" disabled={searching || !query.trim()}>
                  {searching ? 'Buscando...' : 'Enviar solicitação'}
                </Button>
              </form>

              {results && results.length > 0 && (
                <div className="mt-6 flex flex-col gap-2">
                  {results.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar user={u} size="lg" />
                        <div>
                          <p className="font-semibold text-white text-sm">{u.display_name}</p>
                          <p className="text-xs text-gray-400">@{u.username}</p>
                        </div>
                      </div>
                      {isFriend.has(u.username) ? (
                        <span className="text-xs text-gray-400">Já é seu amigo</span>
                      ) : outgoingUsernames.has(u.username) ? (
                        <Button
                          variant="ghost"
                          disabled={actionUser === u.username}
                          onClick={() => {
                            setActionUser(u.username)
                            runAction(
                              () => cancel(u.username),
                              `Solicitação para @${u.username} cancelada.`
                            )
                          }}
                        >
                          {actionUser === u.username ? 'Cancelando...' : 'Cancelar solicitação'}
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          disabled={sendingTo === u.username}
                          onClick={() => handleSend(u.username)}
                        >
                          {sendingTo === u.username ? 'Enviando...' : 'Adicionar'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Friends
