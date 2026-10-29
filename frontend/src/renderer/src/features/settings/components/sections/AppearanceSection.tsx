import { THEMES, type ThemeInfo } from '../../lib/themes'
import { useThemeStore } from '../../store/themeStore'
import { Toggle } from '../Toggle'

/**
 * Miniatura do app pintada com o próprio tema: o data-theme no cartão faz os
 * tokens (bg-primary, text-normal…) valerem só ali dentro.
 */
function ThemePreview({ theme }: { theme: ThemeInfo }): React.JSX.Element {
  return (
    <div data-theme={theme.id} aria-hidden="true" className="flex h-24 overflow-hidden bg-app">
      {/* Trilho de servidores */}
      <div className="flex w-6 shrink-0 flex-col items-center gap-1 bg-tertiary pt-1.5">
        <span className="h-3.5 w-3.5 rounded-md bg-brand" />
        <span className="h-3.5 w-3.5 rounded-full bg-surface" />
        <span className="h-3.5 w-3.5 rounded-full bg-surface" />
      </div>
      {/* Canais */}
      <div className="flex w-14 shrink-0 flex-col gap-1 bg-secondary p-1.5">
        <span className="h-1.5 w-8 rounded-full bg-fg/15" />
        <span className="rounded bg-selected px-1 text-[8px] leading-3 font-medium text-interactive-active">
          # geral
        </span>
        <span className="px-1 text-[8px] leading-3 text-interactive-normal"># jogos</span>
      </div>
      {/* Chat */}
      <div className="flex min-w-0 flex-1 flex-col justify-between bg-primary p-1.5">
        <div className="flex gap-1">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-success" />
          <span className="min-w-0 leading-none">
            <span className="block truncate text-[8px] font-semibold text-strong">
              Ana <span className="font-normal text-faint">agora</span>
            </span>
            <span className="block truncate text-[8px] text-normal">Bora jogar hoje?</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 min-w-0 flex-1 rounded border border-normal bg-input" />
          <span className="rounded bg-brand px-1 text-[7px] leading-3 font-semibold text-white">
            Enviar
          </span>
        </div>
      </div>
    </div>
  )
}

/** Configurações → Aparência: tema de cor (vale na hora e fica salvo neste computador). */
export function AppearanceSection(): React.JSX.Element {
  const preference = useThemeStore((s) => s.preference)
  const active = useThemeStore((s) => s.theme)
  const setPreference = useThemeStore((s) => s.setPreference)
  const followSystem = preference === 'system'
  const activeLabel = THEMES.find((t) => t.id === active)?.label ?? ''

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-subtle bg-fg/5 p-4">
        <Toggle
          title="Seguir o sistema"
          description={
            followSystem
              ? `Claro ou escuro conforme o sistema. Agora: ${activeLabel}.`
              : 'Usa Discord Claro ou Escuro conforme o modo do sistema.'
          }
          checked={followSystem}
          onChange={() => setPreference(followSystem ? active : 'system')}
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-ds-sm font-medium text-gray-400">Tema</legend>
        <p className="mb-3 text-ds-sm text-gray-400">
          A cor muda na hora e fica salva só neste computador.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {THEMES.map((theme) => {
            const selected = !followSystem && preference === theme.id
            return (
              <label key={theme.id} className="group cursor-pointer">
                <input
                  type="radio"
                  name="salinha-theme"
                  value={theme.id}
                  checked={selected}
                  onChange={() => setPreference(theme.id)}
                  className="peer sr-only"
                />
                <div
                  className={`overflow-hidden rounded-lg border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg-primary)] ${
                    selected ? 'border-brand' : 'border-subtle group-hover:border-strong'
                  }`}
                >
                  <ThemePreview theme={theme} />
                </div>
                <span className="mt-1.5 flex items-center gap-1.5 text-ds-sm font-medium text-strong">
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-brand bg-brand' : 'border-gray-500'
                    }`}
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  {theme.label}
                </span>
                <span className="mt-0.5 block text-ds-xs text-gray-400">{theme.description}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
