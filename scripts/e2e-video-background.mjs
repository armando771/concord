// E2E do fundo da câmera (desfoque e imagem) com o MediaPipe de verdade, sem
// backend: uma foto de pessoas vira a "câmera" e o pipeline do app processa.
//   node scripts/e2e-video-background.mjs              # Chromium (build web-like, http)
//   node scripts/e2e-video-background.mjs --electron   # também no Electron, em file://
//                                                      # (como o app empacotado, com a CSP real)
// Precisa de rede só para baixar a foto de teste (Apache-2.0, exemplo do MediaPipe).
// Confere: sem efeito passa direto; desfoque deixa a pessoa nítida e borra o
// fundo; imagem troca o fundo e mantém a pessoa; FPS de saída.
import { createRequire } from 'module'
import { createServer } from 'http'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { extname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium, _electron } = require('playwright')
// O Vite 7 é só ESM: importa a entrada pelo caminho do pacote.
const vite = await import(pathToFileURL(join(require.resolve('vite/package.json'), '../dist/node/index.js')).href)

const here = fileURLToPath(new URL('.', import.meta.url))
const out = mkdtempSync(join(tmpdir(), 'salinha-e2e-video-'))
const PHOTO_URL = 'https://storage.googleapis.com/mediapipe-assets/segmentation_input_rotation0.jpg'
// A mesma CSP do app desktop (frontend/src/renderer/index.html), com um servidor fictício.
const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; media-src 'self' blob:; connect-src 'self' https://example.invalid"

let failures = 0
const check = (ok, msg, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FALHOU'} ${msg}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}
const f1 = (n) => Math.round(n * 10) / 10
// SHOTS=pasta: salva um print do vídeo de saída de cada efeito (para olhar a borda).
const shot = (page, name) => (process.env.SHOTS ? page.screenshot({ path: join(process.env.SHOTS, `${name}.png`) }) : null)

// GIF de 2 quadros (vermelho, azul) feito aqui mesmo, sem dependência: LZW com
// "limpar" a cada 2 pixels, o jeito mais simples de produzir um GIF válido.
function makeGif(size = 64) {
  const bytes = []
  const u16 = (n) => bytes.push(n & 255, n >> 8)
  bytes.push(...Buffer.from('GIF89a'))
  u16(size)
  u16(size)
  bytes.push(0x81, 0, 0)
  bytes.push(255, 0, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255) // paleta: vermelho, azul, preto, branco
  bytes.push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0)
  for (const color of [0, 1]) {
    bytes.push(0x21, 0xf9, 4, 0, 20, 0, 0, 0) // 0,2 s por quadro
    bytes.push(0x2c, 0, 0, 0, 0)
    u16(size)
    u16(size)
    bytes.push(0, 2) // min code size 2
    const codes = []
    for (let i = 0; i < (size * size) / 2; i++) codes.push(4, color, color)
    codes.push(5)
    let bits = 0
    let nbits = 0
    const data = []
    for (const c of codes) {
      bits |= c << nbits
      nbits += 3
      while (nbits >= 8) {
        data.push(bits & 255)
        bits >>= 8
        nbits -= 8
      }
    }
    if (nbits) data.push(bits & 255)
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255)
      bytes.push(chunk.length, ...chunk)
    }
    bytes.push(0)
  }
  bytes.push(0x3b)
  return Buffer.from(bytes)
}
const gif = makeGif()

// 1) Build do harness (mesmo Vite do renderer: WASM e modelo como assets)
await vite.build({
  root: join(here, 'e2e-video-background'),
  base: './',
  configFile: false,
  logLevel: 'warn',
  assetsInclude: ['**/*.wasm', '**/*.tflite'],
  build: { outDir: out, emptyOutDir: true, rollupOptions: { input: join(here, 'e2e-video-background/index.html') } }
})
const index = join(out, 'index.html')
writeFileSync(index, readFileSync(index, 'utf8').replace('__CSP__', CSP))

// 2) Foto de teste
const photoRes = await fetch(PHOTO_URL)
if (!photoRes.ok) throw new Error(`não consegui baixar a foto de teste (${photoRes.status})`)
const photo = `data:image/jpeg;base64,${Buffer.from(await photoRes.arrayBuffer()).toString('base64')}`

// Regiões (em px de uma imagem 480x480): rostos das meninas x folhagem ao fundo
const PERSON = { x: 80, y: 60, w: 120, h: 110 }
const BG = { x: 330, y: 10, w: 140, h: 100 }

