import Switch from '../../../shared/ui/Switch'

/** Linha com título, descrição e o interruptor, como nas configurações do Discord. */
export function Toggle({
  title,
  description,
  checked,
  onChange
}: {
  title: string
  description: string
  checked: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-ds-md font-medium text-strong">{title}</span>
        <span className="block text-ds-sm text-gray-400">{description}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  )
}
