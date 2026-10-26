import type { DraftAttachment } from '../lib/attachments'
import { formatBytes } from '../lib/attachments'
import { MicIcon, PlayIcon } from '../../../shared/ui/icons'

/** Fileira de anexos acima do campo de texto, com progresso e erro. */
function ComposerAttachments({
  drafts,
  onRemove
}: {
  drafts: DraftAttachment[]
  onRemove: (localId: string) => void
}): React.JSX.Element | null {
  if (drafts.length === 0) return null

  return (
    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
      {drafts.map((d) => (
        <div
          key={d.localId}
          className={`relative flex w-40 shrink-0 flex-col gap-1 rounded-lg border bg-input p-2 ${
            d.status === 'error' ? 'border-red-500/50' : 'border-subtle'
          }`}
        >
          <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-md bg-fg/5 text-gray-400">
            {d.kind === 'image' && d.previewUrl ? (
              <img src={d.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : d.kind === 'video' && d.previewUrl ? (
              <>
                <video
                  src={d.previewUrl}
                  muted
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
                <PlayIcon className="absolute h-6 w-6 text-white/80" />
              </>
            ) : (
              <MicIcon className="h-8 w-8" />
            )}
          </div>
          <p className="truncate text-xs text-gray-200" title={d.file.name}>
            {d.file.name}
          </p>
          <p className="text-[10px] text-gray-500">{formatBytes(d.file.size)}</p>
          {d.status === 'uploading' && (
            <div className="h-1 overflow-hidden rounded-full bg-fg/10">
              <div
                className="h-full rounded-full bg-violet-400 transition-[width]"
                style={{ width: `${Math.round(d.progress * 100)}%` }}
              />
            </div>
          )}
          {d.status === 'error' && <p className="text-[10px] text-red-400">{d.error}</p>}
          <button
            type="button"
            onClick={() => onRemove(d.localId)}
            title="Remover"
            aria-label="Remover anexo"
            className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-xs text-gray-300 hover:bg-red-500 hover:text-white on-media"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default ComposerAttachments
