// Mede o worklet do voice mod no Chromium de verdade (o Electron do frontend):
// renderiza um OfflineAudioContext com ele, em JS e em WASM, e
// divide o tempo pelo número de quanta. Inclui o custo real de chamar o
// process() a partir do motor de áudio, que o bench em Node não vê.
//
//   node scripts/bench-dsp-chromium.mjs        # precisa de uma tela (X/Wayland)
//
// O tempo de um grafo vazio (fonte → destino) é descontado.
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB = path.join(ROOT, 'frontend/src/renderer/src/features/call/lib')
const require = createRequire(path.join(ROOT, 'frontend/package.json'))
const esbuild = require('esbuild')
const electron = require('electron')

const dir = mkdtempSync(path.join(tmpdir(), 'bench-dsp-'))

// Cada worklet avisa qual implementação subiu (o campo `engine` do processador).
const REPORT_ENGINE = `
const register = globalThis.registerProcessor
globalThis.registerProcessor = (name, ctor) =>
  register(name, class extends ctor {
    constructor(options) {
      super(options)
      this.port.postMessage({ engine: this.engine })
    }
  })
`

async function bundle(worklet, out) {
  writeFileSync(path.join(dir, 'report.js'), REPORT_ENGINE)
  const result = await esbuild.build({
    stdin: { contents: `import './report.js'\nimport '${path.join(LIB, worklet)}'`, resolveDir: dir, loader: 'js' },
    bundle: true,
    format: 'iife',
    write: false
  })
  writeFileSync(path.join(dir, out), result.outputFiles[0].text)
}

const PAGE = String.raw`
const fs = require('fs')
const path = require('path')
const { ipcRenderer } = require('electron')
const DIR = ${JSON.stringify(dir)}
const RATE = 48000
const SECONDS = 120
const QUANTA = (RATE * SECONDS) / 128

function speechLike() {
  const out = new Float32Array(2 * RATE)
  let seed = 12345
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    const t = i / RATE
    const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)
    let v = 0
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * 140 * h * t) / h
    out[i] = 0.15 * env * v + 0.01 * (seed / 2 ** 32 - 0.5)
  }
  return out
}

const blobUrl = (file) => URL.createObjectURL(new Blob([fs.readFileSync(path.join(DIR, file), 'utf8')], { type: 'text/javascript' }))

async function render({ file, name, options, message }) {
  const ctx = new OfflineAudioContext(1, RATE * SECONDS, RATE)
  const buffer = ctx.createBuffer(1, 2 * RATE, RATE)
  buffer.getChannelData(0).set(speechLike())
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  let engine = '-'
  if (file) {
    await ctx.audioWorklet.addModule(blobUrl(file))
    const node = new AudioWorkletNode(ctx, name, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: options })
    node.port.onmessage = (e) => { if (e.data && e.data.engine) engine = e.data.engine }
    node.port.postMessage(message)
    source.connect(node).connect(ctx.destination)
    // Dá tempo para a mensagem chegar antes de renderizar.
    await new Promise((r) => setTimeout(r, 50))
  } else {
    source.connect(ctx.destination)
  }
  source.start()
  const t0 = performance.now()
  await ctx.startRendering()
  const ms = performance.now() - t0
  await new Promise((r) => setTimeout(r, 20))
  return { ms, engine }
}

async function main() {
  const dspModule = await WebAssembly.compile(fs.readFileSync(path.join(DIR, 'concordDsp.wasm')))
  const vm = (ratio, extra = {}) => ({ ratio, modHz: 0, modDepth: 0, vibratoHz: 0, vibratoSemitones: 0, ...extra })
  const cases = [
    ['voz/normal', 'vm.js', 'concord-voice-mod', vm(1)],
    ['voz/esquilo', 'vm.js', 'concord-voice-mod', vm(2 ** (7 / 12))],
    ['voz/alien', 'vm.js', 'concord-voice-mod', vm(2 ** (5 / 12), { vibratoHz: 6, vibratoSemitones: 0.8, modHz: 90, modDepth: 0.3 })]
  ]
  const rows = []
  const base = []
  for (let r = 0; r < 3; r++) base.push((await render({})).ms)
  const empty = Math.min(...base)
  for (const [label, file, name, message] of cases) {
    for (const [variant, options] of [['js', { dspModule: null }], ['wasm', { dspModule }]]) {
      const runs = []
      let engine = '-'
      for (let r = 0; r < 3; r++) {
        const res = await render({ file, name, options, message })
        runs.push(res.ms)
        engine = res.engine
      }
      const ms = Math.min(...runs) - empty
      rows.push({ label, variant, engine, nsPerQuantum: Math.round((ms * 1e6) / QUANTA) })
    }
  }
  ipcRenderer.send('done', { empty, rows, versions: { electron: process.versions.electron, chrome: process.versions.chrome } })
}
main().catch((e) => ipcRenderer.send('done', { error: String(e && e.stack || e) }))
`

const MAIN = String.raw`
const { app, BrowserWindow, ipcMain } = require('electron')
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } })
  ipcMain.on('done', (_e, result) => { console.log('RESULT ' + JSON.stringify(result)); app.quit() })
  win.loadFile(${JSON.stringify(path.join(dir, 'page.html'))})
})
`

await bundle('voiceModWorklet.ts', 'vm.js')
copyFileSync(path.join(LIB, 'concordDsp.wasm'), path.join(dir, 'concordDsp.wasm'))
writeFileSync(path.join(dir, 'page.js'), PAGE)
writeFileSync(path.join(dir, 'page.html'), '<!doctype html><meta charset="utf-8"><script src="page.js"></script>')
writeFileSync(path.join(dir, 'main.cjs'), MAIN)

const run = spawnSync(electron, [path.join(dir, 'main.cjs')], { encoding: 'utf8', timeout: 600_000 })
const line = (run.stdout ?? '').split('\n').find((l) => l.startsWith('RESULT '))
if (!line) {
  console.error(run.stdout, run.stderr)
  process.exit(1)
}
const result = JSON.parse(line.slice('RESULT '.length))
if (result.error) {
  console.error(result.error)
  process.exit(1)
}
console.log(`Electron ${result.versions.electron} (Chromium ${result.versions.chrome}) · OfflineAudioContext 48 kHz · grafo vazio: ${result.empty.toFixed(1)} ms (descontado)\n`)
console.log('| Cenário | JS ns/quantum | WASM ns/quantum | motor (wasm) |')
console.log('|---|---|---|---|')
const byLabel = Object.groupBy(result.rows, (r) => r.label)
for (const [label, [js, wasm]] of Object.entries(byLabel)) {
  console.log(`| ${label} | ${js.nsPerQuantum} | ${wasm.nsPerQuantum} | ${wasm.engine} |`)
}
