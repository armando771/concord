import { Children } from 'react'

/** Uma seção da mesa de áudio (Favoritos, Sons do servidor); vazia não aparece. */
export default function SoundSection({
  title,
  children
}: {
  title?: string
  children: React.ReactNode
}): React.JSX.Element | null {
  if (Children.count(children) === 0) return null
  return (
    <div>
      {title && (
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {title}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  )
}
