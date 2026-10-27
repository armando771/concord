import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import { login } from '../api/auth'
import { buildLoginInput } from '../lib/loginIdentifier'
import {
  hasFieldErrors,
  loginFieldErrors,
  noticeFromState,
  runLogin,
  type LoginDeps,
  type LoginFailure,
  type LoginOutcome
} from '../lib/loginFlow'
import { getMe } from '../../profile/api/users'
import { useAuthStore } from '../store/authStore'
import { useInviteLinkStore } from '../../servers/store/inviteLinkStore'
import { authPathWithInvite, inviteCodeFromSearch } from '../../servers/lib/inviteLink'

const INVALID_LOGIN = 'Login ou senha inválidos.'

const loginDeps = (): LoginDeps => ({
  login,
  getMe,
  setTokens: useAuthStore.getState().setTokens,
  setUser: useAuthStore.getState().setUser,
  openInvite: (code) => useInviteLinkStore.getState().open(code)
})

function LoginNotices({
  inviteCode,
  notice
}: {
  inviteCode: string | null
  notice: string | null
}): React.JSX.Element {
  return (
    <>
      {inviteCode && (
        <p className="mb-4 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
          Entre na sua conta para aceitar o convite.
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      )}
    </>
  )
}

function LoginError({ error }: { error: LoginFailure | null }): React.JSX.Element | null {
  if (!error) return null
  return (
    <p className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
      {error.message}
    </p>
  )
}

function Login(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = noticeFromState(location.state)
  // Veio de um link de convite: depois de entrar, abre a confirmação.
  const inviteCode = inviteCodeFromSearch(location.search)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [identifierErr, setIdentifierErr] = useState<string | null>(null)
  const [passwordErr, setPasswordErr] = useState<string | null>(null)
  const [error, setError] = useState<LoginFailure | null>(null)
  const [loading, setLoading] = useState(false)

  const applyOutcome = (outcome: LoginOutcome): void => {
    if (outcome.kind === 'ok') navigate('/')
    else if (outcome.kind === 'invalid') {
      setIdentifierErr(INVALID_LOGIN)
      setPasswordErr(INVALID_LOGIN)
    } else setError(outcome)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const fieldErrors = loginFieldErrors(identifier, password)
    setIdentifierErr(fieldErrors.identifier)
    setPasswordErr(fieldErrors.password)
    if (hasFieldErrors(fieldErrors)) return

    setLoading(true)
    try {
      applyOutcome(await runLogin(loginDeps(), buildLoginInput(identifier, password), inviteCode))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-gray-50">Boas-vindas de volta!</h1>
      <p className="mb-6 mt-1 text-sm text-gray-400">Que bom te ver de novo na Salinha.</p>
      <LoginNotices inviteCode={inviteCode} notice={notice} />
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="E-mail ou nome de usuário"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={identifier}
          error={identifierErr}
          onChange={(e) => setIdentifier(e.target.value)}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Senha"
            type="password"
            reveal
            autoComplete="current-password"
            value={password}
            error={passwordErr}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            to="/forgot-password"
            className="w-fit text-sm font-medium text-violet-400 hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <LoginError error={error} />
        <Button type="submit" className="w-full py-2.5" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-gray-400">
        Precisando de uma conta?{' '}
        <Link
          to={authPathWithInvite('/register', inviteCode)}
          className="font-medium text-violet-400 hover:underline"
        >
          Registre-se
        </Link>
      </p>
    </AuthLayout>
  )
}

export default Login
