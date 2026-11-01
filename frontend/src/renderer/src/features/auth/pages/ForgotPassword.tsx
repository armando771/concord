import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import { forgotPassword } from '../api/auth'
import { emailError } from '../lib/authForms'
import { emailActionErrorMessage } from '../lib/loginError'

function ForgotPassword(): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const invalid = emailError(email)
    setFieldError(invalid)
    if (invalid) return

    setLoading(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(emailActionErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-semibold text-gray-50">Confira seu e-mail</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Se existir uma conta com <strong className="text-gray-100">{email.trim()}</strong>,
          enviamos um link para redefinir a senha. Ele vale por 1 hora. Veja também a caixa de
          spam.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-violet-400 hover:underline"
        >
          Voltar para o login
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-gray-50">Esqueceu a senha?</h1>
      <p className="mb-6 mt-1 text-sm text-gray-400">
        Digite o e-mail da sua conta e enviaremos um link para criar uma nova senha.
      </p>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldError}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full py-2.5" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar link'}
        </Button>
      </form>
      <Link
        to="/login"
        className="mt-4 inline-block text-sm font-medium text-violet-400 hover:underline"
      >
        Voltar para o login
      </Link>
    </AuthLayout>
  )
}

export default ForgotPassword
