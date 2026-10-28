import { useRef, type RefObject } from 'react'
import { shellPanelClasses } from '../lib/mobileNav'
import { useMobileNavStore } from '../store/mobileNavStore'
import { useIsMobile } from './useIsMobile'
import { useMobileNavSync } from './useMobileNavSync'
import { useSwipeToList } from './useSwipeToList'

/**
 * A casca no celular: segue as rotas, diz as classes das duas colunas (só
 * uma aparece abaixo do md) e liga o arrastar-para-a-lista no conteúdo.
 */
export function useMobileShell(): {
  columns: { nav: string; content: string }
  contentRef: RefObject<HTMLDivElement | null>
} {
  useMobileNavSync()
  const panel = useMobileNavStore((s) => s.panel)
  const contentRef = useRef<HTMLDivElement>(null)
  useSwipeToList(contentRef, useIsMobile() && panel === 'content')
  return { columns: shellPanelClasses(panel), contentRef }
}
