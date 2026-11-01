import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand hover:bg-brand-hover text-white transition-all duration-200 shadow-md shadow-brand/25',
  ghost:
    'bg-fg/5 hover:bg-fg/10 border border-subtle hover:border-normal text-gray-200 transition-all duration-200',
  secondary: 'bg-fg/10 hover:bg-fg/15 text-strong transition-all duration-200',
  danger:
    'bg-danger-strong hover:bg-danger-strong-hover text-white transition-all duration-200 shadow-md shadow-red-500/20',
  success:
    'bg-success-strong hover:bg-success-strong-hover text-white transition-all duration-200 shadow-md shadow-emerald-500/25'
}

function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={`cursor-pointer rounded-lg px-4 py-2 text-ds-sm font-medium text-strong transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
