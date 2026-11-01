import Avatar from '../../../../../shared/ui/Avatar'
import StyledName from '../../../../profile/components/StyledName'
import type { NameStyle } from '../../../../profile/lib/nameStyle'

/** Uma mensagem de exemplo no chat, com o nome do jeito que vai aparecer. */
export default function MessagePreview({
  name,
  style,
  avatarUrl
}: {
  name: string
  style: NameStyle
  avatarUrl: string | null
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-subtle bg-primary p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        No chat
      </p>
      <div className="flex min-w-0 gap-3">
        <Avatar name={name} avatarUrl={avatarUrl} size={40} animate="always" />
        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate text-ds-md font-medium text-strong">
              <StyledName name={name} style={style} />
            </span>
            <span className="shrink-0 text-xs text-gray-500">Hoje às 12:34</span>
          </p>
          <p className="break-words text-ds-md text-normal">Olha só o meu nome novo!</p>
        </div>
      </div>
    </div>
  )
}
