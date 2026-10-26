import { useState } from 'react'
import { overlayAvatarSrc, type OverlayMember } from '../features/overlay/lib/overlayState'

/** Avatar da pílula: a foto (GIF só em movimento para quem fala) ou, sem ela / se falhar, a inicial. */
function OverlayAvatar({ member }: { member: OverlayMember }): React.JSX.Element {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const src = overlayAvatarSrc(member, failedUrl)
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-bold text-white ${
        member.speaking ? 'ring-2 ring-success' : ''
      }`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(src)}
        />
      ) : (
        member.initial
      )}
    </div>
  )
}

export default OverlayAvatar
