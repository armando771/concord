import { useEffect, useState } from 'react'
import { Toggle } from '../Toggle'
import Button from '../../../../shared/ui/Button'
import { bindingFromKeyEvent, bindingFromMouseButton, bindingLabels } from '../../lib/keybinds'
import { effectiveBindings } from '../../lib/keybindPrefs'
import {
  SHORTCUTS,
  SHORTCUT_GROUP_LABELS,
  findConflict,
  isMacPlatform,
  type ShortcutDef,
  type ShortcutGroup
} from '../../lib/shortcuts'
import { useKeybindStore } from '../../store/keybindStore'

const GROUP_ORDER: ShortcutGroup[] = ['navigation', 'voice', 'chat']
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'])

function Keys({ binding }: { binding: string | null }): React.JSX.Element {
  if (!binding) return <span className="text-xs text-gray-500">Sem atalho</span>
  return (
    <span className="flex gap-1">
      {bindingLabels(binding, isMacPlatform()).map((k) => (
        <kbd key={k} className="rounded bg-fg/10 px-1.5 py-0.5 text-xs font-semibold text-strong">
          {k}
        </kbd>
      ))}
    </span>
  )
}

/**
 * Campo de um atalho: clica e aperta a tecla ou o botão do mouse (Esc cancela;
 * clicar fora também). Esquerdo e direito do mouse não podem ser atalho.
 */
function BindingField({
  def,
  onError
}: {
  def: ShortcutDef
  onError: (message: string | null) => void
}): React.JSX.Element {
  const overrides = useKeybindStore((s) => s.overrides)
  const setBinding = useKeybindStore((s) => s.setBinding)
  const setRecording = useKeybindStore((s) => s.setRecording)
  const [recording, setLocalRecording] = useState(false)
  const bindings = effectiveBindings(overrides)

  useEffect(() => {
    if (!recording) return
    setRecording(true)

    const finish = (binding: string | null | undefined): void => {
      setLocalRecording(false)
      if (binding === undefined) return
      const conflict = binding ? findConflict(def.id, binding, bindings) : null
      if (conflict) onError(`Esse atalho já é de "${conflict.label}". Tire-o de lá primeiro.`)
      else setBinding(def.id, binding)
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      // Gravando, a tecla é o atalho: nada chega ao resto do app (nem o Esc das configurações).
      e.preventDefault()
      e.stopPropagation()
      if (MODIFIER_KEYS.has(e.key)) return
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        finish(undefined)
        return
      }
      const binding = bindingFromKeyEvent(e)
      if (!binding) {
        setLocalRecording(false)
        onError('Essa tecla não pode ser atalho sozinha. Use Ctrl, Alt ou uma tecla F1–F24.')
        return
      }
      finish(binding)
    }

    const onMouseDown = (e: MouseEvent): void => {
      const binding = bindingFromMouseButton(e.button)
      if (!binding) {
        // Botão esquerdo ou direito: cancela (o clique segue normalmente). Em cima do
        // próprio campo quem cancela é o onClick dele.
        if (!(e.target instanceof Element && e.target.closest('[data-binding-field]'))) {
          finish(undefined)
        }
        return
      }
      e.preventDefault()
      e.stopPropagation()
      // O voltar/avançar do mouse navegaria ao soltar: engole o fim do clique.
      const swallow = (ev: Event): void => ev.preventDefault()
      window.addEventListener('mouseup', swallow, { capture: true, once: true })
      window.addEventListener('auxclick', swallow, { capture: true, once: true })
      finish(binding)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      setRecording(false)
    }
    // bindings muda a cada mudança; a gravação só precisa da versão do momento de gravar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, def.id])

  return (
    <button
      type="button"
      data-binding-field
      aria-label={`Atalho de "${def.label}". Clique e aperte a tecla ou o botão do mouse.`}
      onClick={() => {
        onError(null)
        setLocalRecording((r) => !r)
      }}
      className={`flex min-w-[10rem] shrink-0 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-violet-400 ${
        recording
          ? 'border-brand bg-brand/15 text-xs font-semibold text-strong'
          : 'border-subtle bg-fg/10 hover:bg-fg/15'
      }`}
    >
      {recording ? 'Aperte a tecla ou o botão…' : <Keys binding={bindings[def.id]} />}
    </button>
  )
}

function Row({
  def,
  onError
}: {
  def: ShortcutDef
  onError: (message: string | null) => void
}): React.JSX.Element {
  const overrides = useKeybindStore((s) => s.overrides)
  const global = useKeybindStore((s) => s.global)
  const globalActive = useKeybindStore((s) => s.globalActive)
  const setBinding = useKeybindStore((s) => s.setBinding)
  const resetBinding = useKeybindStore((s) => s.resetBinding)
  const setGlobal = useKeybindStore((s) => s.setGlobal)
  const bindings = effectiveBindings(overrides)
  const changed = def.id in overrides
  const canGlobal = Boolean(def.canBeGlobal && window.api?.keybinds)

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-ds-md text-gray-200">{def.label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <BindingField def={def} onError={onError} />
          <button
            type="button"
            title="Tirar o atalho"
            aria-label={`Tirar o atalho de "${def.label}"`}
            disabled={!bindings[def.id]}
            onClick={() => {
              onError(null)
              setBinding(def.id, null)
            }}
            className="h-8 w-8 cursor-pointer rounded-md text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ✕
          </button>
          <button
            type="button"
            title="Voltar ao padrão"
            aria-label={`Voltar ao padrão: "${def.label}"`}
            disabled={!changed}
            onClick={() => {
              onError(null)
              resetBinding(def.id)
            }}
            className="h-8 w-8 cursor-pointer rounded-md text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ↺
          </button>
        </div>
      </div>
      {canGlobal && (
        <div className="rounded-lg bg-input px-3 py-2">
          <Toggle
            title="Funcionar com o app em segundo plano"
            description="Vale mesmo com a Salinha minimizada ou em outro programa (ex.: jogando)."
            checked={Boolean(global[def.id])}
            onChange={() => setGlobal(def.id, !global[def.id])}
          />
          {global[def.id] && bindings[def.id] && globalActive[def.id] === false && (
            <p className="mt-2 text-xs text-amber-300">
              Não foi possível ativar fora do app: o atalho está em uso por outro programa.
            </p>
          )}
        </div>
      )}
    </li>
  )
}

