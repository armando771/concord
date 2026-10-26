import type { ServerSettingsSection, ServerSettingsSectionId } from '../lib/serverSettingsNav'

interface ServerSettingsNavProps {
  serverName: string
  sections: ServerSettingsSection[]
  currentId: ServerSettingsSectionId
  onGo: (id: ServerSettingsSectionId) => void
  isOwner: boolean
  onDelete: () => void
  onLeave: () => void
}

const DANGER_ITEM =
  'block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/10'

/** Coluna da esquerda das configurações do servidor: seções e "Deletar"/"Sair". */
function ServerSettingsNav({
  serverName,
  sections,
  currentId,
  onGo,
  isOwner,
  onDelete,
  onLeave
}: ServerSettingsNavProps): React.JSX.Element {
  return (
    <>
      <p className="m-4 mb-2 truncate text-ds-sm font-medium text-gray-400">{serverName}</p>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onGo(item.id)}
            aria-current={item.id === currentId ? 'page' : undefined}
            className={`mb-0.5 block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors ${
              item.id === currentId
                ? 'bg-fg/10 text-strong'
                : 'text-gray-400 hover:bg-fg/5 hover:text-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}

        <div className="mt-2 border-t border-subtle pt-2">
          <button type="button" onClick={isOwner ? onDelete : onLeave} className={DANGER_ITEM}>
            {isOwner ? 'Deletar servidor' : 'Sair do servidor'}
          </button>
        </div>
      </nav>
    </>
  )
}

export default ServerSettingsNav
