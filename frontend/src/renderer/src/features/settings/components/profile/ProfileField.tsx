export const inputClass =
  'w-full rounded-md border border-subtle bg-input px-3 py-2 text-sm text-strong placeholder:text-gray-500 focus:border-brand focus:outline-none'

function Counter({ used, max }: { used: number; max: number }): React.JSX.Element {
  return (
    <span className={`text-[11px] ${used > max ? 'text-danger' : 'text-gray-500'}`}>
      {max - used}
    </span>
  )
}

/** Um campo do editor de perfil: rótulo, contador, dica e erro. */
export function Field({
  label,
  hint,
  error,
  counter,
  children
}: {
  label: string
  hint?: string
  error?: string | null
  counter?: { used: number; max: number }
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="border-b border-subtle pb-6">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-ds-sm font-medium text-gray-300">{label}</p>
        {counter && <Counter {...counter} />}
      </div>
      {hint && <p className="-mt-1 mb-2 text-xs text-gray-400">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
): React.JSX.Element {
  return (
    <button
      type="button"
      {...props}
      className="cursor-pointer rounded-md bg-fg/10 px-4 py-2 text-ds-sm font-medium text-strong transition-colors hover:bg-fg/15 disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}
