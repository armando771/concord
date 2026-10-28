import type { ReactNode } from 'react'

// O popover (último filho) vira folha de baixo abaixo do md: preso ao rodapé,
// na largura toda e com a safe area. As classes vêm com `!` para ganhar das
// do próprio popover (posição absoluta e largura fixa do desktop).
const SHEET =
  'contents max-md:[&>div:last-child]:fixed! max-md:[&>div:last-child]:inset-x-0! max-md:[&>div:last-child]:top-auto! max-md:[&>div:last-child]:bottom-0! max-md:[&>div:last-child]:z-50! max-md:[&>div:last-child]:h-[min(65dvh,28rem)]! max-md:[&>div:last-child]:w-full! max-md:[&>div:last-child]:max-w-none! max-md:[&>div:last-child]:rounded-b-none! max-md:[&>div:last-child]:pb-[max(0.75rem,env(safe-area-inset-bottom))]! max-md:[&>div:last-child]:animate-sheet-in'

/**
 * Embrulha um popover para, no celular, ele abrir como folha de baixo com um
 * fundo escurecido (tocar no fundo fecha pelo "clique fora" do próprio
 * popover). No desktop não muda nada.
 */
function MobileSheet({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className={SHEET}>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/50 md:hidden" />
      {children}
    </div>
  )
}

export default MobileSheet
