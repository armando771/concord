import { useState } from 'react'
import ProfilePreview from './ProfilePreview'

/**
 * A prévia do cartão: coluna fixa (sticky) à direita no desktop; no celular
 * fica em cima do formulário e dá para recolher, para sobrar espaço.
 */
export default function ProfilePreviewPanel(
  props: React.ComponentProps<typeof ProfilePreview>
): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <aside
      aria-label="Prévia do cartão"
      className="w-full min-w-0 lg:sticky lg:top-4 lg:order-2 lg:self-start"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Prévia do cartão
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="profile-preview-card"
          onClick={() => setOpen((o) => !o)}
          className="min-h-10 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-link hover:underline lg:hidden"
        >
          {open ? 'Recolher' : 'Mostrar'}
        </button>
      </div>
      <div
        id="profile-preview-card"
        className={`mx-auto w-full max-w-[300px] ${open ? '' : 'hidden lg:block'}`}
      >
        <ProfilePreview {...props} />
        <p className="mt-2 text-xs text-gray-400">
          É assim que os outros veem. Toque no avatar ou no banner para trocar a imagem.
        </p>
      </div>
    </aside>
  )
}
