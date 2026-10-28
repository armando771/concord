import { useEffect } from 'react'
import { useCallStore } from '../store/callStore'
import { useSoundboardStore } from '../store/soundboardStore'
import { useSoundFavoritesStore } from '../store/soundFavoritesStore'
import { findSoundForShortcut } from '../lib/soundboardSections'

const MODIFIER_ONLY_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

export function formatKeyboardShortcut(e: KeyboardEvent): string | null {
  if (MODIFIER_ONLY_KEYS.has(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let main = e.key
  if (main === ' ') main = 'Space'
  else if (main.length === 1) main = main.toUpperCase()

  // Para evitar disparo acidental digitando no app, teclas simples de 1 letra/número
  // sem modificador exigem pelo menos Alt/Ctrl (teclas F1–F12 funcionam sozinhas).
  const isFunctionKey = /^F([1-9]|1[0-2])$/i.test(main)
  if (parts.length === 0 && !isFunctionKey) {
    return null
  }
  parts.push(main)
  return parts.join('+')
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

export function useSoundboardHotkeys(): void {
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const serverId = useCallStore((s) => s.serverId)
  const loadServerSounds = useSoundboardStore((s) => s.loadServerSounds)
  const loadFavorites = useSoundFavoritesStore((s) => s.load)

  useEffect(() => {
    if (status === 'active' && type === 'channel' && serverId) {
      void loadServerSounds(serverId)
      void loadFavorites()
    }
  }, [status, type, serverId, loadServerSounds, loadFavorites])

  useEffect(() => {
    if (status !== 'active' || type !== 'channel' || !serverId) return

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat || isEditableElement(e.target)) return
      const shortcut = formatKeyboardShortcut(e)
      if (!shortcut) return

      const { keybinds, soundsByServer, triggerSound } = useSoundboardStore.getState()
      // Os do servidor da chamada e os favoritos (que podem ser de outro servidor).
      const sounds = [
        ...(soundsByServer[serverId] ?? []),
        ...useSoundFavoritesStore.getState().favorites
      ]
      const match = findSoundForShortcut(shortcut, keybinds, sounds)
      if (match) {
        e.preventDefault()
        triggerSound(match.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, type, serverId])
}
