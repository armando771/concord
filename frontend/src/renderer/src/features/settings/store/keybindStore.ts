import { create } from 'zustand'
import type { Binding } from '../lib/keybinds'
import {
  EMPTY_PREFS,
  sanitizeKeybindPrefs,
  type BindingOverrides,
  type GlobalFlags,
  type KeybindPrefs
} from '../lib/keybindPrefs'
import type { ShortcutId } from '../lib/shortcuts'

const STORAGE_KEY = 'concord:keybinds'

function load(): KeybindPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeKeybindPrefs(JSON.parse(raw)) : EMPTY_PREFS
  } catch {
    return EMPTY_PREFS
  }
}

function save(prefs: KeybindPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Sem armazenamento: vale só até fechar o app.
  }
}

interface KeybindState extends KeybindPrefs {
  /** Resultado do registro global no main (só desta sessão): true = registrou. */
  globalActive: Partial<Record<ShortcutId, boolean>>
  /** Gravando um atalho nas configurações: os atalhos do app e os globais ficam parados. */
  recording: boolean
  /** Define o atalho (null tira o atalho). */
  setBinding: (id: ShortcutId, binding: Binding | null) => void
  /** Volta ao de fábrica. */
  resetBinding: (id: ShortcutId) => void
  resetAll: () => void
  setGlobal: (id: ShortcutId, on: boolean) => void
  setGlobalActive: (active: Partial<Record<ShortcutId, boolean>>) => void
  setRecording: (recording: boolean) => void
}

const initial = load()

export const useKeybindStore = create<KeybindState>()((set, get) => {
  const persist = (patch: { overrides?: BindingOverrides; global?: GlobalFlags }): void => {
    const next = {
      overrides: patch.overrides ?? get().overrides,
      global: patch.global ?? get().global
    }
    set(next)
    save(next)
  }
  return {
    ...initial,
    globalActive: {},
    recording: false,
    setBinding: (id, binding) => persist({ overrides: { ...get().overrides, [id]: binding } }),
    resetBinding: (id) => {
      const overrides = { ...get().overrides }
      delete overrides[id]
      persist({ overrides })
    },
    resetAll: () => persist({ overrides: {}, global: {} }),
    setGlobal: (id, on) => {
      const global = { ...get().global }
      if (on) global[id] = true
      else delete global[id]
      persist({ global })
    },
    setGlobalActive: (globalActive) => set({ globalActive }),
    setRecording: (recording) => set({ recording })
  }
})
