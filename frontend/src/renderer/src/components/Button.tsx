import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#5865f2] hover:bg-[#4752c4] text-white transition-all duration-200 shadow-md shadow-[#5865f2]/25',
  ghost:
    'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-200 transition-all duration-200',
  secondary: 'bg-white/10 hover:bg-white/15 text-white transition-all duration-200',
  danger:
    'bg-[#f23f43] hover:bg-[#d83a3e] text-white transition-all duration-200 shadow-md shadow-red-500/20',
  success:
    'bg-[#23a55a] hover:bg-[#1d8a4b] text-white transition-all duration-200 shadow-md shadow-emerald-500/25'
}

function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={`cursor-pointer rounded-lg px-4 py-2 text-ds-sm font-medium text-white transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
