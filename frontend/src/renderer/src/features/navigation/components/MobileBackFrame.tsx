import MobileNavButton from './MobileNavButton'

// O primeiro <header> da página abre espaço à esquerda para o "voltar" e rola
// na horizontal se os botões não couberem (só abaixo do md).
const FRAME =
  'relative h-full w-full max-md:[&_header]:overflow-x-auto max-md:[&_header]:pl-14 max-md:[&_header>*]:shrink-0'

/**
 * Para páginas sem lista própria na esquerda (Propostas, Novidades): no
 * celular põe o "voltar para canais e conversas" no canto do cabeçalho delas,
 * sem mexer na página.
 */
function MobileBackFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={FRAME}>
      {children}
      <div className="absolute left-4 top-2 z-10 md:hidden">
        <MobileNavButton className="bg-primary" />
      </div>
    </div>
  )
}

export default MobileBackFrame
