import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import Input from '../components/Input'
import { login } from '../api/auth'
import { buildLoginInput, loginIdentifierError } from '../lib/loginIdentifier'
import { loginErrorMessage } from '../lib/loginError'
import { getMe } from '../api/users'
import { useAuthStore } from '../store/authStore'
import { useInviteLinkStore } from '../store/inviteLinkStore'
import { authPathWithInvite, inviteCodeFromSearch } from '../lib/inviteLink'

function Login(): React.JSX.Element {
  const navigate = useNavigate()
  // Veio de um link de convite: depois de entrar, abre a confirmação.
  const inviteCode = inviteCodeFromSearch(useLocation().search)
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    const identifierError = loginIdentifierError(identifier)
    if (identifierError) {
      setError(identifierError)
      return
    }
    if (!password) {
      setError('Informe sua senha.')
      return
    }

    setLoading(true)
    try {
      const tokens = await login(buildLoginInput(identifier, password))
      if (inviteCode) useInviteLinkStore.getState().open(inviteCode)
      setTokens(tokens.access_token, tokens.refresh_token)
      const me = await getMe()
      setUser(me)
      navigate('/')
    } catch (err) {
      setError(loginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <GlassCard className="w-full max-w-md p-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-50">Entrar na Salinha</h1>
        {inviteCode && (
          <p className="-mt-3 mb-5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
            Entre na sua conta para aceitar o convite.
          </p>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="E-mail ou nome de usuário"
            type="text"
            placeholder="E-mail ou nome de usuário"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" className="mt-2 w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-gray-400">
          Não tem conta?{' '}
          <Link
            to={authPathWithInvite('/register', inviteCode)}
            className="font-medium text-violet-400 hover:underline"
          >
            Crie uma
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}

export default Login
