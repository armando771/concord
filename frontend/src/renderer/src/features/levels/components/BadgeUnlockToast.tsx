import { useAuthStore } from '../../auth/store/authStore'
import { UNLOCK_TOAST_MS, useBadgeStore } from '../store/badgeStore'
import { useLevelStore } from '../store/levelStore'
import { isMythic, rarityMeta, unlockCount } from '../lib/badges'
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
  const [first] = toast.unlocks
  const meta = rarityMeta(first.rarity)
  // Badges, não tiers (no primeiro deploy, voz 1–4 de uma vez é um só).
  const count = unlockCount(toast.unlocks)

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
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center ${
        levelUp
          ? 'top-[calc(var(--titlebar-height,0px)+5.5rem)]'
          : 'top-[calc(var(--titlebar-height,0px)+1rem)]'
      }`}
    >
      <button
        type="button"
        onClick={open}
        className="badge-toast pointer-events-auto relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border bg-floating py-2 pl-2.5 pr-4 text-left shadow-2xl backdrop-blur-xl"
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
          <span className="block text-sm font-bold text-strong">
            {count > 1 ? `${count} badges novos!` : 'Badge novo!'}
          </span>
          <span className="block text-[11px] text-gray-400">
            {isMythic(first.rarity) ? (
              <span className="mythic-text font-bold">{first.tier_name}</span>
            ) : (
              <span style={{ color: meta.color }}>{first.tier_name}</span>
            )}{' '}
            · {first.name}
            {count > 1 && ` e mais ${count - 1}`}
          </span>
        </span>
      </button>
    </div>
  )
}

export default BadgeUnlockToast
