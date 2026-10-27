import { app, ipcMain, type BrowserWindow } from 'electron'
import { createMusicDetector, platformWatcher } from './musicDetector'
import type { DetectedTrack } from './musicTracker'

// Liga a detecção da música ("Ouvindo") à janela principal, como a de jogos
// (games.ts): o renderer liga/desliga pela configuração e recebe cada mudança.
export function setupMusic(getWindow: () => BrowserWindow | null): void {
  const detector = createMusicDetector(platformWatcher())
  const publish = (track: DetectedTrack | null): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('music:current', track)
  }

  ipcMain.on('music:watch', (_event, enabled: unknown) => {
    if (enabled === true) detector.start(publish)
    else detector.stop()
  })
  ipcMain.handle('music:current', () => detector.current())
  // Fecha o PowerShell do SMTC junto com o app.
  app.on('will-quit', () => detector.stop())
}
