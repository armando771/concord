import { useEffect, type RefObject } from 'react'
import { useChannelSidebarStore } from '../store/channelSidebarStore'
import { shouldDismissMenu } from '../lib/channelSidebar'

/** Com o menu de um canal aberto: clique fora ou Esc fecham. */
export function useChannelMenuDismiss(menuRef: RefObject<HTMLDivElement | null>): void {
  const menuFor = useChannelSidebarStore((s) => s.menuFor)
  const closeMenu = useChannelSidebarStore((s) => s.closeMenu)
  useEffect(() => {
    if (menuFor === null) return
    const onDown = (e: MouseEvent): void => {
      if (shouldDismissMenu(e.target as Element | null, menuRef.current)) closeMenu()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuFor, menuRef, closeMenu])
}
