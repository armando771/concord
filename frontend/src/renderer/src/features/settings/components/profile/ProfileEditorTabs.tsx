import { useRef } from 'react'
import { PROFILE_TABS, nextTab, panelId, tabId, type ProfileTab } from '../../lib/profileTabs'

/**
 * Abas do editor de perfil num controle segmentado (setas ←/→ trocam, como
 * manda o padrão de tabs). `alert` marca a aba que tem campo com erro.
 */
export default function ProfileEditorTabs({
  value,
  alert,
  onChange
}: {
  value: ProfileTab
  alert: ProfileTab | null
  onChange: (tab: ProfileTab) => void
}): React.JSX.Element {
  const list = useRef<HTMLDivElement>(null)
  const onKey = (e: React.KeyboardEvent): void => {
    const next = nextTab(value, e.key)
    if (!next) return
    e.preventDefault()
    onChange(next)
    list.current?.querySelector<HTMLElement>(`#${tabId(next)}`)?.focus()
  }
  return (
    <div
      ref={list}
      role="tablist"
      aria-label="Partes do perfil"
      onKeyDown={onKey}
      className="grid grid-cols-2 gap-1 rounded-xl bg-fg/5 p-1"
    >
      {PROFILE_TABS.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId(t.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-ds-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              active ? 'bg-brand text-white shadow' : 'text-gray-400 hover:bg-fg/5 hover:text-strong'
            }`}
          >
            {t.label}
            {alert === t.id && (
              <span className="size-2 rounded-full bg-danger" aria-label="tem campo com erro" />
            )}
          </button>
        )
      })}
    </div>
  )
}
