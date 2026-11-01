import type { VoiceState } from './callTypes'

export interface LocalControls {
  muted: boolean
  deafened: boolean
}

/**
 * O que a mídia deve fazer: o botão local e o que um moderador impôs somam (o mais restritivo vale).
 * Sem permissão do sistema o microfone fica desligado, mas a pessoa ainda ouve.
 */
export function effectiveAudio(local: LocalControls, server: VoiceState, micPermitted: boolean): { micOn: boolean; listening: boolean } {
  const listening = !local.deafened && !server.serverDeafened
  const micOn = micPermitted && listening && !local.muted && !server.serverMuted
  return { micOn, listening }
}
