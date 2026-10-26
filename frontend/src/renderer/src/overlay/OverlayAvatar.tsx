import { useState } from 'react'
import type { OverlayMember } from '../features/overlay/lib/overlayState'

/** Avatar da pílula: a foto (GIF animado inclusive) ou, sem ela / se falhar, a inicial. */
function OverlayAvatar({ member }: { member: OverlayMember }): React.JSX.Element {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  // Só quem fala anima; os outros ficam no quadro parado.
  const url = member.speaking ? (member.avatarAnimatedUrl ?? member.avatarUrl) : member.avatarUrl
  const showImage = url !== null && url !== failedUrl
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-bold text-white ${
        member.speaking ? 'ring-2 ring-success' : ''
      }`}
    >
      {showImage ? (
        <img
          src={url ?? undefined}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        member.initial
      )}
    </div>
  )
}

export default OverlayAvatar
