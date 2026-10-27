// Comportamento do submenu (flyout) de um menu de contexto, sem React nem DOM
// real: tudo que toca a tela entra por `SubmenuDeps`, então dá para testar com
// objetos de mentira. O hook `useContextSubmenu` só liga isto ao React.
import { createHoverIntent } from './hoverIntent'
import { submenuKeyAction, opensSubmenu } from './submenuKeys'
import {
  fitsBeside,
  isHeadingToPanel,
  placeSubmenu,
  type Box,
  type Point,
  type SubmenuSide
} from './submenuPlacement'
import type { SubmenuPlacement } from './submenuPlacement'

const OPEN_DELAY = 120
const CLOSE_DELAY = 150
/** Mouse indo na diagonal para o painel: dá tempo de cruzar os outros itens. */
const TOWARD_CLOSE_DELAY = 450
const MENU_SELECTOR = '[role="menu"]'
/** Itens do painel; o "Voltar" do modo que cobre o menu fica de fora do foco inicial. */
const ITEM_SELECTOR = '[role^="menuitem"]'
const FIRST_ITEM_SELECTOR = '[role^="menuitem"]:not([data-submenu-back])'

interface Measurable {
  getBoundingClientRect(): Box
}
interface FocusableList extends Measurable {
  contains(node: unknown): boolean
  querySelectorAll(selector: string): ArrayLike<{ focus(): void }>
}
interface TriggerElement extends Measurable {
  closest(selector: string): Measurable | null
  contains(node: unknown): boolean
  focus(): void
}

export interface SubmenuDeps {
  setOpen(open: boolean): void
  setPlacement(placement: SubmenuPlacement): void
  viewport(): { width: number; height: number }
  activeElement(): unknown
  /** Registra um listener global e devolve como soltá-lo. */
  listen(
    target: 'document' | 'window',
    type: string,
    handler: (e: { target: unknown }) => void,
    capture?: boolean
  ): () => void
}

export interface SubmenuController {
  /** Registram os elementos (callback ref do React). */
  setTrigger(el: TriggerElement | null): void
  setPanel(el: FocusableList | null): void
  hoverEnter(pointerType: string): void
  hoverLeave(pointerType: string, at: Point): void
  pointerMove(at: Point): void
  panelEnter(): void
  panelLeave(pointerType: string): void
  /** Abre (clique, toque, Enter ou seta); `viaKeyboard` leva o foco ao primeiro item. */
  open(viaKeyboard: boolean): void
  close(refocus: boolean): void
  keyDownTrigger(key: string): boolean
  keyDownPanel(key: string): boolean
  /** Chamar depois que o painel entrou na tela: mede, posiciona e foca. */
  layout(): void
  outsideDown(node: unknown): void
  /** Escuta clique fora, resize e scroll enquanto aberto; devolve o cleanup. */
  attach(): () => void
  dispose(): void
}

export function createSubmenuController(deps: SubmenuDeps): SubmenuController {
  let isOpen = false
  let wantFocus = false
  let side: SubmenuSide = 'right'
  let last: Point | null = null
  let trigger: TriggerElement | null = null
  let panel: FocusableList | null = null

  const set = (open: boolean): void => {
    isOpen = open
    if (!open) side = 'right'
    deps.setOpen(open)
  }
  const hover = createHoverIntent({
    openDelay: OPEN_DELAY,
    closeDelay: CLOSE_DELAY,
    onOpenChange: set
  })

  const parentBox = (): Box | null => {
    return trigger ? (trigger.closest(MENU_SELECTOR) ?? trigger).getBoundingClientRect() : null
  }
  const canHover = (): boolean => {
    const parent = parentBox()
    return parent !== null && fitsBeside(parent, deps.viewport().width)
  }
  const items = (selector: string): Array<{ focus(): void }> =>
    Array.from(panel?.querySelectorAll(selector) ?? [])
  const focusPending = (): void => {
    if (!wantFocus) return
    wantFocus = false
    items(FIRST_ITEM_SELECTOR)[0]?.focus()
  }

  const open = (viaKeyboard: boolean): void => {
    hover.cancel()
    wantFocus = viaKeyboard
    if (isOpen) focusPending()
    else set(true)
  }

  const close = (refocus: boolean): void => {
    hover.cancel()
    set(false)
    if (refocus) trigger?.focus()
  }

  const layout = (): void => {
    const parent = parentBox()
    if (!trigger || !panel || !parent) return
    const rect = panel.getBoundingClientRect()
    const placement = placeSubmenu({
      trigger: trigger.getBoundingClientRect(),
      parent,
      height: rect.bottom - rect.top,
      viewport: deps.viewport()
    })
    side = placement.side
    deps.setPlacement(placement)
    focusPending()
  }

  const outsideDown = (node: unknown): void => {
    if (!isOpen) return
    const inside = [trigger, panel].some((el) => el?.contains(node))
    if (!inside) close(false)
  }
  const onScroll = (e: { target: unknown }): void => {
    if (!panel?.contains(e.target)) close(false)
  }

  return {
    setTrigger: (el) => {
      trigger = el
    },
    setPanel: (el) => {
      panel = el
    },
    hoverEnter: (pointerType) => {
      if (pointerType === 'mouse' && canHover()) hover.enter()
    },
    hoverLeave: (pointerType, at) => {
      if (pointerType !== 'mouse' || side === 'overlay') return
      const toward = panel ? isHeadingToPanel(last, at, panel.getBoundingClientRect(), side) : false
      hover.leave(toward ? TOWARD_CLOSE_DELAY : undefined)
    },
    pointerMove: (at) => {
      last = at
    },
    panelEnter: () => hover.cancel(),
    panelLeave: (pointerType) => {
      if (pointerType === 'mouse' && side !== 'overlay') hover.leave()
    },
    open,
    close,
    keyDownTrigger: (key) => {
      if (!opensSubmenu(key)) return false
      open(true)
      return true
    },
    keyDownPanel: (key) => {
      const list = items(ITEM_SELECTOR)
      const action = submenuKeyAction(key, list.indexOf(deps.activeElement() as never), list.length)
      if (action === null) return false
      if (action === 'close') close(true)
      else list[action].focus()
      return true
    },
    layout,
    outsideDown,
    attach: () => {
      const offs = [
        deps.listen('document', 'pointerdown', (e) => outsideDown(e.target)),
        deps.listen('window', 'resize', layout),
        deps.listen('window', 'scroll', onScroll, true)
      ]
      return () => offs.forEach((off) => off())
    },
    dispose: () => hover.cancel()
  }
}
