import type { VoiceMember } from '../../call/lib/voiceServer'

/** Quantos avatares cabem no cartão do servidor; o resto vira "+N". */
export const MAX_HOVER_AVATARS = 5

// Quem aparece com avatar no cartão e quantos ficam de fora.
export function summarizeVoicePeople(
  people: VoiceMember[],
  max: number = MAX_HOVER_AVATARS
): { visible: VoiceMember[]; extra: number } {
  const visible = people.slice(0, max)
  return { visible, extra: people.length - visible.length }
}

// Texto para leitores de tela (os avatares são só imagem).
export function voicePeopleLabel(people: VoiceMember[]): string {
  return `Em call: ${people.map((p) => p.name).join(', ')}`
}
