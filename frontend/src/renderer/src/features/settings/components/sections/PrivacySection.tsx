import { useEffect, useState } from 'react'
import {
  getPrivacy,
  updatePrivacy,
  type FriendRequestPolicy,
  type Privacy
} from '../../../profile/api/users'
import { Toggle } from '../AppSettings'
import { useFriendStore } from '../../../friends/store/friendStore'
import { usePresenceActivityStore } from '../../../activity/store/presenceActivityStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUIStore } from '../../../../shared/store/uiStore'
import { showToast } from '../../../../shared/store/toastStore'
import router from '../../../../app/router'
import { SettingsSectionsSkeleton } from '../../../../shared/ui/skeleton/layouts'

const POLICIES: { id: FriendRequestPolicy; title: string; description: string }[] = [
  { id: 'everyone', title: 'Todos', description: 'Qualquer pessoa com seu nome de usuário.' },
  {
    id: 'mutual_servers',
    title: 'Amigos de amigos e membros de servidores',
    description: 'Quem tem um amigo ou um servidor em comum com você.'
  },
  {
    id: 'mutual_friends',
    title: 'Amigos de amigos',
    description: 'Só quem tem pelo menos um amigo em comum com você.'
  },
  { id: 'nobody', title: 'Ninguém', description: 'Ninguém consegue te mandar pedido de amizade.' }
]

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="mb-3 text-ds-sm font-medium text-gray-400">{children}</h2>
}

/**
 * Configurações → Privacidade e segurança: quem pode mandar pedido de
 * amizade, DMs de membros de servidores e os usuários bloqueados. Salva na
 * hora, como no Discord.
 */
export function PrivacySection(): React.JSX.Element {
  const [privacy, setPrivacy] = useState<Privacy | null>(null)
  const [saving, setSaving] = useState(false)
  const blockedCount = useFriendStore((s) => s.blocked.length)
  const loadFriends = useFriendStore((s) => s.loadAll)
  const showActivity = usePresenceActivityStore((s) => s.enabled)
  const setShowActivity = usePresenceActivityStore((s) => s.setEnabled)

  useEffect(() => {
    let cancelled = false
    getPrivacy()
      .then((p) => {
        if (!cancelled) setPrivacy(p)
      })
      .catch(() => showToast.error('Não foi possível carregar a privacidade.'))
    loadFriends()
    return () => {
      cancelled = true
    }
  }, [loadFriends])

  const save = async (next: Privacy): Promise<void> => {
    const previous = privacy
    setPrivacy(next)
    setSaving(true)
    try {
      setPrivacy(await updatePrivacy(next))
    } catch (err) {
      setPrivacy(previous)
      showToast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const openBlocked = (): void => {
    useSettingsStore.getState().close()
    useUIStore.getState().setFriendsTab('blocked')
    void router.navigate('/friends')
  }

  if (!privacy) return <SettingsSectionsSkeleton sections={[4, 1, 1]} />

  return (
    <div className="flex flex-col gap-8">
      <section className="border-b border-subtle pb-6">
        <SectionTitle>Quem pode te enviar pedido de amizade</SectionTitle>
        <div role="radiogroup" className="flex flex-col gap-2">
          {POLICIES.map((p) => {
            const checked = privacy.friend_request_policy === p.id
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                  checked ? 'bg-fg/10' : 'bg-input hover:bg-fg/5'
                }`}
              >
                <input
                  type="radio"
                  name="friend-request-policy"
                  checked={checked}
                  disabled={saving}
                  onChange={() => void save({ ...privacy, friend_request_policy: p.id })}
                  className="h-4 w-4 accent-brand"
                />
                <span className="min-w-0">
                  <span className="block text-ds-md font-medium text-strong">{p.title}</span>
                  <span className="block text-ds-sm text-gray-400">{p.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </section>

      <section className="border-b border-subtle pb-6">
        <SectionTitle>Mensagens diretas</SectionTitle>
        <Toggle
          title="Permitir DMs de membros de servidores"
          description="Quem não é seu amigo, mas está num servidor com você, pode te mandar mensagem direta. Amigos sempre podem."
          checked={privacy.allow_server_dms}
          onChange={() => void save({ ...privacy, allow_server_dms: !privacy.allow_server_dms })}
        />
      </section>

      {window.api?.games && (
        <section className="border-b border-subtle pb-6">
          <SectionTitle>Atividade</SectionTitle>
          <Toggle
            title="Mostrar o jogo que estou jogando"
            description="Amigos e membros de servidores em comum veem o jogo em andamento embaixo do seu nome. Só jogos conhecidos são detectados; nada mais sai do seu computador."
            checked={showActivity}
            onChange={() => setShowActivity(!showActivity)}
          />
        </section>
      )}

      <section>
        <SectionTitle>Usuários bloqueados</SectionTitle>
        <div className="flex items-center justify-between gap-4">
          <p className="text-ds-md text-gray-300">
            {blockedCount === 0
              ? 'Você não bloqueou ninguém.'
              : blockedCount === 1
                ? '1 usuário bloqueado.'
                : `${blockedCount} usuários bloqueados.`}
          </p>
          <button
            type="button"
            onClick={openBlocked}
            className="cursor-pointer rounded-md bg-fg/10 px-4 py-2 text-ds-sm font-medium text-strong transition-colors hover:bg-fg/15"
          >
            Ver bloqueados
          </button>
        </div>
      </section>
    </div>
  )
}
