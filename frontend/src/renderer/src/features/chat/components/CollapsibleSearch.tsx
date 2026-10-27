import { useEffect, useRef, useState } from 'react'
import { SearchIcon, XIcon } from '../../../shared/ui/icons'
import { useIsMobile } from '../../navigation/hooks/useIsMobile'

const ICON_BUTTON =
  'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-violet-400'

/**
 * No celular a barra de busca do cabeçalho vira uma lupa: tocar abre a busca
 * por cima do cabeçalho, na largura toda (o ✕ ou Esc fecham). No desktop
 * mostra a barra como sempre.
 */
function CollapsibleSearch({ children }: { children: React.ReactNode }): React.JSX.Element {
  const mobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) boxRef.current?.querySelector('input')?.focus()
  }, [open])

  if (!mobile) return <>{children}</>
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Buscar mensagens" className={ICON_BUTTON}>
        <SearchIcon className="size-5" />
      </button>
    )
  }
  return (
    <div
      ref={boxRef}
      className="absolute inset-0 z-30 flex items-center gap-1 bg-primary pl-3 pr-1"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      {/* A caixa da busca tem largura fixa no desktop: aqui estica. */}
      <div className="min-w-0 flex-1 [&_div:has(>input[role=combobox])]:w-full">{children}</div>
      <button type="button" onClick={() => setOpen(false)} aria-label="Fechar busca" className={ICON_BUTTON}>
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

export default CollapsibleSearch
