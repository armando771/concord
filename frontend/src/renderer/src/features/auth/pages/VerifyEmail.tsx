import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { verifyEmail } from '../api/auth'
import { emailActionErrorMessage } from '../lib/loginError'
import { getMe } from '../../profile/api/users'
import { useAuthStore } from '../store/authStore'
import { AuthResultSkeleton } from '../../../shared/ui/skeleton/layouts'

type State = { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string }

function VerifyEmail(): React.JSX.Element {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const accessToken = useAuthStore((s) => s.accessToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [state, setState] = useState<State>(
    token
      ? { kind: 'loading' }
      : { kind: 'error', message: 'Este link é inválido ou expirou. Peça um novo.' }
  )
  // O link vale uma vez só: o StrictMode do React roda o efeito duas vezes em dev.
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(async () => {
        setState({ kind: 'ok' })
        // Quem já está logado neste navegador deixa de ver o aviso na hora.
        if (useAuthStore.getState().accessToken) {
          try {
            setUser(await getMe())
          } catch {
            // o próximo carregamento do app atualiza
          }
        }
      })
      .catch((err) => setState({ kind: 'error', message: emailActionErrorMessage(err) }))
  }, [token, setUser])

  const home = accessToken ? '/' : '/login'

  return (
    <AuthLayout>
      {state.kind === 'loading' && <AuthResultSkeleton label="Confirmando seu e-mail…" />}
      {state.kind === 'ok' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-50">E-mail confirmado!</h1>
          <p className="mt-3 text-sm text-gray-300">
            Tudo certo com a sua conta. Já pode voltar ao app.
          </p>
          <Link
            to={home}
            className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            {accessToken ? 'Ir para o app' : 'Entrar'}
          </Link>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-50">Não deu para confirmar</h1>
          <p className="mt-3 text-sm text-gray-300">{state.message}</p>
          <Link
            to={home}
            className="mt-6 inline-block text-sm font-medium text-violet-400 hover:underline"
          >
            {accessToken ? 'Voltar ao app e reenviar o e-mail' : 'Ir para o login'}
          </Link>
        </>
      )}
    </AuthLayout>
  )
}

export default VerifyEmail
