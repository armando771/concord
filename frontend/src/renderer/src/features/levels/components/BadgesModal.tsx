import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Badge } from '../api/badges'
import type { BadgesModalTarget } from '../store/badgeStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useBadgeStore } from '../store/badgeStore'
import {
  formatUnlockDate,
  isMythic,
  rarityMeta,
  selectedBadge,
  publicStatText,
  statText,
  visibleBadges
} from '../lib/badges'
import { trapTab } from '../../../shared/lib/focusTrap'
import BadgeIcon from './BadgeIcon'
import BadgesAside from './BadgesAside'
import BadgeProgress from './BadgeProgress'
import BadgeTierLadder from './BadgeTierLadder'
import { BadgeDetailSkeleton } from '../../../shared/ui/skeleton/layouts'

function RarityChip({ badge }: { badge: Badge }): React.JSX.Element {
  const meta = rarityMeta(badge.rarity)
  if (isMythic(badge.rarity)) {
    return (
      <span className="mythic-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
        <span aria-hidden="true">✦</span>
        {meta.label}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{
        color: meta.color,
        background: meta.bg,
        boxShadow: `inset 0 0 0 1px ${meta.color}55`
      }}
    >
      <span aria-hidden="true">▲</span>
      {meta.label}
    </span>
  )
}

function Detail({
  badge,
  isMe,
  ownerName
}: {
  badge: Badge
  isMe: boolean
  ownerName: string
}): React.JSX.Element {
  const meta = rarityMeta(badge.rarity)
  const title = badge.tier_name
  const unlocked = formatUnlockDate(badge.unlocked_at)
  // O mítico tem a própria aura (MythicIcon); os outros, um brilho na cor.
  const mythic = isMythic(badge.rarity)

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {!mythic && (
          <span
            aria-hidden="true"
            className="absolute inset-4 rounded-full blur-2xl"
            style={{ background: `${meta.color}33` }}
          />
        )}
        <BadgeIcon
          category={badge.category}
          tier={badge.tier}
          rarity={badge.rarity}
          size={168}
          hero
          className="relative drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        />
      </div>

      {title !== badge.name && <p className="mt-2 text-sm text-gray-300">{badge.name}</p>}
      <h3
        className={`${title !== badge.name ? 'mt-0.5' : 'mt-2'} text-center text-3xl font-black uppercase tracking-wide ${
          mythic ? 'mythic-text' : 'text-strong'
        }`}
      >
        {title}
      </h3>
      <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs text-gray-400">
        {/* Perfil de outra pessoa: só o limite do tier, nunca o número exato. */}
        <span>{isMe ? statText(badge) : publicStatText(badge)}</span>
        {unlocked && (
          <>
            <span aria-hidden="true">•</span>
            <span>Desbloqueado em {unlocked}</span>
          </>
        )}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true">•</span>
          <RarityChip badge={badge} />
        </span>
      </p>

      <div className="mt-5 w-full rounded-xl bg-input p-4">
        {isMe && <BadgeProgress badge={badge} mythic={mythic} />}

        <p className="text-sm leading-snug text-gray-200">{badge.description}</p>

        <div className="my-4 h-px bg-fg/10" />
        <p className="text-sm font-semibold text-strong">
          {isMe ? 'Tiers' : `Progresso de ${ownerName}`}
        </p>
        <BadgeTierLadder badge={badge} />
      </div>
    </div>
  )
}

/**
 * "Badges de Fulano" (como no Discord): grade à esquerda, o badge escolhido
 * à direita com arte grande, tier, estatística, raridade e a escada. Só
 * aparecem os badges já conquistados (o primeiro tier faz a categoria
 * surgir); no seu próprio perfil, também a barra de progresso até o próximo
 * tier.
 */
function BadgesModal(): React.JSX.Element | null {
  const target = useBadgeStore((s) => s.modal)
  const close = useBadgeStore((s) => s.closeModal)
  const openModal = useBadgeStore((s) => s.openModal)
  const me = useAuthStore((s) => s.user)
  const badges = useBadgeStore((s) => (target ? s.byUser[target.userId]?.badges : undefined))
  // Escolha vale só para esta abertura do modal (target novo = escolha nova).
  const [picked, setPicked] = useState<{ target: BadgesModalTarget; category: string } | null>(null)

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const open = Boolean(target)

  // Ao abrir: foco no Fechar. Ao fechar: o foco volta para onde estava.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  // Captura na janela: Esc fecha só este modal (não chega nos outros
  // atalhos) e o Tab fica preso dentro dele.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      trapTab(e, dialogRef.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, close])

  if (!target) return null

  const isMe = target.userId === me?.id
  const earned = visibleBadges(badges)
  const selected = selectedBadge(earned, target, picked)
  const select = (category: string): void => setPicked({ target, category })

  const viewMine = (): void => {
    if (!me) return
    openModal({
      userId: me.id,
      name: me.display_name || me.username,
      avatarUrl: me.avatar_url
    })
  }

  return createPortal(
    <div
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      style={{ top: 'var(--titlebar-height, 0px)' }}
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(600px,100%)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-subtle text-gray-200 shadow-2xl md:flex-row"
      >
        <BadgesAside
          target={target}
          isMe={isMe}
          titleId={titleId}
          badges={badges}
          earned={earned}
          selected={selected}
          onSelect={select}
          canViewMine={Boolean(me)}
          onViewMine={viewMine}
        />

        <section className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-primary p-6">
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-strong/60 transition-colors hover:bg-fg/10 hover:text-strong"
          >
            ✕
          </button>
          {selected ? (
            <Detail badge={selected} isMe={isMe} ownerName={target.name} />
          ) : !badges ? (
            <BadgeDetailSkeleton />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Nada por aqui ainda.
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body
  )
}

export default BadgesModal
