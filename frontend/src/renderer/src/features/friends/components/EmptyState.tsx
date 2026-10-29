export default function EmptyState({
  icon,
  text
}: {
  icon: React.ReactNode
  text: string
}): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-fg/5 text-gray-500">
        {icon}
      </div>
      <p className="max-w-xs text-ds-md text-gray-400">{text}</p>
    </div>
  )
}
