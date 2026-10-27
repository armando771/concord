// Como o banco de medição põe a janela em foco, sem foco e minimizada.
//
// Hyprland: a janela vai para um monitor virtual (headless) criado só para a
// medição — ela é desenhada pela GPU de verdade, mas fora da tela de quem usa o PC.
// "Sem foco" devolve o foco à janela que estava ativa antes; "minimizada" chama o
// minimize do Electron e tira a janela da tela (workspace especial), já que o
// Hyprland não minimiza. O cenário "com foco" rouba o teclado durante a medição.
//
// Outros sistemas (Windows, X11, macOS): só as APIs do Electron (focus, blur,
// minimize), que lá mexem na janela de verdade.
import { execFileSync } from 'node:child_process'

const OUTPUT = 'SALINHA-PERF'
const HIDDEN_WS = 'special:salinhaperf'

const winCall = (app, method) =>
  app.evaluate(({ BrowserWindow }, m) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/index.html'))
    if (m === 'show') {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    } else win[m]()
  }, method)

export function nativeWindow(app) {
  return {
    name: 'electron',
    setup: async () => {},
    place: async () => {},
    focus: () => winCall(app, 'show'),
    blur: () => winCall(app, 'blur'),
    minimize: () => winCall(app, 'minimize'),
    teardown: async () => {}
  }
}

const hyprctl = (...args) => execFileSync('hyprctl', args, { encoding: 'utf8' }).trim()
const hyprJson = (...args) => JSON.parse(hyprctl(...args, '-j'))
const dispatch = (lua) => {
  const out = hyprctl('dispatch', lua)
  if (out !== 'ok') throw new Error(`hyprctl dispatch ${lua}: ${out}`)
}

export function hyprlandWindow(app) {
  const pid = app.process().pid
  let workspace = null
  let previous = null
  const restoreFocus = () => {
    if (previous) dispatch(`hl.dsp.focus({ window = "address:${previous}" })`)
  }
  const moveTo = (ws) => dispatch(`hl.dsp.window.move({ workspace = "${ws}", window = "pid:${pid}", follow = false })`)
  return {
    name: 'hyprland (monitor virtual)',
    async setup() {
      previous = hyprJson('activewindow').address ?? null
      if (!hyprJson('monitors', 'all').some((m) => m.name === OUTPUT)) hyprctl('output', 'create', 'headless', OUTPUT)
      // Sem regra própria o monitor novo pode cair num "espelhar" genérico da config.
      hyprctl('eval', `hl.monitor({ output = "${OUTPUT}", mode = "1920x1080@60", position = "8000x0", scale = 1 })`)
      await new Promise((r) => setTimeout(r, 1000))
      const monitor = hyprJson('monitors').find((m) => m.name === OUTPUT)
      if (!monitor) throw new Error(`monitor virtual ${OUTPUT} não ativou`)
      workspace = monitor.activeWorkspace.name
    },
    async place() {
      moveTo(workspace)
      restoreFocus()
    },
    async focus() {
      await winCall(app, 'show')
      moveTo(workspace)
      dispatch(`hl.dsp.focus({ window = "pid:${pid}" })`)
    },
    async blur() {
      await winCall(app, 'show')
      moveTo(workspace)
      restoreFocus()
    },
    async minimize() {
      moveTo(HIDDEN_WS)
      restoreFocus()
      await winCall(app, 'minimize')
    },
    async teardown() {
      restoreFocus()
      try {
        hyprctl('output', 'remove', OUTPUT)
      } catch {
        // já removido
      }
    }
  }
}

export const windowControl = (app, env = process.env) =>
  env.HYPRLAND_INSTANCE_SIGNATURE ? hyprlandWindow(app) : nativeWindow(app)
