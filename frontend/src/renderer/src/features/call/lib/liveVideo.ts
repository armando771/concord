// De quem é a live que um <video> está mostrando: a minha (localScreenStream)
// ou a de alguém que estou assistindo (screenStreams). Câmera e outros = null.

export interface LiveOwner {
  userId: string
  local: boolean
}

export function liveOwner(
  stream: MediaStream,
  localScreen: MediaStream | null,
  screenStreams: Record<string, MediaStream>,
  meId: string
): LiveOwner | null {
  if (stream === localScreen) return { userId: meId, local: true }
  for (const [userId, screen] of Object.entries(screenStreams)) {
    if (screen === stream) return { userId, local: false }
  }
  return null
}

/** Esc fecha o painel de estatísticas (e não sai da tela cheia/foco junto). */
export const closesStatsPanel = (key: string): boolean => key === 'Escape'
