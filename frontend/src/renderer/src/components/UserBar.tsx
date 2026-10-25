import { useAuthStore } from '../store/authStore'
import { profileCardHandler } from '../store/profileCardStore'
import { useSettingsStore } from '../store/settingsStore'
import { STATUS_META } from '../lib/presenceStatus'
import Avatar from './Avatar'
import { GearIcon } from './icons'

const BAR_BG = '#07080b'

/**
 * Barra de baixo (como no Discord): clicar na foto ou no nome abre o próprio
 * cartão de perfil (de lá, Editar perfil e Status); a engrenagem abre as
 * Configurações.
 */
function UserBar(): React.JSX.Element {
  const user = useAuthStore((s) => s.user)
  const openSettings = useSettingsStore((s) => s.openSettings)
  const status = user?.status ?? 'online'
  const name = user?.display_name || user?.username || ''
  const note = user?.status_text?.trim()

  return (
    <div
      className="flex shrink-0 items-center justify-between border-t border-white/6 px-2 py-2"
      style={{ background: `${BAR_BG}e6` }}
    >
      <button
        type="button"
        onClick={user ? profileCardHandler(user.id, name, user.username, 'top') : undefined}
        aria-label="Abrir meu perfil"
        className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-white/5"
      >
        <Avatar
          userId={user?.id}
          name={name}
          avatarUrl={user?.avatar_url}
          size={32}
          animate="always"
          status={status}
          cutoutColor={BAR_BG}
        />
        <div className="min-w-0">
          <p className="truncate text-ds-md leading-[18px] font-medium text-white">{name}</p>
          {/* Como no Discord: a nota (ou o status) e, com o mouse, o @. */}
          <p className="truncate text-ds-xs leading-[13px] font-medium text-gray-400 group-hover:hidden">
            {note || STATUS_META[status].label}
          </p>
          <p className="hidden truncate text-ds-xs leading-[13px] font-medium text-gray-400 group-hover:block">
            @{user?.username}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => openSettings('account')}
        aria-label="Configurações do usuário"
        title="Configurações do usuário"
        className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <GearIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export default UserBar
