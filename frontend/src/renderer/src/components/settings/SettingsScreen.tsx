import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { logoutAndReset } from '../../store/meActions'
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  filterSections,
  type SettingsSectionId
} from '../../lib/settingsNav'
import { IS_WEB } from '../../lib/config'
import Avatar from '../Avatar'
import { PencilIcon, SearchIcon, XIcon } from '../icons'
import MyAccountSection from './sections/MyAccountSection'
import ProfilesSection from './sections/ProfilesSection'
import { PrivacySection } from './sections/PrivacySection'
import { AppSection, NotificationsSection, VoiceSection } from './sections/SimpleSections'

const NAV_BG = '#0b0c10'
const CONTENT_BG = '#050508'

// "Aplicativo" (iniciar com o sistema, overlay) só existe no desktop; no dev
// fica por causa da prévia da animação de nível.
const showAppSection = !IS_WEB || import.meta.env.DEV
const SECTIONS = SETTINGS_SECTIONS.filter((s) => s.id !== 'app' || showAppSection)

const SECTION_VIEW: Record<SettingsSectionId, () => React.JSX.Element | null> = {
  account: MyAccountSection,
  profiles: ProfilesSection,
  privacy: PrivacySection,
  voice: VoiceSection,
  notifications: NotificationsSection,
  app: AppSection
}

/**
 * Configurações em tela cheia, como no Discord: navegação com busca à esquerda
 * e a seção à direita. ESC ou o ✕ fecham (com alterações não salvas no perfil,
 * a barra de aviso treme em vez de fechar).
 */
function SettingsScreen(): React.JSX.Element | null {
  const open = useSettingsStore((s) => s.open)
  // Monta só aberta: a busca e o resto começam do zero a cada abertura.
  return open ? <SettingsContent /> : null
}

function SettingsContent(): React.JSX.Element {
  const section = useSettingsStore((s) => s.section)
  const goTo = useSettingsStore((s) => s.goTo)
  const close = useSettingsStore((s) => s.close)
  const user = useAuthStore((s) => s.user)
  const [query, setQuery] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const visible = useMemo(() => filterSections(query, SECTIONS), [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // ESC dentro do recorte de imagem fecha só o recorte (ele para o evento).
      if (e.key === 'Escape' && !e.defaultPrevented) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  const View = SECTION_VIEW[current.id]
  const name = user?.display_name || user?.username || ''

  const logout = async (): Promise<void> => {
    setLoggingOut(true)
    await logoutAndReset()
    setLoggingOut(false)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurações"
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex text-gray-200"
      style={{ top: 'var(--titlebar-height, 0px)', background: CONTENT_BG }}
    >
      {/* Navegação */}
      <aside
        className="flex w-[260px] shrink-0 flex-col border-r border-white/6"
        style={{ background: NAV_BG }}
      >
        <button
          type="button"
          onClick={() => goTo('profiles')}
          className="m-3 flex cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
        >
          <Avatar
            userId={user?.id}
            name={name}
            avatarUrl={user?.avatar_url}
            size={40}
            animate="always"
          />
          <span className="min-w-0">
            <span className="block truncate text-ds-md font-medium text-white">{name}</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              Editar perfis <PencilIcon className="h-3 w-3" />
            </span>
          </span>
        </button>

        <label className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 focus-within:border-[#5865f2]">
          <SearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            aria-label="Buscar nas configurações"
            className="min-w-0 flex-1 bg-transparent text-ds-md text-white placeholder:text-gray-500 focus:outline-none"
          />
        </label>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {SETTINGS_GROUPS.map((group) => {
            const items = visible.filter((s) => s.group === group.id)
            if (items.length === 0) return null
            return (
              <div key={group.id} className="mb-4">
                <p className="mb-1 px-2 text-ds-sm font-medium text-gray-500">
                  {group.label}
                </p>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goTo(item.id)}
                    aria-current={item.id === current.id ? 'page' : undefined}
                    className={`mb-0.5 block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-ds-md font-medium transition-colors ${
                      item.id === current.id
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )
          })}
          {visible.length === 0 && (
            <p className="px-2 text-ds-md text-gray-500">Nada encontrado para “{query}”.</p>
          )}

          <div className="mt-2 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-ds-md font-medium text-[#f23f43] transition-colors hover:bg-[#f23f43]/10 disabled:opacity-50"
            >
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[740px] px-10 pb-28 pt-14">
          <h1 className="mb-6 text-ds-lg font-semibold text-white">{current.label}</h1>
          <View />
        </div>
        <div
          className="fixed right-8 flex flex-col items-center gap-1"
          style={{ top: 'calc(var(--titlebar-height, 0px) + 56px)' }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Fechar configurações"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-gray-500 text-gray-400 transition-colors hover:border-white hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-bold text-gray-500">ESC</span>
        </div>
      </main>
    </div>,
    document.body
  )
}

export default SettingsScreen
