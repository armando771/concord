import { useEffect, useLayoutEffect, useState } from 'react'
import { createSubmenuController, type SubmenuController } from '../lib/submenuController'
import type { SubmenuPlacement } from '../lib/submenuPlacement'

function listen(
  target: 'document' | 'window',
  type: string,
  handler: (e: { target: unknown }) => void,
  capture = false
): () => void {
  const el: EventTarget = target === 'document' ? document : window
  const fn = handler as EventListener
  el.addEventListener(type, fn, capture)
  return () => el.removeEventListener(type, fn, capture)
}

export interface ContextSubmenuState {
  open: boolean
  placement: SubmenuPlacement | null
  /** `ref` do item pai e do painel (callbacks: o controller lê os elementos daqui). */
  setTrigger: (el: HTMLButtonElement | null) => void
  setPanel: (el: HTMLDivElement | null) => void
  /** Fecha o submenu e devolve o foco ao item pai. */
  closeToTrigger: () => void
  triggerProps: Pick<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onClick' | 'onKeyDown' | 'onPointerEnter' | 'onPointerMove' | 'onPointerLeave'
  >
  panelProps: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    'onKeyDown' | 'onPointerEnter' | 'onPointerLeave'
  >
}

/**
 * Liga o `SubmenuController` ao React: estado aberto, posição e os handlers do
 * item pai e do painel. As regras (hover com atraso, diagonal, teclado,
 * posição) moram no controller, que tem teste.
 */
export function useContextSubmenu(): ContextSubmenuState {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<SubmenuPlacement | null>(null)
  const [ctl] = useState<SubmenuController>(() =>
    createSubmenuController({
      setOpen,
      setPlacement,
      viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      activeElement: () => document.activeElement,
      listen
    })
  )

  useLayoutEffect(() => {
    if (open) ctl.layout()
  }, [open, ctl])
  useEffect(() => (open ? ctl.attach() : undefined), [open, ctl])
  useEffect(() => () => ctl.dispose(), [ctl])

  return {
    open,
    placement,
    setTrigger: ctl.setTrigger,
    setPanel: ctl.setPanel,
    closeToTrigger: () => ctl.close(true),
    triggerProps: {
      // Enter e Espaço chegam como clique sem coordenadas (detail 0): teclado.
      onClick: (e) => ctl.open(e.detail === 0),
      onKeyDown: (e) => {
        if (ctl.keyDownTrigger(e.key)) e.preventDefault()
      },
      onPointerEnter: (e) => ctl.hoverEnter(e.pointerType),
      onPointerMove: (e) => ctl.pointerMove({ x: e.clientX, y: e.clientY }),
      onPointerLeave: (e) => ctl.hoverLeave(e.pointerType, { x: e.clientX, y: e.clientY })
    },
    panelProps: {
      onKeyDown: (e) => {
        if (!ctl.keyDownPanel(e.key)) return
        // Esc no submenu fecha só o submenu, não o menu inteiro.
        e.preventDefault()
        e.stopPropagation()
      },
      onPointerEnter: () => ctl.panelEnter(),
      onPointerLeave: (e) => ctl.panelLeave(e.pointerType)
    }
  }
}
