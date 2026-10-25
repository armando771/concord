import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useServerSettingsStore } from '../../store/serverSettingsStore'
import { useServerStore } from '../../store/serverStore'
import { useChatStore } from '../../store/chatStore'
import { useServerAccess } from '../../store/useServerAccess'
import { showToast } from '../../store/toastStore'
import { router } from '../../router'
import { actionErrorMessage } from '../../lib/permissionErrors'
import { resolveServerSection, visibleServerSections } from '../../lib/serverSettingsNav'
import { XIcon } from '../icons'
import ConfirmModal from '../friends/ConfirmModal'
import OverviewSection from './OverviewSection'
import RolesSection from './RolesSection'
import MembersSection from './MembersSection'
import BansSection from './BansSection'

const NAV_BG = '#0b0c10'
const CONTENT_BG = '#050508'

const SECTION_VIEW = {
  overview: OverviewSection,
  roles: RolesSection,
  members: MembersSection,
  bans: BansSection
} as const

/**
 * Configurações do servidor em tela cheia, como as de usuário: visão geral,
 * cargos, membros e banimentos. Cada seção só aparece para quem tem a
 * permissão (o servidor confere de novo a cada ação).
 */
function ServerSettingsScreen(): React.JSX.Element | null {
  const open = useServerSettingsStore((s) => s.open)
  return open ? <ServerSettingsContent /> : null
}

function ServerSettingsContent(): React.JSX.Element | null {
  const wanted = useServerSettingsStore((s) => s.section)
  const goTo = useServerSettingsStore((s) => s.goTo)
  const close = useServerSettingsStore((s) => s.close)
  const server = useServerStore((s) => s.currentServer)
  const access = useServerAccess()
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const sections = visibleServerSections(access.perms)
  const current = resolveServerSection(access.perms, wanted)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Perdeu o acesso (cargo tirado, saiu do servidor): fecha sozinha.
  useEffect(() => {
    if (!server || current === null) close()
  }, [server, current, close])

  if (!server || current === null) return null

  const View = SECTION_VIEW[current]
  const label = sections.find((s) => s.id === current)?.label ?? ''

  const leaveAndGo = (): void => {
    useChatStore.getState().handleServerDeleted(server.id)
    close()
    void router.navigate('/friends')
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurações do servidor"
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex text-gray-200"
      style={{ top: 'var(--titlebar-height, 0px)', background: CONTENT_BG }}
    >
      <aside
        className="flex w-[260px] shrink-0 flex-col border-r border-white/6"
        style={{ background: NAV_BG }}
      >
        <p className="m-4 mb-2 truncate text-xs font-bold uppercase tracking-wide text-gray-400">
          {server.name}
        </p>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(item.id)}
              aria-current={item.id === current ? 'page' : undefined}
              className={`mb-0.5 block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors ${
                item.id === current
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}

          <div className="mt-2 border-t border-white/10 pt-2">
            {access.isOwner ? (
              <button
                type="button"
                onClick={() => setDeleting(true)}
                className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm font-medium text-[#f23f43] transition-colors hover:bg-[#f23f43]/10"
              >
                Deletar servidor
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLeaving(true)}
                className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm font-medium text-[#f23f43] transition-colors hover:bg-[#f23f43]/10"
              >
                Sair do servidor
              </button>
            )}
          </div>
        </nav>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-10 pb-28 pt-14">
          <h1 className="mb-6 text-xl font-bold text-white">{label}</h1>
          <View />
        </div>
        <div
          className="fixed right-8 flex flex-col items-center gap-1"
          style={{ top: 'calc(var(--titlebar-height, 0px) + 56px)' }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Fechar configurações do servidor"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-gray-500 text-gray-400 transition-colors hover:border-white hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-bold text-gray-500">ESC</span>
        </div>
      </main>

      <ConfirmModal
        open={leaving}
        title={`Sair de ${server.name}`}
        confirmLabel="Sair do servidor"
        onClose={() => setLeaving(false)}
        onConfirm={async () => {
          try {
            await useServerStore.getState().leaveServer(server.id)
            leaveAndGo()
          } catch (err) {
            showToast.error(actionErrorMessage(err, 'Não foi possível sair do servidor.'))
          }
        }}
      >
        <p>
          Você sai de <b className="text-white">{server.name}</b> e só volta com um novo convite.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={deleting}
        title={`Deletar ${server.name}`}
        confirmLabel="Deletar servidor"
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await useServerStore.getState().deleteServer(server.id)
            leaveAndGo()
            showToast.success('Servidor deletado!')
          } catch (err) {
            showToast.error(actionErrorMessage(err, 'Falha ao deletar servidor.'))
          }
        }}
      >
        <p>
          Todos os canais e mensagens de <b className="text-white">{server.name}</b> serão apagados
          e todos os membros serão removidos. Esta ação não pode ser desfeita.
        </p>
      </ConfirmModal>
    </div>,
    document.body
  )
}

export default ServerSettingsScreen
