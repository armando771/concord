import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { createInterface } from 'readline'
import { parseForegroundLine, type Foreground } from '../overlay/overlayPolicy'
import { helperPath, logAudio } from '../screen/screenAudio'

// Overlay de jogo: `concord-audio.exe foreground` diz qual janela em tela
// cheia está na frente (uma linha só quando muda).

let watcher: ChildProcess | null = null
// Helper ausente ou que saiu: não sobe de novo até o próximo stop (sair da
// call/desligar o overlay) — um exe velho sairia na hora, em laço.
let gaveUp = false

/** Sobe o helper (uma vez só); `onChange(null)` se ele sair. */
export function startForegroundWatch(onChange: (foreground: Foreground) => void): void {
  if (watcher || gaveUp) return
  const path = helperPath()
  if (!existsSync(path)) {
    logAudio(`overlay: helper não encontrado em ${path}`)
    gaveUp = true
    return
  }
  logAudio('overlay: olhando a janela em primeiro plano')
  // stdin aberto: quando a Salinha morre, o pipe fecha e o helper sai junto.
  const child = spawn(path, ['foreground'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  watcher = child
  const gone = (): void => {
    if (watcher !== child) return
    watcher = null
    gaveUp = true
    onChange(null)
  }
  child.on('error', (err) => {
    logAudio(`overlay: falha ao iniciar o helper: ${err.message}`)
    gone()
  })
  child.on('exit', (code) => {
    logAudio(`overlay: helper saiu (código ${code})`)
    gone()
  })
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (text: string) => logAudio(`overlay: helper: ${text.trim()}`))
  if (child.stdout) {
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (watcher !== child) return
      const foreground = parseForegroundLine(line)
      if (foreground === undefined) {
        logAudio(`overlay: linha inesperada do helper: ${line}`)
        return
      }
      onChange(foreground)
    })
  }
}

export function stopForegroundWatch(): void {
  gaveUp = false
  const child = watcher
  watcher = null
  child?.kill()
}
