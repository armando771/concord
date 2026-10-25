import { API_BASE_URL } from '../../lib/config'
import { profileMediaSrc } from '../../lib/profileMedia'

// Cores do ícone padrão do grupo (como o Discord, varia pelo id).
const COLORS = ['#5865f2', '#3ba55c', '#faa61a', '#ed4245', '#eb459e', '#00a8fc']

function colorFor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

/** Ícone da DM em grupo: a imagem escolhida ou um círculo colorido. */
function GroupIcon({
  id,
  iconUrl,
  size = 32
}: {
  id: string
  iconUrl?: string | null
  size?: number
}): React.JSX.Element {
  if (iconUrl) {
    return (
      <img
        src={profileMediaSrc(iconUrl, API_BASE_URL) ?? undefined}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      style={{ width: size, height: size, background: colorFor(id) }}
      className="flex shrink-0 items-center justify-center rounded-full text-white"
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: size * 0.55, height: size * 0.55 }}
        fill="currentColor"
      >
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19c0-3.3 3.1-5 7-5s7 1.7 7 5v1H2v-1Zm15.5 1v-1c0-1.6-.6-3-1.8-4 2.8.2 6.3 1.3 6.3 4v1h-4.5Z" />
      </svg>
    </span>
  )
}

export default GroupIcon
