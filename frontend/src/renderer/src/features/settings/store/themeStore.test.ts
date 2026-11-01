import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sem DOM no vitest: localStorage, matchMedia e o <html> são de mentira.

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    }
  }
}

let systemDark = true
let mediaListener: (() => void) | null = null
let storageListener: ((e: { key: string; newValue: string | null }) => void) | null = null
const titleBar = vi.fn()
const meta = { setAttribute: vi.fn() }
const root = { dataset: {} as Record<string, string> }

/** Cores que o CSS daria a cada tema (só as que o store lê). */
const COLORS: Record<string, Record<string, string>> = {
  'discord-dark': { '--bg-app': '#121214', '--interactive-normal': '#96979e' },
  'discord-light': { '--bg-app': '#f3f3f4', '--interactive-normal': '#595a63' },
  midnight: { '--bg-app': '#0b1220', '--interactive-normal': '#b6c2d3' }
}

beforeEach(() => {
  vi.resetModules()
  systemDark = true
  mediaListener = null
  storageListener = null
  titleBar.mockClear()
  meta.setAttribute.mockClear()
  root.dataset = {}
  globalThis.localStorage = memoryStorage()
  vi.stubGlobal('document', {
    documentElement: root,
    querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? meta : null)
  })
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string) => ` ${COLORS[root.dataset.theme]?.[name] ?? ''}`
  }))
  vi.stubGlobal('window', {
    matchMedia: () => ({
      get matches() {
        return systemDark
      },
      addEventListener: (_: string, cb: () => void) => (mediaListener = cb)
    }),
    addEventListener: (type: string, cb: typeof storageListener) => {
      if (type === 'storage') storageListener = cb
    },
    api: { windowTheme: { setTitleBarColors: titleBar } }
  })
})

async function load(): Promise<typeof import('./themeStore')> {
  return import('./themeStore')
}

describe('themeStore', () => {
  it('sem nada salvo começa no Discord Escuro e pinta o documento', async () => {
    const { startThemeSync, useThemeStore } = await load()
    startThemeSync()
    expect(useThemeStore.getState()).toMatchObject({
      preference: 'discord-dark',
      theme: 'discord-dark'
    })
    expect(root.dataset.theme).toBe('discord-dark')
    expect(meta.setAttribute).toHaveBeenCalledWith('content', '#121214')
    expect(titleBar).toHaveBeenCalledWith({ color: '#121214', symbolColor: '#96979e' })
  })

  it('aplica o tema salvo já no início', async () => {
    localStorage.setItem('concord:theme', 'midnight')
    const { startThemeSync } = await load()
    startThemeSync()
    expect(root.dataset.theme).toBe('midnight')
  })

  it('trocar aplica na hora e salva', async () => {
    const { startThemeSync, useThemeStore } = await load()
    startThemeSync()
    useThemeStore.getState().setPreference('discord-light')
    expect(root.dataset.theme).toBe('discord-light')
    expect(localStorage.getItem('concord:theme')).toBe('discord-light')
    expect(titleBar).toHaveBeenLastCalledWith({ color: '#f3f3f4', symbolColor: '#595a63' })
  })

  it('"Seguir o sistema" acompanha a troca de claro/escuro do sistema', async () => {
    const { startThemeSync, useThemeStore } = await load()
    startThemeSync()
    useThemeStore.getState().setPreference('system')
    expect(useThemeStore.getState().theme).toBe('discord-dark')
    systemDark = false
    mediaListener?.()
    expect(useThemeStore.getState().theme).toBe('discord-light')
    expect(root.dataset.theme).toBe('discord-light')
  })

  it('com tema fixo, mudar o sistema não mexe', async () => {
    const { startThemeSync, useThemeStore } = await load()
    startThemeSync()
    useThemeStore.getState().setPreference('midnight')
    systemDark = false
    mediaListener?.()
    expect(root.dataset.theme).toBe('midnight')
  })

  it('outra janela (overlay ↔ app) trocou: acompanha', async () => {
    const { startThemeSync, useThemeStore } = await load()
    startThemeSync({ titleBar: false })
    storageListener?.({ key: 'concord:theme', newValue: 'midnight' })
    expect(useThemeStore.getState().preference).toBe('midnight')
    expect(root.dataset.theme).toBe('midnight')
    // O overlay não tem barra de título.
    expect(titleBar).not.toHaveBeenCalled()
    storageListener?.({ key: 'outra-coisa', newValue: 'forest' })
    expect(root.dataset.theme).toBe('midnight')
  })
})
