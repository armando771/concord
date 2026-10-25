import {
  siBluesky,
  siDiscord,
  siGithub,
  siInstagram,
  siKick,
  siReddit,
  siSoundcloud,
  siSpotify,
  siSteam,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
  type SimpleIcon
} from 'simple-icons'
import type { LinkProviderId } from '../../lib/profileLinks'

const ICONS: Record<Exclude<LinkProviderId, 'site'>, SimpleIcon> = {
  steam: siSteam,
  twitch: siTwitch,
  youtube: siYoutube,
  x: siX,
  instagram: siInstagram,
  tiktok: siTiktok,
  github: siGithub,
  spotify: siSpotify,
  kick: siKick,
  reddit: siReddit,
  discord: siDiscord,
  soundcloud: siSoundcloud,
  bluesky: siBluesky
}

/** Ícone do serviço do link (Steam, Twitch...), ou um globo para site comum. */
function LinkIcon({
  provider,
  className = 'h-4 w-4'
}: {
  provider: LinkProviderId
  className?: string
}): React.JSX.Element {
  if (provider === 'site') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={ICONS[provider].path} />
    </svg>
  )
}

export default LinkIcon
