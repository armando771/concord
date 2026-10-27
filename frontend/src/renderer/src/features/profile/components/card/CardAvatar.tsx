import Avatar from '../../../../shared/ui/Avatar'
import { PencilIcon } from '../../../../shared/ui/icons'
import type { PresenceStatus } from '../../../friends/lib/presenceStatus'

/**
 * Avatar do cartão, com o anel na cor do fundo. No próprio perfil, o "Editar
 * perfil" por cima; na prévia do editor, o lápis que troca a imagem.
 */
export default function CardAvatar({
  userId,
  name,
  avatarUrl,
  status,
  surface,
  fallbackClassName,
  onEditProfile,
  onEdit
}: {
  /** Sem id (prévia): não usa o profileStore e mostra o rascunho. */
  userId?: string
  name: string
  avatarUrl?: string | null
  status?: PresenceStatus | null
  surface: string
  fallbackClassName?: string
  onEditProfile?: () => void
  onEdit?: () => void
}): React.JSX.Element {
  return (
    <div
      className="pt-ink-keep pointer-events-auto relative shrink-0 rounded-full p-1.5"
      style={{ background: surface }}
    >
      <Avatar
        userId={userId}
        name={name}
        avatarUrl={avatarUrl}
        size={80}
        animate="always"
        status={status}
        cutoutColor={surface}
        fallbackClassName={fallbackClassName}
      />
      {onEditProfile && (
        <button
          type="button"
          onClick={onEditProfile}
          aria-label="Editar perfil"
          className="absolute inset-1.5 flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full bg-black/60 text-[10px] font-bold uppercase text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 on-media"
        >
          <PencilIcon className="h-4 w-4" />
          Editar perfil
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Alterar avatar"
          title="Alterar avatar"
          className="absolute inset-1.5 flex cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <PencilIcon className="h-5 w-5 drop-shadow" />
        </button>
      )}
    </div>
  )
}
