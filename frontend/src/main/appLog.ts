import { app } from 'electron'
import { appendFile, mkdirSync } from 'fs'
import { join } from 'path'

// Logs de diagnóstico em %APPDATA%\\Concord\\logs\\<nome>.log no Windows.

export function logPath(name: string): string {
  return join(app.getPath('logs'), name)
}

/** Acrescenta uma linha com horário; sem onde gravar, segue sem registrar. */
export function appendLog(name: string, message: string): void {
  try {
    mkdirSync(app.getPath('logs'), { recursive: true })
  } catch {
    // sem pasta de log: segue sem registrar
  }
  appendFile(logPath(name), `${new Date().toISOString()} ${message}\n`, () => {})
}
