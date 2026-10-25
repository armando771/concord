import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Mensagem de erro do campo: borda vermelha e texto abaixo. */
  error?: string | null
  /** Em campos de senha, mostra o botão de mostrar/ocultar. */
  reveal?: boolean
}

function Input({
  label,
  error,
  reveal,
  className = '',
  id,
  type,
  ...props
}: InputProps): React.JSX.Element {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const [shown, setShown] = useState(false)
  const canReveal = reveal && type === 'password'

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={`text-ds-sm font-medium ${error ? 'text-red-300' : 'text-gray-300'}`}
        >
          {label}
          {error && <span className="font-normal normal-case"> — {error}</span>}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={canReveal && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`glass-input ${canReveal ? 'pr-16' : ''} ${error ? 'border-red-400/60' : ''} ${className}`}
          {...props}
        />
        {canReveal && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShown((v) => !v)}
            className="absolute inset-y-0 right-3 cursor-pointer text-ds-sm font-medium text-gray-400 hover:text-gray-200"
          >
            {shown ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className="sr-only">
          {error}
        </span>
      )}
    </div>
  )
}

export default Input