/** Configurações → Atalhos: tecla ou botão do mouse para cada ação. */
export function KeybindsSection(): React.JSX.Element {
  const overrides = useKeybindStore((s) => s.overrides)
  const global = useKeybindStore((s) => s.global)
  const resetAll = useKeybindStore((s) => s.resetAll)
  const [error, setError] = useState<string | null>(null)
  const customized = Object.keys(overrides).length > 0 || Object.keys(global).length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-subtle bg-fg/5 p-4">
        <p className="text-ds-md font-medium text-strong">Atalhos</p>
        <p className="mt-1 text-ds-sm text-gray-400">
          Clique em um atalho e aperte a nova tecla ou um botão do mouse (meio ou laterais). Esc
          cancela.
        </p>
        {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
      </div>

      {GROUP_ORDER.map((group) => (
        <section key={group} className="rounded-xl border border-subtle bg-fg/5 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
            {SHORTCUT_GROUP_LABELS[group]}
          </h3>
          <ul className="flex flex-col gap-3">
            {SHORTCUTS.filter((d) => d.group === group).map((def) => (
              <Row key={def.id} def={def} onError={setError} />
            ))}
          </ul>
        </section>
      ))}

      <div>
        <Button
          variant="ghost"
          disabled={!customized}
          onClick={() => {
            setError(null)
            resetAll()
          }}
        >
          Restaurar padrões
        </Button>
      </div>
    </div>
  )
}
