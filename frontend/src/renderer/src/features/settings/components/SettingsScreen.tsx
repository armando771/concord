import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useSettingsStore } from '../store/settingsStore'
import { logoutAndReset } from '../../profile/store/meActions'
import {
  escClosesSettings,
  SETTINGS_SECTIONS,
  accountName,
  currentSettingsSection,
  filterSections,
  settingsContentWidth,
  type SettingsSectionId
} from '../lib/settingsNav'
import { modalStack } from '../../../shared/lib/modalStack'
import { IS_WEB } from '../../../shared/lib/config'
import SettingsShell from '../../../shared/ui/SettingsShell'
import SettingsNav from './SettingsNav'
import MyAccountSection from './sections/MyAccountSection'
import ProfilesSection from './sections/ProfilesSection'
import { PrivacySection } from './sections/PrivacySection'
import { KeybindsSection } from './sections/KeybindsSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { AppSection, NotificationsSection, VoiceSection } from './sections/SimpleSections'
import { VideoSection } from './sections/VideoSection'


// "Aplicativo" (iniciar com o sistema, overlay) só existe no desktop; no dev
// fica por causa da prévia da animação de nível.
const showAppSection = !IS_WEB || import.meta.env.DEV
const SECTIONS = SETTINGS_SECTIONS.filter((s) => s.id !== 'app' || showAppSection)

const SECTION_VIEW: Record<SettingsSectionId, () => React.JSX.Element | null> = {
  account: MyAccountSection,
  profiles: ProfilesSection,
  privacy: PrivacySection,
  appearance: AppearanceSection,
  voice: VoiceSection,
  video: VideoSection,
  keybinds: KeybindsSection,
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
      // ESC no recorte de imagem ou num modal por cima fecha só ele.
      if (escClosesSettings(e, modalStack.hasOpen())) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const current = currentSettingsSection(SECTIONS, section)
  const View = SECTION_VIEW[current.id]
  const name = accountName(user)

  const logout = async (): Promise<void> => {
    setLoggingOut(true)
    await logoutAndReset()
    setLoggingOut(false)
  }

  return (
    <SettingsShell
      ariaLabel="Configurações"
      sectionKey={current.id}
      title={current.label}
      titleClassName="text-ds-lg font-semibold text-strong"
      contentClassName={settingsContentWidth(current.id)}
      closeLabel="Fechar configurações"
      onClose={close}
      nav={
        <SettingsNav
          user={user}
          name={name}
          query={query}
          onQuery={setQuery}
          visible={visible}
          currentId={current.id}
          onGo={goTo}
          loggingOut={loggingOut}
          onLogout={() => void logout()}
        />
      }
    >
      <View />
    </SettingsShell>
  )
}

export default SettingsScreen
