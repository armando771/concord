import type { InvitePreview } from '../../api/invites'
import { serverIconSrc } from '../../lib/serverIcon'
import { formatInviteCount } from '../../lib/invitePreview'

/** Ícone do servidor (ou a inicial), como na barra de servidores. */
export function InviteServerIcon({
  name,
  iconUrl,
  size = 64
}: {
  name: string
  iconUrl?: string | null
  size?: number
}): React.JSX.Element {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 font-bold text-white shadow-lg shadow-black/30"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {iconUrl ? (
        <img src={serverIconSrc(iconUrl)} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  )
}

/** Ícone, "Você foi convidado(a) para entrar", nome e contagens. */
export function InviteServerInfo({ preview }: { preview: InvitePreview }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center text-center">
      <InviteServerIcon name={preview.name} iconUrl={preview.icon_url} />
      <p className="mt-4 text-ds-sm text-gray-300">Você foi convidado(a) para entrar</p>
      <h1 className="mt-1 break-words text-ds-xl font-bold text-white">{preview.name}</h1>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-ds-sm text-gray-300">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-discord-green" aria-hidden />
          {formatInviteCount(preview.online_count, 'online', 'online')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-300" aria-hidden />
          {formatInviteCount(preview.member_count, 'membro', 'membros')}
        </span>
      </div>
    </div>
  )
}

/** Imagem do servidor desfocada atrás (ou um degradê, sem ícone). */
export function InviteBackdrop({
  iconUrl,
  className = ''
}: {
  iconUrl?: string | null
  className?: string
}): React.JSX.Element {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden>
      {iconUrl ? (
        <>
          <img
            src={serverIconSrc(iconUrl)}
            alt=""
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
          />
          <div className="absolute inset-0 bg-black/45" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-linear-to-br from-[#4c1d95] via-[#312e81] to-[#0e7490]" />
          <div className="absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full bg-fuchsia-500/30 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 h-3/4 w-3/4 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-black/20" />
        </>
      )}
    </div>
  )
}
