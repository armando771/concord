const TONES = {
  normal: 'text-gray-200 hover:bg-fg/10',
  brand: 'text-violet-300 hover:bg-violet-600/20 hover:text-violet-200',
  danger: 'text-red-400 hover:bg-red-500/15'
} as const

export type SidebarMenuTone = keyof typeof TONES

interface SidebarMenuItemProps {
  label: string
  icon?: React.ReactNode
  tone?: SidebarMenuTone
  onClick: () => void
}

/** Um item dos menus da barra de canais (do servidor e do canal). */
function SidebarMenuItem({
  label,
  icon,
  tone = 'normal',
  onClick
}: SidebarMenuItemProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-ds-sm font-medium cursor-pointer ${TONES[tone]}`}
    >
      <span>{label}</span>
      {icon}
    </button>
  )
}

export default SidebarMenuItem
