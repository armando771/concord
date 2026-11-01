import {
  siAmazonmusic,
  siApplemusic,
  siSoundcloud,
  siSpotify,
  siTidal,
  siVlcmediaplayer,
  siYoutubemusic,
  type SimpleIcon
} from 'simple-icons'

// Logo por nome do player (shared/musicApps). Player sem logo aqui cai na nota musical.
const MUSIC_ICONS: Readonly<Record<string, SimpleIcon>> = {
  Spotify: siSpotify,
  'YouTube Music': siYoutubemusic,
  'Apple Music': siApplemusic,
  'Amazon Music': siAmazonmusic,
  TIDAL: siTidal,
  SoundCloud: siSoundcloud,
  VLC: siVlcmediaplayer
}

/** Caminho SVG (viewBox 24) do logo do player, ou undefined se não houver. */
export function musicIconPath(app: string): string | undefined {
  return MUSIC_ICONS[app]?.path
}