async function suite(page, label) {
  console.log(`\n== ${label} ==`)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (/violates|Refused|blocked/i.test(m.text())) errors.push(m.text())
  })
  const size = await page.evaluate((p) => window.H.start(p), photo)
  check(size.width > 0, 'pipeline devolve vídeo', `${size.width}x${size.height}`)

  const sample = (rect, wait) => page.evaluate(([r, w]) => window.H.sample(r, w), [rect, wait])
  const setEffect = (e) => page.evaluate((x) => window.H.setEffect(x), e)

  await setEffect({ mode: 'none', image: null })
  const none = { person: await sample(PERSON, 800), bg: await sample(BG, 0) }

  await setEffect({ mode: 'blur', image: null })
  const blur = { person: await sample(PERSON, 2500), bg: await sample(BG, 0) }
  await shot(page, `${label.split(' ')[0]}-desfoque`)
  check(!(await page.evaluate(() => window.H.failed())), 'modelo carregou e segmentou')
  check(blur.bg.sharp < none.bg.sharp * 0.6, 'desfoque borra o fundo', `${f1(none.bg.sharp)} -> ${f1(blur.bg.sharp)}`)
  check(blur.person.sharp > none.person.sharp * 0.6, 'desfoque mantém a pessoa nítida', `${f1(none.person.sharp)} -> ${f1(blur.person.sharp)}`)

  const presets = await page.evaluate(() => window.H.presets)
  const preset = presets.find((p) => p.id === 'estudio') ?? presets[0]
  await setEffect({ mode: 'image', image: preset.dataUrl })
  const img = { person: await sample(PERSON, 2500), bg: await sample(BG, 0) }
  await shot(page, `${label.split(' ')[0]}-imagem`)
  const dist = Math.hypot(...img.bg.mean.map((v, i) => v - none.bg.mean[i]))
  check(dist > 40, 'imagem troca o fundo', `cor média mudou ${f1(dist)}`)
  check(img.bg.sharp < none.bg.sharp * 0.5, 'o fundo novo não tem a folhagem', `${f1(none.bg.sharp)} -> ${f1(img.bg.sharp)}`)
  check(img.person.sharp > none.person.sharp * 0.6, 'a pessoa continua no quadro', `${f1(none.person.sharp)} -> ${f1(img.person.sharp)}`)

  await setEffect({ mode: 'none', image: null })
  const back = await sample(BG, 800)
  check(Math.abs(back.sharp - none.bg.sharp) < none.bg.sharp * 0.25, 'voltar para "nenhum" restaura o vídeo', `${f1(back.sharp)}`)

  await setEffect({ mode: 'blur', image: null })
  const fps = await page.evaluate(() => window.H.fps(3000))
  console.log(`      FPS de saída com desfoque: ${f1(fps)}`)
  check(fps >= 20, 'FPS aceitável', `${f1(fps)} fps`)

  // GIF animado como fundo: a cor do fundo alterna entre vermelho e azul
  await page.evaluate((b64) => window.H.setGifEffect(b64), gif.toString('base64'))
  await sample(BG, 1500)
  const seen = new Set()
  for (let i = 0; i < 12; i++) {
    const { mean } = await sample(BG, 150)
    if (mean[0] > mean[2] + 60) seen.add('vermelho')
    if (mean[2] > mean[0] + 60) seen.add('azul')
  }
  check(seen.has('vermelho') && seen.has('azul'), 'GIF anima no fundo', [...seen].join(' + ') || 'não animou')
  const gifFrame = { person: await sample(PERSON, 0) }
  check(gifFrame.person.sharp > none.person.sharp * 0.6, 'com GIF a pessoa continua no quadro', f1(gifFrame.person.sharp))
  await setEffect({ mode: 'blur', image: null })
  const stillBlurred = await sample(BG, 600)
  check(stillBlurred.sharp < none.bg.sharp * 0.6, 'voltar para desfoque depois do GIF', f1(stillBlurred.sharp))

  // IndexedDB de verdade guarda e devolve o GIF
  const idb = await page.evaluate((b64) => window.H.gifRoundTrip(b64), gif.toString('base64'))
  check(idb.same && idb.deleted, 'IndexedDB guarda, devolve e apaga o GIF', JSON.stringify(idb))

  check(errors.length === 0, 'sem erros de página/CSP', errors.slice(0, 2).join(' | '))
  await page.evaluate(() => window.H.stop())
}

// 3) Chromium via http
const server = createServer((req, res) => {
  const file = join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  try {
    const type = { '.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm' }[extname(file)]
    res.writeHead(200, type ? { 'Content-Type': type } : {})
    res.end(readFileSync(file))
  } catch {
    res.writeHead(404).end()
  }
}).listen(0)
const port = server.address().port
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
await page.goto(`http://localhost:${port}/index.html`)
await page.waitForFunction(() => window.H)
await suite(page, 'Chromium (http)')
await browser.close()
server.close()

// 4) Electron em file:// (como o app empacotado)
if (process.argv.includes('--electron')) {
  const main = join(out, 'main.cjs')
  writeFileSync(
    main,
    `const { app, BrowserWindow } = require('electron')
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
  win.loadFile(${JSON.stringify(index)})
})
`
  )
  const app = await _electron.launch({ executablePath: require('electron'), args: [main] })
  const win = await app.firstWindow()
  await win.waitForFunction(() => window.H)
  await suite(win, 'Electron (file://)')
  await app.close()
}

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\ntudo certo')
process.exit(failures ? 1 : 0)
