import type { ImageDraft } from './useProposalImages'

/** Miniaturas das imagens do formulário, com progresso, erro e botão de remover. */
function ProposalImageStrip({
  drafts,
  onRemove
}: {
  drafts: ImageDraft[]
  onRemove: (key: string) => void
}): React.JSX.Element | null {
  if (drafts.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {drafts.map((d) => (
        <li
          key={d.key}
          className="relative h-20 w-20 overflow-hidden rounded-lg border border-white/10 bg-black/30"
        >
          <img
            src={d.previewUrl}
            alt="Imagem da proposta"
            draggable={false}
            className={`h-full w-full object-cover ${d.error ? 'opacity-30' : ''}`}
          />
          {d.id == null && !d.error && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div
                className="h-full bg-violet-400 transition-all"
                style={{ width: `${Math.round(d.progress * 100)}%` }}
              />
            </div>
          )}
          {d.error && (
            <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[10px] leading-tight text-red-300">
              {d.error}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(d.key)}
            aria-label="Remover imagem"
            className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-[10px] text-white transition-colors hover:bg-red-500"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}

export default ProposalImageStrip
