import { useCallback, useEffect, type CSSProperties } from 'react'
import { clampWidth, dragBoundsFor, SIDEBARS, type SidebarId } from '../lib/sidebarWidth'
import { selectSidebarWidth, useSidebarWidthStore } from '../store/sidebarWidthStore'
import type { ResizeHandleProps } from './ResizeHandle'

const LABELS: Record<SidebarId, string> = {
  channels: 'Redimensionar a barra de canais',
  members: 'Redimensionar a lista de membros'
}

/**
 * Barra lateral com largura ajustável: devolve o estilo do painel (a largura
 * vai na variável CSS --panel-w, que a alça muda direto durante o arrasto) e as
 * props da <ResizeHandle>, que deve ser filha direta do painel. Só grava no
 * store/localStorage ao soltar.
 */
export function useResizableWidth(id: SidebarId): {
  width: number
  panelStyle: CSSProperties
  handleProps: ResizeHandleProps
} {
  const width = useSidebarWidthStore(selectSidebarWidth(id))
  const setPreferred = useSidebarWidthStore((s) => s.setPreferred)
  const resetPreferred = useSidebarWidthStore((s) => s.resetPreferred)
  const setMounted = useSidebarWidthStore((s) => s.setMounted)

  // A largura das outras barras depende de esta estar na tela.
  useEffect(() => {
    setMounted(id, true)
    return () => setMounted(id, false)
  }, [id, setMounted])

  // Primitivos: só re-renderiza quando o limite muda, não a cada resize.
  const min = SIDEBARS[id].min
  const max = useSidebarWidthStore((s) => dragBoundsFor(id, s).max)
  const onCommit = useCallback(
    (next: number) =>
      setPreferred(id, clampWidth(next, dragBoundsFor(id, useSidebarWidthStore.getState()))),
    [id, setPreferred]
  )
  const onReset = useCallback(() => resetPreferred(id), [id, resetPreferred])

  return {
    width,
    panelStyle: { '--panel-w': `${width}px`, width: 'var(--panel-w)' } as CSSProperties,
    handleProps: {
      side: SIDEBARS[id].side,
      width,
      bounds: { min, max },
      onCommit,
      onReset,
      label: LABELS[id]
    }
  }
}
