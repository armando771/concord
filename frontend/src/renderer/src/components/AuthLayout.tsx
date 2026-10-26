import GlassCard from './GlassCard'
import { SalinhaMarkIcon } from './icons'

interface AuthLayoutProps {
  children: React.ReactNode
  /** Largura do formulário; o cadastro é mais alto e ganha a página rolável. */
  wide?: boolean
}

/**
 * Moldura das telas de conta, no estilo do Discord: formulário à esquerda e um
 * painel de marca à direita (some em telas estreitas).
 */
function AuthLayout({ children, wide }: AuthLayoutProps): React.JSX.Element {
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-8">
      <GlassCard className={`w-full ${wide ? 'max-w-4xl' : 'max-w-3xl'} overflow-hidden p-0`}>
        <div className="grid md:grid-cols-[1fr_17rem]">
          <div className="p-6 sm:p-10">{children}</div>
          <aside className="hidden flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand/40 via-brand/15 to-transparent p-8 text-center md:flex">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-[#8b5cf6] text-white shadow-lg shadow-brand/30">
              <SalinhaMarkIcon className="h-14 w-14" />
            </div>
            <p className="text-xl font-semibold text-gray-50">Salinha</p>
            <p className="text-sm leading-relaxed text-gray-300">
              Converse, jogue e passe o tempo com a sua turma, num lugar só.
            </p>
          </aside>
        </div>
      </GlassCard>
    </div>
  )
}

export default AuthLayout
