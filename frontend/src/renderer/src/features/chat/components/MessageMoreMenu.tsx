import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  menuKeyAction,
  menuPosition,
  type MessageMenuAction,
  type MessageMenuItem
} from '../lib/messageMenu'

const MENU_WIDTH = 220
const ITEM_SELECTOR = '[role="menuitem"]'

const menuItems = (menu: HTMLElement | null): HTMLElement[] => [
  ...(menu?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])
]

/**
 * Menu "Mais" da barra de ações da mensagem, num portal com posição fixa
 * (o scroll do chat não corta) e sem sair da janela. Teclado: abre com o
 * foco no primeiro item; setas, Home e End andam; Esc ou Tab fecham e
 * devolvem o foco ao "…". Clique fora também fecha.
 */
function MessageMoreMenu({
  anchor,
  groups,
  onAction,
  onClose
}: {
  /** O botão "…" que abriu o menu. */
  anchor: HTMLElement
  groups: MessageMenuItem[][]
  onAction: (action: MessageMenuAction) => void
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  // Mede antes de pintar (a posição final já sai no primeiro quadro) e foca o
  // primeiro item para o teclado.
  useLayoutEffect(() => {
    setHeight(ref.current?.offsetHeight ?? 0)
    menuItems(ref.current)[0]?.focus()
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [anchor, onClose])

  const closeToAnchor = (): void => {
    onClose()
    anchor.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const items = menuItems(ref.current)
    const action = menuKeyAction(
      e.key,
      items.indexOf(document.activeElement as HTMLElement),
      items.length
    )
    if (action === null) return
    e.preventDefault()
    if (action === 'close') {
      e.stopPropagation()
      closeToAnchor()
      return
    }
    items[action].focus()
  }

  const position = menuPosition(
    anchor.getBoundingClientRect(),
    { width: MENU_WIDTH, height },
    { width: window.innerWidth, height: window.innerHeight }
  )

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Mais ações"
      onKeyDown={onKeyDown}
      style={{ ...position, width: MENU_WIDTH }}
      className="fixed z-50 max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-subtle bg-floating p-1.5 shadow-2xl"
    >
      {groups.map((group, i) => (
        <Fragment key={group[0].action}>
          {i > 0 && <div role="separator" className="mx-1 my-1 h-px bg-fg/10" />}
          {group.map((item) => (
            <MenuItem
              key={item.action}
              item={item}
              onClick={() => {
                onClose()
                onAction(item.action)
              }}
            />
          ))}
        </Fragment>
      ))}
    </div>,
    document.body
  )
}

function MenuItem({
  item,
  onClick
}: {
  item: MessageMenuItem
  onClick: () => void
}): React.JSX.Element {
  const tone = item.danger
    ? 'text-danger hover:bg-danger-strong hover:text-white focus-visible:bg-danger-strong focus-visible:text-white'
    : 'text-gray-300 hover:bg-brand hover:text-white focus-visible:bg-brand focus-visible:text-white'
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className={`flex min-h-8 w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-ds-sm font-medium outline-none transition-colors ${tone}`}
    >
      {item.label}
    </button>
  )
}

export default MessageMoreMenu
