import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Badge } from '../../api/badges'
import type { BadgesModalTarget } from '../../store/badgeStore'
import { useAuthStore } from '../../store/authStore'
import { useBadgeStore } from '../../store/badgeStore'
import {
  formatThreshold,
  formatUnlockDate,
  isMythic,
  progressPercent,
  rarityMeta,
  remainingText,
  splitBadges,
  publicStatText,
  statText
} from '../../lib/badges'
import { trapTab } from '../../lib/focusTrap'
import Avatar from '../Avatar'
import { LockIcon } from '../icons'
import BadgeIcon from './BadgeIcon'

function RarityChip({ badge }: { badge: Badge }): React.JSX.Element {
  if (badge.tier === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-fg/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-300">
        <LockIcon className="h-3 w-3" />
        Bloqueado
      </span>
    )
  }
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

function Tile({
  badge,
  selected,
  locked,
  onSelect
}: {
  badge: Badge
  selected: boolean
  locked?: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={locked ? badge.name : `${badge.tier_name} · ${badge.name}`}
      className={`flex aspect-square cursor-pointer items-center justify-center rounded-xl border transition-colors ${
        selected ? 'border-brand bg-brand/15' : 'border-transparent bg-fg/5 hover:bg-fg/10'
      }`}
    >
      <BadgeIcon
        category={badge.category}
        tier={badge.tier}
        rarity={badge.rarity}
        size={34}
        locked={locked}
      />
    </button>
  )
}

function Grid({
  badges,
  selected,
  locked,
  onSelect
}: {
  badges: Badge[]
  selected: string | undefined
  locked?: boolean
  onSelect: (category: string) => void
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2">
      {badges.map((b) => (
        <Tile
          key={b.category}
          badge={b}
          locked={locked}
          selected={selected === b.category}
          onSelect={() => onSelect(b.category)}
        />
      ))}
    </div>
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
  const earned = badge.tier > 0
  const meta = rarityMeta(badge.rarity)
  const title = earned ? badge.tier_name : badge.next_tier_name
  const unlocked = formatUnlockDate(badge.unlocked_at)
  const maxed = badge.tier >= badge.tiers.length
  // O mítico tem a própria aura (MythicIcon); os outros, um brilho na cor.
  const mythic = earned && isMythic(badge.rarity)

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {!mythic && (
          <span
            aria-hidden="true"
            className="absolute inset-4 rounded-full blur-2xl"
            style={{ background: earned ? `${meta.color}33` : 'var(--bg-hover)' }}
          />
        )}
        <BadgeIcon
          category={badge.category}
          tier={badge.tier}
          rarity={badge.rarity}
          size={168}
          locked={!earned}
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
        {isMe && (
          <>
            <p className="text-sm font-semibold text-strong">Seu progresso</p>
            <div className="mt-3 flex items-center gap-3">
              {earned && (
                <BadgeIcon
                  category={badge.category}
                  tier={badge.tier}
                  rarity={badge.rarity}
                  size={32}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-100">{remainingText(badge)}</p>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-fg/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent(badge)}
                  aria-label={`Progresso para ${badge.next_tier_name ?? 'o próximo tier'}`}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      mythic ? 'mythic-bar' : 'bg-brand'
                    }`}
                    style={{ width: `${progressPercent(badge)}%` }}
                  />
                </div>
              </div>
              {!maxed && (
                <BadgeIcon
                  category={badge.category}
                  tier={badge.tier + 1}
                  rarity={badge.tiers[badge.tier]?.rarity}
                  size={32}
                  locked
                />
              )}
            </div>
            <div className="my-4 h-px bg-fg/10" />
          </>
        )}

        <p className="text-sm leading-snug text-gray-200">{badge.description}</p>

        <div className="my-4 h-px bg-fg/10" />
        <p className="text-sm font-semibold text-strong">
          {isMe ? 'Tiers' : `Progresso de ${ownerName}`}
        </p>
        <ol className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
          {badge.tiers.map((t) => {
            const done = Boolean(t.unlocked_at)
            return (
              <li
                key={t.tier}
                className="flex flex-col items-center text-center"
                title={done ? `Desbloqueado em ${formatUnlockDate(t.unlocked_at)}` : undefined}
              >
                <BadgeIcon
                  category={badge.category}
                  tier={t.tier}
                  rarity={t.rarity}
                  size={40}
                  locked={!done}
                />
                <span
                  className={`mt-1 text-xs font-semibold ${done ? 'text-gray-100' : 'text-gray-500'}`}
                >
                  {t.name}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-[11px] ${done ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  {!done && <LockIcon className="h-2.5 w-2.5" />}
                  {formatThreshold(badge.unit, t.threshold)}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/**
 * "Badges de Fulano" (como no Discord): grade à esquerda, o badge escolhido
 * à direita com arte grande, tier, estatística, raridade e a escada. No seu
 * próprio perfil aparecem também os que dá para desbloquear e a barra de
 * progresso até o próximo tier.
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
  const { earned, available } = splitBadges(badges ?? [])
  const visible = isMe ? [...earned, ...available] : earned
  const wanted = picked?.target === target ? picked.category : target.category
  const selected = visible.find((b) => b.category === wanted) ?? visible[0]
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
        className="flex h-[min(600px,100%)] w-full max-w-[760px] overflow-hidden rounded-2xl border border-subtle text-gray-200 shadow-2xl"
      >
        <aside className="flex w-[290px] shrink-0 flex-col bg-secondary">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-2.5">
              {!isMe && (
                <Avatar
                  userId={target.userId}
                  name={target.name}
                  avatarUrl={target.avatarUrl}
                  size={28}
                />
              )}
              <h2 id={titleId} className="min-w-0 truncate text-xl font-bold text-strong">
                {isMe ? 'Seus badges' : `Badges de ${target.name}`}
              </h2>
            </div>
            <p className="mt-1.5 text-sm leading-snug text-gray-400">
              {isMe
                ? 'Veja seus badges e descubra quais você ainda pode desbloquear.'
                : `Explore os badges de ${target.name} ou veja os seus para descobrir o que dá para desbloquear.`}
            </p>

            {!badges ? (
              <p className="mt-6 text-sm text-gray-500">Carregando…</p>
            ) : (
              <>
                {earned.length > 0 ? (
                  <div className="mt-5">
                    <Grid badges={earned} selected={selected?.category} onSelect={select} />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-gray-500">
                    {isMe ? 'Você ainda não tem badges.' : 'Nenhum badge ainda.'}
                  </p>
                )}
                {isMe && available.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-2.5 text-sm font-semibold text-strong">
                      Disponíveis para desbloquear
                    </p>
                    <Grid
                      badges={available}
                      locked
                      selected={selected?.category}
                      onSelect={select}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          {!isMe && me && (
            <div className="border-t border-subtle p-4">
              <button
                type="button"
                onClick={viewMine}
                className="w-full cursor-pointer rounded-lg bg-fg/10 px-3 py-2 text-sm font-semibold text-strong transition-colors hover:bg-fg/15"
              >
                Ver seus badges
              </button>
            </div>
          )}
        </aside>

        <section className="relative min-w-0 flex-1 overflow-y-auto bg-primary p-6">
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
          ) : (
            badges && (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                {isMe ? 'Fique em call e converse para ganhar o primeiro.' : 'Nada por aqui ainda.'}
              </div>
            )
          )}
        </section>
      </div>
    </div>,
    document.body
  )
}

export default BadgesModal
