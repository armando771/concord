import { IS_WEB } from '../../../shared/lib/config'
import { usesNativePicker } from '../lib/displayMedia'
import ScreenQualityModal from './ScreenQualityModal'
import ScreenSharePickerModal from './ScreenSharePickerModal'

// Fixo durante a vida do app (a sessão Wayland/X11 não muda com ele aberto).
const nativePicker = usesNativePicker(
  IS_WEB,
  typeof window !== 'undefined' ? window.api?.screenShare?.flow : undefined
)

/**
 * Navegador e Linux/Wayland: o seletor de tela é o do sistema e o app só
 * pergunta a qualidade antes. No resto, o app mostra o seu próprio seletor.
 */
function ScreenSharePrompt(): React.JSX.Element {
  return nativePicker ? <ScreenQualityModal /> : <ScreenSharePickerModal />
}

export default ScreenSharePrompt
