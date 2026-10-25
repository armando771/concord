import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import Input from '../components/Input'
import BirthdayFields from '../components/BirthdayFields'
import { birthdayError, type BirthdayValue } from '../lib/birthday'
import { register } from '../api/auth'
import { registerErrorMessage } from '../lib/loginError'
import { PASSWORD_TOO_LONG, passwordTooLong } from '../lib/password'
import { getMe } from '../api/users'
import { useAuthStore } from '../store/authStore'
import { useInviteLinkStore } from '../store/inviteLinkStore'
import { authPathWithInvite, inviteCodeFromSearch } from '../lib/inviteLink'

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/

function Register(): React.JSX.Element {
  const navigate = useNavigate()
  // Veio de um link de convite: depois de entrar, abre a confirmação.
  const inviteCode = inviteCodeFromSearch(useLocation().search)
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [birthday, setBirthday] = useState<BirthdayValue>({ day: null, month: null, year: null })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const validate = (): string | null => {
    if (!USERNAME_REGEX.test(username.trim())) {
      return 'Usuário deve ter 3–32 caracteres (letras, números ou _).'
    }
    if (!displayName.trim()) {
      return 'Informe seu nome de exibição.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Email inválido.'
    }
    if (password.length < 8) {
      return 'Senha deve ter pelo menos 8 caracteres.'
    }
    if (passwordTooLong(password)) {
      return PASSWORD_TOO_LONG
    }
    if (password !== confirm) {
      return 'As senhas não conferem.'
    }
    return birthdayError(birthday)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const tokens = await register({
        username: username.trim(),
        display_name: displayName.trim(),
        email: email.trim(),
        password,
        ...(birthday.day && birthday.month && birthday.year
          ? {
              birthday_day: birthday.day,
              birthday_month: birthday.month,
              birthday_year: birthday.year
            }
          : {})
      })
      if (inviteCode) useInviteLinkStore.getState().open(inviteCode)
      setTokens(tokens.access_token, tokens.refresh_token)
      const me = await getMe()
      setUser(me)
      navigate('/')
    } catch (err) {
      setError(registerErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <GlassCard className="w-full max-w-md p-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-50">Criar conta</h1>
        {inviteCode && (
          <p className="-mt-3 mb-5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
            Crie sua conta para aceitar o convite.
          </p>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Nome de usuário"
            placeholder="ex: hugo"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <Input
            label="Nome de exibição"
            placeholder="ex: Hugo"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirmar senha"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <BirthdayFields value={birthday} onChange={setBirthday} />
          {error && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" className="mt-2 w-full" disabled={loading}>
            {loading ? 'Criando conta...' : 'Registrar'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-gray-400">
          Já tem conta?{' '}
          <Link
            to={authPathWithInvite('/login', inviteCode)}
            className="font-medium text-violet-400 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}

export default Register
