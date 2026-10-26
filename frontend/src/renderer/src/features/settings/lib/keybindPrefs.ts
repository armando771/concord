import { isValidBinding, type Binding } from './keybinds'
import { SHORTCUT_BY_ID, defaultBindings, type BindingMap, type ShortcutId } from './shortcuts'

/** Só o que o usuário mudou: null = sem atalho; ausente = o de fábrica. */
export type BindingOverrides = Partial<Record<ShortcutId, Binding | null>>
export type GlobalFlags = Partial<Record<ShortcutId, boolean>>

export interface KeybindPrefs {
  overrides: BindingOverrides
  /** Ações de voz que valem com o app em segundo plano. */
  global: GlobalFlags
}

export const EMPTY_PREFS: KeybindPrefs = { overrides: {}, global: {} }

/** Atalhos em vigor: os de fábrica com as mudanças do usuário por cima. */
export function effectiveBindings(overrides: BindingOverrides): BindingMap {
  return { ...defaultBindings(), ...overrides }
}

/** JSON salvo → preferências válidas (ação desconhecida ou atalho inválido some). */
export function sanitizeKeybindPrefs(raw: unknown): KeybindPrefs {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PREFS
  const { overrides: rawOverrides, global: rawGlobal } = raw as Record<string, unknown>
  const overrides: BindingOverrides = {}
  const global: GlobalFlags = {}
  if (typeof rawOverrides === 'object' && rawOverrides !== null) {
    for (const [id, value] of Object.entries(rawOverrides)) {
      if (!(id in SHORTCUT_BY_ID)) continue
      if (value === null || isValidBinding(value)) overrides[id as ShortcutId] = value
    }
  }
  if (typeof rawGlobal === 'object' && rawGlobal !== null) {
    for (const [id, value] of Object.entries(rawGlobal)) {
      if (id in SHORTCUT_BY_ID && SHORTCUT_BY_ID[id as ShortcutId].canBeGlobal && value === true) {
        global[id as ShortcutId] = true
      }
    }
  }
  return { overrides, global }
}

/** Atalhos de voz com "fora do app" ligado e um atalho definido, para o main registrar. */
export function globalBindingList(
  bindings: BindingMap,
  global: GlobalFlags
): { id: ShortcutId; binding: Binding }[] {
  const list: { id: ShortcutId; binding: Binding }[] = []
  for (const id of Object.keys(global) as ShortcutId[]) {
    const binding = bindings[id]
    if (global[id] && SHORTCUT_BY_ID[id]?.canBeGlobal && binding) list.push({ id, binding })
  }
  return list
}
