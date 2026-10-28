import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../store/callStore'
import { liveOwner } from '../lib/liveVideo'
import ScreenStatsCorner from './ScreenStatsPanel'

/** O que todo <video> de live ganha: o ícone de estatísticas no canto. Câmera não. */
export default function LiveVideoExtras({
  stream
}: {
  stream: MediaStream
}): React.JSX.Element | null {
  const meId = useAuthStore((s) => s.user?.id ?? 'me')
  const localScreen = useCallStore((s) => s.localScreenStream)
  const screenStreams = useCallStore((s) => s.screenStreams)
  const owner = liveOwner(stream, localScreen, screenStreams, meId)
  return owner ? <ScreenStatsCorner owner={owner} /> : null
}
