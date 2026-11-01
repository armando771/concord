import Button from '../../../shared/ui/Button'
import { copyText } from '../../../shared/lib/clipboard'
import { GUEST_COPY } from '../lib/guestCopy'

/** O link gerado, para copiar (o token não aparece de novo depois). */
function GuestLinkReady({ link, onNew }: { link: string; onNew: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ds-sm text-gray-300">{GUEST_COPY.linkReady}</p>
      <input
        readOnly
        value={link}
        aria-label="Link de visitante"
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-10 w-full min-w-0 rounded-lg border border-subtle bg-tertiary px-3 font-mono text-ds-sm text-strong"
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" className="min-h-10" onClick={onNew}>
          {GUEST_COPY.newLink}
        </Button>
        <Button className="min-h-10" onClick={() => copyText(link)}>
          {GUEST_COPY.copy}
        </Button>
      </div>
    </div>
  )
}

export default GuestLinkReady
