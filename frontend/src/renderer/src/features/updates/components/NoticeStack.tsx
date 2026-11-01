/**
 * Canto dos avisos de instalação (sandbox, atualização automática). Os dois
 * podem aparecer juntos: empilhados, não um sobre o outro, e acima da barra do
 * usuário (microfone e fone) para não cobrir os botões dela.
 */
function NoticeStack({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-20 left-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
      {children}
    </div>
  )
}

export default NoticeStack
