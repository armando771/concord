import { captureSize, type ScreenShareQuality } from './screenShareQuality'

// Degraus da live, do escolhido até o piso de 720p30 (abaixo disso fica ruim
// de assistir). 60 fps desce a resolução antes do fps, como as "renditions"
// da Twitch (1080p60 → 720p60 → 720p30); 30 fps (texto) só desce a resolução.

const FLOOR: ScreenShareQuality = { resolution: '720p', frameRate: 30 }

function lowerSteps(chosen: ScreenShareQuality, source: MediaTrackSettings): ScreenShareQuality[] {
  const fps = chosen.frameRate
  const steps: ScreenShareQuality[] = []
  // Fonte maior que 1080p ainda tem o degrau de 1080p; numa tela 1080p, não.
  if (chosen.resolution === 'source' && captureSize('source', source).height > 1080)
    steps.push({ resolution: '1080p', frameRate: fps })
  if (chosen.resolution !== '720p') steps.push({ resolution: '720p', frameRate: fps })
  if (fps === 60) steps.push(FLOOR)
  return steps
}

/**
 * `simulcast`: com a camada extra de 720p, o envio principal não desce de
 * 1080p (troca o fps); quem tem internet fraca recebe a camada de 720p.
 */
export function qualityLadder(
  chosen: ScreenShareQuality,
  source: MediaTrackSettings,
  simulcast = false
): ScreenShareQuality[] {
  const steps = [chosen, ...lowerSteps(chosen, source)]
  if (!simulcast || chosen.resolution === '720p') return steps
  const top = steps.filter((step) => step.resolution !== '720p')
  if (chosen.frameRate === 60) top.push({ resolution: '1080p', frameRate: 30 })
  return top
}

/** "720p 60", "1440p 30" (Fonte com a altura real), "Fonte 60" sem a fonte. */
export function qualityLabel(quality: ScreenShareQuality, source?: MediaTrackSettings): string {
  const name =
    quality.resolution !== 'source'
      ? quality.resolution
      : source?.height
        ? `${captureSize('source', source).height}p`
        : 'Fonte'
  return `${name} ${quality.frameRate}`
}
