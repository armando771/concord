import { useState } from 'react'
import { useAuthStore } from '../../../store/authStore'
import { useSettingsStore } from '../../../store/settingsStore'
import { maskEmail } from '../../../lib/account'
import { formatMemberSince } from '../../../lib/profileCard'
import { API_BASE_URL } from '../../../lib/config'
import { profileMediaSrc } from '../../../lib/profileMedia'
import Avatar from '../../Avatar'

const CARD_BG = '#111214'

function Row({
  label,
  value,
  action
}: {
  label: string
  value: React.ReactNode
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-ds-xs font-bold uppercase tracking-[0.02em] text-gray-400">{label}</p>
        <div className="truncate text-ds-md text-white">{value}</div>
      </div>
      {action}
    </div>
  )
}

/**
 * Configurações → Minha conta, como no Discord: cartão com banner e avatar e
 * os dados da conta. Por enquanto só leitura (trocar @ e senha fica para
 * depois); o nome de exibição se edita em Perfis.
 */
function MyAccountSection(): React.JSX.Element | null {
  const user = useAuthStore((s) => s.user)
  const goTo = useSettingsStore((s) => s.goTo)
  const [showEmail, setShowEmail] = useState(false)

  if (!user) return null

  const name = user.display_name || user.username
  const bannerSrc = profileMediaSrc(user.banner_url, API_BASE_URL)
  const since = formatMemberSince(user.created_at)
  const editButton = (
    <button
      type="button"
      onClick={() => goTo('profiles')}
      className="shrink-0 cursor-pointer rounded-md bg-white/10 px-4 py-1.5 text-ds-sm font-medium text-white transition-colors hover:bg-white/15"
    >
      Editar
    </button>
  )

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/10"
      style={{ background: CARD_BG }}
    >
      <div
        className="h-[100px]"
        style={
          bannerSrc
            ? undefined
            : { background: user.banner_color || 'linear-gradient(135deg, #5865f2, #8b5cf6)' }
        }
      >
        {bannerSrc && <img src={bannerSrc} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="px-4 pb-4">
        <div className="-mt-10 flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-3">
            <div className="rounded-full p-1.5" style={{ background: CARD_BG }}>
              <Avatar
                userId={user.id}
                name={name}
                avatarUrl={user.avatar_url}
                size={80}
                animate="always"
                status={user.status ?? 'online'}
                cutoutColor={CARD_BG}
              />
            </div>
            <p className="mb-2 truncate text-xl font-bold text-white">{name}</p>
          </div>
          <button
            type="button"
            onClick={() => goTo('profiles')}
            className="mb-2 shrink-0 cursor-pointer rounded-md bg-[#5865f2] px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-[#4752c4]"
          >
            Editar perfil de usuário
          </button>
        </div>

        <div className="mt-4 divide-y divide-white/10 rounded-lg bg-black/30 px-4">
          <Row label="Nome de exibição" value={name} action={editButton} />
          <Row label="Nome de usuário" value={user.username} />
          <Row
            label="E-mail"
            value={
              <>
                {showEmail ? user.email : maskEmail(user.email)}{' '}
                <button
                  type="button"
                  onClick={() => setShowEmail((v) => !v)}
                  className="cursor-pointer text-[#00a8fc] hover:underline"
                >
                  {showEmail ? 'Ocultar' : 'Mostrar'}
                </button>
              </>
            }
          />
          {since && <Row label="Membro desde" value={since} />}
        </div>
      </div>
    </div>
  )
}

export default MyAccountSection
