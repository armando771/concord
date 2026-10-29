import type { TTSVoiceState } from '../../../../../shared/ttsVoice'

export interface VoiceStatusView {
  text: string
  /** Mostra como aviso (a mensagem /tts fica só no chat). */
  warning: boolean
  /** Mostra o botão "Tentar de novo". */
  retry: boolean
}

const NOT_SPOKEN = 'as mensagens /tts aparecem só no chat.'

/** O que Configurações → Voz mostra sobre a voz baixada (Linux). */
export function voiceStatusView(state: TTSVoiceState): VoiceStatusView {
  switch (state.status) {
    case 'idle':
      return {
        text: 'A voz de leitura (cerca de 90 MB) é baixada na primeira mensagem /tts.',
        warning: false,
        retry: false
      }
    case 'downloading':
      return { text: `Baixando a voz de leitura… ${state.percent}%`, warning: false, retry: false }
    case 'ready':
      return { text: 'Voz de leitura pronta.', warning: false, retry: false }
    case 'error':
      return {
        text: `Não deu para baixar a voz de leitura: ${NOT_SPOKEN}`,
        warning: true,
        retry: true
      }
    case 'unsupported':
      return {
        text: `Este processador não tem voz de leitura: ${NOT_SPOKEN}`,
        warning: true,
        retry: false
      }
  }
}
