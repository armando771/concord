import { create } from 'zustand'
import {
  DEFAULT_THEME,
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeId,
  type ThemePreference
} from '../lib/themes'

// Tema de cor (Configurações → Aparência). A escolha fica neste computador
// (localStorage), como as outras preferências locais; o tema em vigor vai no
// data-theme do <html>, que o assets/theme.css lê.

const DARK_QUERY = '(prefers-color-scheme: dark)'

function loadPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

function savePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // Sem armazenamento: vale só até fechar o app.
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches
  } catch {
    return true
  }
}

/** Liga o tema no documento: atributo, cor da aba (web) e barra nativa (desktop). */
function applyTheme(theme: ThemeId, paintTitleBar: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (root.dataset.theme === theme) return
  root.dataset.theme = theme
  const style = getComputedStyle(root)
  const bg = style.getPropertyValue('--bg-app').trim()
  const symbols = style.getPropertyValue('--interactive-normal').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  if (paintTitleBar) window.api?.windowTheme?.setTitleBarColors({ color: bg, symbolColor: symbols })
}

interface ThemeState {
  /** O que o usuário escolheu (pode ser "system"). */
  preference: ThemePreference
  /** O tema em vigor agora. */
  theme: ThemeId
  setPreference: (pref: ThemePreference) => void
}

let paintTitleBar = true

export const useThemeStore = create<ThemeState>()((set) => {
  const preference = loadPreference()
  return {
    preference,
    theme: resolveTheme(preference, systemPrefersDark()),
    setPreference: (pref) => {
      savePreference(pref)
      const theme = resolveTheme(pref, systemPrefersDark())
      applyTheme(theme, paintTitleBar)
      set({ preference: pref, theme })
    }
  }
})

let started = false

/**
 * Aplica o tema salvo antes do primeiro render (sem piscar o padrão) e passa a
 * acompanhar o sistema e as outras janelas (o overlay e o app dividem o
 * localStorage). `titleBar: false` no overlay, que não tem barra.
 */
export function startThemeSync({ titleBar = true }: { titleBar?: boolean } = {}): void {
  paintTitleBar = titleBar
  applyTheme(useThemeStore.getState().theme, paintTitleBar)
  if (started || typeof window === 'undefined') return
  started = true

  const refresh = (pref: ThemePreference): void => {
    const theme = resolveTheme(pref, systemPrefersDark())
    applyTheme(theme, paintTitleBar)
    useThemeStore.setState({ preference: pref, theme })
  }

  try {
    window.matchMedia(DARK_QUERY).addEventListener('change', () => {
      const { preference } = useThemeStore.getState()
      if (preference === 'system') refresh(preference)
    })
  } catch {
    // Sem matchMedia: "Seguir o sistema" fica no escuro.
  }

  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) refresh(parseThemePreference(e.newValue))
  })
}
