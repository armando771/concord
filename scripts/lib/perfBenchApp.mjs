// O app do banco de medição, sem Playwright grudado na página.
//
// O Playwright, ao se anexar a uma página, emula foco e visibilidade: a página
// passa a dizer "visible" mesmo minimizada, e o throttling do Chromium em segundo
// plano nunca aparece na medição. Aqui o electron sobe direto, com o inspetor do
// Node só no processo main (--inspect); tudo — métricas, janela e cliques na
// página — passa por ele (webContents.executeJavaScript). Nada se anexa ao renderer.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function inspectorTarget(port, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`electron saiu (código ${child.exitCode})`)
    try {
      const [target] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl
    } catch {
      // ainda subindo
    }
    await sleep(200)
  }
  throw new Error('inspetor do main não respondeu')
}

function cdp(url) {
  const ws = new WebSocket(url)
  const pending = new Map()
  let next = 0
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    const wait = pending.get(msg.id)
    if (!wait) return
    pending.delete(msg.id)
    if (msg.error) wait.reject(new Error(msg.error.message))
    else wait.resolve(msg.result)
  }
  const opened = new Promise((ok, fail) => {
    ws.onopen = ok
    ws.onerror = fail
  })
  return {
    opened,
    send: (method, params) =>
      new Promise((resolve, reject) => {
        const id = ++next
        pending.set(id, { resolve, reject })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    close: () => ws.close()
  }
}

// Roda dentro da página: utilitários para achar e clicar elementos pelo texto.
const PAGE_HELPERS = `(() => {
  const visible = (el) => !!el && el.getClientRects().length > 0
  const byText = (text) => [...document.querySelectorAll('button, a, span, div, p, h1, h2, h3, li')]
    .filter((el) => el.textContent.trim() === text && visible(el))
    .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0]
  const byLabel = (re) => [...document.querySelectorAll('button, [role=button]')]
    .find((el) => visible(el) && new RegExp(re).test(el.getAttribute('aria-label') ?? el.textContent.trim()))
  const fill = (selector, value) => {
    const el = document.querySelector(selector)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { visible, byText, byLabel, fill }
})()`

/** Sobe o electron e devolve o controle (mesma forma usada por perfBenchWindow: evaluate + process). */
export async function launchApp({ front, args, env, inspectPort = 9339 }) {
  const electron = createRequire(join(front, 'package.json'))('electron')
  const child = spawn(electron, [`--inspect=${inspectPort}`, join(front, 'out', 'main', 'index.js'), ...args], {
    cwd: front,
    env,
    stdio: 'ignore'
  })
  const session = cdp(await inspectorTarget(inspectPort, child))
  await session.opened

  const evaluate = async (fn, arg) => {
    const expression = `(${fn})(process.mainModule.require('electron'), ${JSON.stringify(arg ?? null)})`
    const res = await session.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    return res.result.value
  }

  // Código na página principal (a do index.html), com os utilitários em `h`.
  const inPage = (body) =>
    evaluate(
      async ({ BrowserWindow }, { helpers, code }) => {
        const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/index.html'))
        if (!win) return null
        return win.webContents.executeJavaScript(`(async () => { const h = ${helpers}; ${code} })()`, true)
      },
      { helpers: PAGE_HELPERS, code: body }
    )

  const waitFor = async (desc, body, timeoutMs = 30000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (await inPage(body).catch(() => false)) return
      await sleep(250)
    }
    throw new Error(`esperando ${desc}`)
  }

  const screenshot = async (path) => {
    const b64 = await evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('/index.html'))
      return (await win.webContents.capturePage()).toPNG().toString('base64')
    })
    writeFileSync(path, Buffer.from(b64, 'base64'))
  }

  return {
    evaluate,
    inPage,
    waitFor,
    screenshot,
    process: () => child,
    async close() {
      await evaluate(({ app }) => setTimeout(() => app.exit(0), 50)).catch(() => {})
      session.close()
      await sleep(500)
      if (child.exitCode === null) child.kill()
    }
  }
}
