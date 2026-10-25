import { useAuthStore } from '../../store/authStore'
import { UNLOCK_TOAST_MS, useBadgeStore } from '../../store/badgeStore'
import { useLevelStore } from '../../store/levelStore'
import { rarityMeta } from '../../lib/badges'
import BadgeIcon from './BadgeIcon'

/**
 * Aviso discreto no topo quando VOCÊ alcança um tier novo de badge, no
 * mesmo estilo da faixa de subir de nível (mas menor e sem festa). Se a
 * faixa de nível estiver na tela, aparece logo abaixo dela. Clicar abre os
 * seus badges.
 */
function BadgeUnlockToast(): React.JSX.Element | null {
  const toast = useBadgeStore((s) => s.toast)
  const dismiss = useBadgeStore((s) => s.dismissToast)
  const openModal = useBadgeStore((s) => s.openModal)
  const me = useAuthStore((s) => s.user)
  const levelUp = useLevelStore((s) => (me ? Boolean(s.celebrations[me.id]) : false))

  if (!toast || !me) return null
  const [first, ...rest] = toast.unlocks
  const meta = rarityMeta(first.rarity)

  const open = (): void => {
    dismiss()
    openModal({
      userId: me.id,
      name: me.display_name || me.username,
      avatarUrl: me.avatar_url,
      category: first.category
    })
  }

  return (
    <div
      key={toast.key}
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center ${
        levelUp
          ? 'top-[calc(var(--titlebar-height,0px)+5.5rem)]'
          : 'top-[calc(var(--titlebar-height,0px)+1rem)]'
      }`}
    >
      <button
        type="button"
        role="status"
        onClick={open}
        className="badge-toast pointer-events-auto relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border bg-[#0b0b10]/90 py-2 pl-2.5 pr-4 text-left shadow-2xl backdrop-blur-xl"
        style={
          {
            borderColor: `${meta.color}55`,
            boxShadow: `0 0 22px ${meta.color}33`,
            '--badge-toast-ms': `${UNLOCK_TOAST_MS}ms`
          } as React.CSSProperties
        }
      >
        <BadgeIcon category={first.category} tier={first.tier} rarity={first.rarity} size={36} />
        <span className="leading-tight">
          <span className="block text-sm font-bold text-white">
            {rest.length > 0 ? `${toast.unlocks.length} badges novos!` : 'Badge novo!'}
          </span>
          <span className="block text-[11px] text-gray-400">
            <span style={{ color: meta.color }}>{first.tier_name}</span> · {first.name}
            {rest.length > 0 && ` e mais ${rest.length}`}
          </span>
        </span>
      </button>
    </div>
  )
}

export default BadgeUnlockToast
