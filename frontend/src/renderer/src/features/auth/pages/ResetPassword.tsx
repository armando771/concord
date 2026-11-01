import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import { resetPassword } from '../api/auth'
import { validateReset, type FieldErrors, type ResetField } from '../lib/authForms'
import { emailActionErrorMessage } from '../lib/loginError'

function ResetPassword(): React.JSX.Element {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors<ResetField>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    const found = validateReset(password, confirm)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    try {
      await resetPassword(token, password)
      navigate('/login', {
        replace: true,
        state: { notice: 'Senha atualizada! Entre com a nova senha.' }
      })
    } catch (err) {
      setError(emailActionErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-semibold text-gray-50">Link inválido</h1>
        <p className="mt-3 text-sm text-gray-300">Peça um novo link para redefinir a senha.</p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-violet-400 hover:underline"
        >
          Pedir novo link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-gray-50">Criar nova senha</h1>
      <p className="mb-6 mt-1 text-sm text-gray-400">
        Você será desconectado dos outros dispositivos ao trocar a senha.
      </p>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Nova senha"
          type="password"
          reveal
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          reveal
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
            {error}{' '}
            <Link to="/forgot-password" className="font-medium underline">
              Pedir novo link
            </Link>
          </p>
        )}
        <Button type="submit" className="w-full py-2.5" disabled={loading}>
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default ResetPassword
