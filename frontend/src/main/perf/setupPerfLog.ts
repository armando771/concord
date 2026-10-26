import { app, ipcMain, type BrowserWindow } from 'electron'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { parsePerfEvent } from '../../shared/perfLog'
import { appendLog } from '../app/appLog'
import { isPerfLogEnabled } from './perfFlag'
import { PerfRecorder } from './perfRecorder'
import { PerfSession } from './perfSession'
import { windowState } from './windowState'

const SAMPLE_MS = 1000
const nowMs = (): number => process.uptime() * 1000

type GetWindow = () => BrowserWindow | null

/** O ready-to-show da janela principal (a de overlay também dispara; só a principal conta). */
function watchReadyToShow(getWindow: GetWindow, session: PerfSession): void {
  app.on('browser-window-created', (_event, win) => {
    win.once('ready-to-show', () => {
      if (win === getWindow()) session.mark('readyToShow', nowMs())
    })
  })
}

/** Relatórios do renderer: mesma checagem de origem do app-metrics:sample. */
function listenReports(getWindow: GetWindow, session: PerfSession): void {
  ipcMain.on('perf:report', (event, raw: unknown) => {
    const win = getWindow()
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return
    if (event.senderFrame !== win.webContents.mainFrame) return
    const parsed = parsePerfEvent(raw)
    if (parsed) session.receive(parsed, nowMs())
  })
}

function startRecording(getWindow: GetWindow): boolean {
  const recorder = PerfRecorder.open(join(app.getPath('userData'), 'perf'), new Date())
  if (!recorder) {
    appendLog('perf.log', 'não foi possível abrir o arquivo de medição: --perf-log desligado')
    return false
  }
  const session = new PerfSession((line) => recorder.write(line), cpus().length)
  session.mark('appReady', nowMs())
  watchReadyToShow(getWindow, session)
  listenReports(getWindow, session)
  const timer = setInterval(
    () => session.sample(app.getAppMetrics(), windowState(getWindow()), nowMs()),
    SAMPLE_MS
  )
  app.once('before-quit', () => {
    clearInterval(timer)
    recorder.close(Math.round(nowMs() / 100) / 10)
  })
  return true
}

/**
 * Medição de performance para dev (`--perf-log` ou `SALINHA_PERF_LOG=1`): grava um JSONL
 * em userData/perf. Sem a flag só responde `false` a `perf:enabled`; nada mais roda.
 * Chamar como PRIMEIRA coisa do whenReady, para o `appReady` refletir a abertura real.
 */
export function setupPerfLog(getWindow: GetWindow): void {
  const started = isPerfLogEnabled(process.argv, process.env) && startRecording(getWindow)
  ipcMain.handle('perf:enabled', () => started)
}
