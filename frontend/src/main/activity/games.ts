import { ipcMain, type BrowserWindow } from 'electron'
import { currentGame, startGameDetector, stopGameDetector, type DetectedGame } from './gameDetector'

// Liga a detecção de jogos ("Em atividade") à janela principal. O renderer
// liga/desliga pela configuração e recebe o jogo atual a cada mudança.
export function setupGames(getWindow: () => BrowserWindow | null): void {
  const publish = (game: DetectedGame | null): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('games:current', game)
  }

  ipcMain.on('games:watch', (_event, enabled: unknown) => {
    if (enabled === true) startGameDetector(publish)
    else stopGameDetector(publish)
  })
  ipcMain.handle('games:current', () => currentGame())
}
