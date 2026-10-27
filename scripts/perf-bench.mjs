#!/usr/bin/env node
// Banco de medição de CPU/GPU do app desktop em cenários fixos (ver docs/PERFORMANCE.md).
//
//   node scripts/perf-bench.mjs [--label antes] [--reps 3] [--warmup 15] [--duration 60]
//        [--scenarios a,b,c,d,e,g,h,i] [--front <frontend de outro checkout>] [--api http://localhost:8095/api] [--skip-build]
//        [--trace b,d] [--shots] [--out <pasta>] --backend-log <log do backend>
//   node scripts/perf-bench.mjs --compare antes.json depois.json
//
// Sobe o build de produção (electron-vite build + electron, não o dev server) com
// um perfil isolado, cria contas de teste no backend local, passa por cada cenário e
// a cada 1 s grava app.getAppMetrics() (CPU por tipo de processo) e o
// gpu_busy_percent do sysfs (Linux/amdgpu). No fim imprime média e p95 por cenário
// (mediana das repetições) e grava um JSON. Precisa do backend + LiveKit rodando.
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { cpuSample, formatComparison, formatTable, medianOfRuns, summarizeRun } from './lib/perfBench.mjs'
import { launchApp } from './lib/perfBenchApp.mjs'
import { windowControl } from './lib/perfBenchWindow.mjs'

const ROOT = resolve(import.meta.dirname, '..')
// --front: medir o frontend de outro checkout (ex.: um commit antigo) com este banco.
const frontArg = process.argv.indexOf('--front')
const FRONT = frontArg > 0 ? resolve(process.argv[frontArg + 1]) : join(ROOT, 'frontend')
const require = createRequire(join(FRONT, 'package.json'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.error(`[${new Date().toISOString().slice(11, 19)}]`, ...a)

function parseArgs(argv) {
  const opts = {
    label: 'medicao',
    reps: 3,
    warmup: 15,
    duration: 60,
    scenarios: ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i'],
    api: 'http://localhost:8095/api',
    skipBuild: false,
    shots: false,
    trace: [],
    out: join(tmpdir(), 'salinha-perf-bench'),
    backendLog: process.env.BACKEND_LOG ?? null,
    compare: null
  }
  const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean)
  for (let i = 0; i < argv.length; i++) {
    const [arg, next] = [argv[i], argv[i + 1]]
    if (arg === '--compare') return { ...opts, compare: [next, argv[i + 2]] }
    if (arg === '--skip-build' || arg === '--shots') {
      opts[arg === '--shots' ? 'shots' : 'skipBuild'] = true
      continue
    }
    if (arg === '--label') opts.label = next
    else if (arg === '--reps') opts.reps = Number(next)
    else if (arg === '--warmup') opts.warmup = Number(next)
    else if (arg === '--duration') opts.duration = Number(next)
    else if (arg === '--scenarios') opts.scenarios = list(next)
    else if (arg === '--trace') opts.trace = list(next)
    else if (arg === '--api') opts.api = next
    else if (arg === '--out') opts.out = next
    else if (arg === '--backend-log') opts.backendLog = next
    else if (arg === '--front') opts.front = next
    else continue
    i++
  }
  return opts
}

// ---------- backend: contas, servidor e canais de teste ----------

function apiClient(base) {
  return async function api(path, { token, method = 'GET', body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`)
    return text ? JSON.parse(text) : null
  }
}

// Confirma o e-mail pelo link que o backend sem SMTP imprime no log (BACKEND_LOG).
async function verifyEmail(api, email, logPath) {
  if (!logPath) throw new Error('passe --backend-log <arquivo> (ou BACKEND_LOG): o log do backend sem SMTP traz o link de confirmação de e-mail')
  for (let i = 0; i < 50; i++) {
    const text = readFileSync(logPath, 'utf8')
    const at = text.lastIndexOf(`para ${email} —`)
    const match = at >= 0 && /verify-email\?token=([^\s]+)/.exec(text.slice(at))
    if (match) {
      await api('/auth/verify-email', { method: 'POST', body: { token: decodeURIComponent(match[1]) } })
      return
    }
    await sleep(200)
  }
  throw new Error(`sem e-mail de confirmação para ${email} em ${logPath}`)
}

async function makeUser(api, name, run, backendLog) {
  const email = `${name}-${run}@perf.dev`
  const password = 'senha-forte-123'
  const { access_token: token } = await api('/auth/register', {
    method: 'POST',
    body: { username: `${name}${run}`, display_name: name, email, password }
  })
  const me = await api('/users/me', { token })
  await verifyEmail(api, email, backendLog)
  return { email, password, token, id: me.id ?? me.user?.id, username: `${name}${run}` }
}

async function seed(api, backendLog) {
  const run = Date.now().toString(36)
  const ana = await makeUser(api, 'ana', run, backendLog)
  const bia = await makeUser(api, 'bia', run, backendLog)
  await api('/friends/request', { token: ana.token, method: 'POST', body: { username: bia.username } })
  await api(`/friends/${ana.username}/accept`, { token: bia.token, method: 'PUT' })
  const server = await api('/servers', { token: ana.token, method: 'POST', body: { name: `Perf ${run}` } })
  const serverId = server.id ?? server.server?.id
  const channel = async (name, type) => {
    const c = await api(`/servers/${serverId}/channels`, { token: ana.token, method: 'POST', body: { name, type } })
    return c.id ?? c.channel?.id
  }
  const textId = await channel('geral-perf', 'text')
  const voiceId = await channel('voz-perf', 'voice')
  await api(`/servers/${serverId}/invite`, { token: ana.token, method: 'POST', body: { user_id: bia.id } })
  const invites = await api('/invites', { token: bia.token })
  const invite = (Array.isArray(invites) ? invites : invites.invites).find((i) => (i.server_id ?? i.server?.id) === serverId)
  await api(`/invites/${invite.id}/accept`, { token: bia.token, method: 'POST' })
  // Um canal com conversa de verdade (rolagem, avatares, nomes), não uma tela vazia.
  for (let i = 0; i < 40; i++) {
    const author = i % 3 === 0 ? ana : bia
    await api(`/channels/${textId}/messages`, {
      token: author.token,
      method: 'POST',
      body: { content: `mensagem ${i + 1} da medição — bora jogar mais tarde? :)` }
    })
  }
  return { ana, bia, serverId, textId, voiceId }
}

const GIF_AVATAR = join(ROOT, 'frontend', 'src', 'renderer', 'src', 'assets', 'maestro.gif')
const GIF_STATIC = join(ROOT, 'frontend', 'src', 'renderer', 'src', 'assets', 'maestro-still.png')

/** Avatar em GIF animado (o do Maestro, 12 qps) com o quadro parado que o app gera ao enviar. */
async function uploadGifAvatar(base, token) {
  const form = new FormData()
  form.append('file', new Blob([readFileSync(GIF_AVATAR)], { type: 'image/gif' }), 'avatar.gif')
  form.append('static', new Blob([readFileSync(GIF_STATIC)], { type: 'image/png' }), 'static.png')
  const res = await fetch(`${base}/users/me/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  if (!res.ok) throw new Error(`avatar GIF: ${res.status} ${await res.text()}`)
}

/** Cenários h/i: duas pessoas com avatar GIF num canal de voz à parte (as outras contas não mudam). */
async function seedGifPeers(api, base, seedData, backendLog) {
  if (seedData.gifPeers) return
  const run = Date.now().toString(36)
  const peers = []
  for (const name of ['caio', 'duda']) {
    const user = await makeUser(api, name, run, backendLog)
    await api('/friends/request', { token: seedData.ana.token, method: 'POST', body: { username: user.username } })
    await api(`/friends/${seedData.ana.username}/accept`, { token: user.token, method: 'PUT' })
    await api(`/servers/${seedData.serverId}/invite`, { token: seedData.ana.token, method: 'POST', body: { user_id: user.id } })
    const invites = await api('/invites', { token: user.token })
    const invite = (Array.isArray(invites) ? invites : invites.invites).find((i) => (i.server_id ?? i.server?.id) === seedData.serverId)
    await api(`/invites/${invite.id}/accept`, { token: user.token, method: 'POST' })
    await uploadGifAvatar(base, user.token)
    peers.push(user)
  }
  const channel = await api(`/servers/${seedData.serverId}/channels`, {
    token: seedData.ana.token,
    method: 'POST',
    body: { name: 'voz-gif', type: 'voice' }
  })
  seedData.gifPeers = peers
  seedData.gifVoiceId = channel.id ?? channel.channel?.id
}

/** Reaproveita as contas da medição anterior (o backend limita cadastros por IP). */
async function seedOnce(api, backendLog, outDir) {
  const file = join(outDir, 'seed.json')
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    try {
      for (const user of [saved.ana, saved.bia, ...(saved.gifPeers ?? [])]) {
        const res = await api('/auth/login', { method: 'POST', body: { email: user.email, password: user.password } })
        user.token = res.access_token
      }
      await api(`/servers/${saved.serverId}`, { token: saved.ana.token })
      return saved
    } catch (err) {
      log(`contas salvas não servem mais (${err.message}): criando novas`)
    }
  }
  const fresh = await seed(api, backendLog)
  writeFileSync(file, JSON.stringify(fresh))
  return fresh
}

// ---------- build e servidor estático (para o participante "bia") ----------

function build(serverUrl) {
  log('build de produção (electron-vite build)…')
  execFileSync('npx', ['electron-vite', 'build'], {
    cwd: FRONT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, VITE_SERVER_URL: serverUrl }
  })
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream', '.tflite': 'application/octet-stream', '.mp4': 'video/mp4', '.webm': 'video/webm' }

function serveRenderer() {
  const dir = join(FRONT, 'out', 'renderer')
  const server = createServer((req, res) => {
    const path = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!path.startsWith(dir) || !existsSync(path)) {
      res.writeHead(404).end()
      return
    }
    const file = path.endsWith('/') || !extname(path) ? join(path, 'index.html') : path
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` })))
}

// ---------- UI ----------

async function login(page, user) {
  await page.locator('input[autocomplete=username]').fill(user.email)
  await page.locator('input[type=password]').fill(user.password)
  await page.locator('button[type=submit]').click()
  await page.getByText('Adicionar amigo').first().waitFor({ timeout: 30000 })
}

async function loginApp(app, user) {
  await app.waitFor('a tela de login', `return !!document.querySelector('input[autocomplete=username]')`)
  await app.inPage(`h.fill('input[autocomplete=username]', ${JSON.stringify(user.email)}); h.fill('input[type=password]', ${JSON.stringify(user.password)}); document.querySelector('button[type=submit]').click(); return true`)
  await app.waitFor('o login', `return document.body.innerText.includes('Adicionar amigo')`)
}

const goHash = (page, hash) => page.evaluate((h) => (location.hash = h), hash)

/** Chromium do participante: CHROME, o do cache do Playwright (qualquer versão) ou o padrão. */
function peerChrome() {
  if (process.env.CHROME) return process.env.CHROME
  const cache = join(homedir(), '.cache', 'ms-playwright')
  if (!existsSync(cache)) return undefined
  const dirs = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
  for (const d of dirs) {
    const bin = join(cache, d, 'chrome-linux64', 'chrome')
    if (existsSync(bin)) return bin
  }
  return undefined
}

async function launchPeers(chromium) {
  return chromium.launch({
    executablePath: peerChrome(),
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
      '--autoplay-policy=no-user-gesture-required'
    ]
  })
}

/** Uma pessoa a mais na call (Chromium headless, microfone falso que bipa). */
async function openPeer(browser, url, user, serverId, channel) {
  const context = await browser.newContext({ permissions: ['microphone', 'camera'], viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(url + '#/login')
  await login(page, user)
  await goHash(page, `#/servers/${serverId}`)
  await page.getByText(channel, { exact: true }).first().click()
  return page
}

// ---------- amostragem ----------

function gpuBusyPath() {
  const drm = '/sys/class/drm'
  if (!existsSync(drm)) return null
  for (const card of readdirSync(drm).filter((d) => /^card\d+$/.test(d))) {
    const path = join(drm, card, 'device', 'gpu_busy_percent')
    if (existsSync(path)) return path
  }
  return null
}

const readMetrics = (app) =>
  app.evaluate(({ app: electronApp }) =>
    electronApp.getAppMetrics().map((m) => ({
      type: m.type,
      pid: m.pid,
      creationTime: m.creationTime,
      cpu: m.cpu.cumulativeCPUUsage ?? 0,
      memKB: m.memory.workingSetSize
    }))
  )

/** Amostra a cada 1 s por `seconds` s; o gpu_busy é lido a cada 100 ms e vira média do segundo. */
async function measure(app, seconds, gpuPath) {
  let gpuReadings = []
  const gpuTimer = gpuPath
    ? setInterval(() => gpuReadings.push(Number(readFileSync(gpuPath, 'utf8'))), 100)
    : null
  const samples = []
  let before = await readMetrics(app)
  let t0 = performance.now()
  for (let i = 0; i < seconds; i++) {
    await sleep(1000 - ((performance.now() - t0) % 1000))
    const after = await readMetrics(app)
    const t1 = performance.now()
    const s = cpuSample(before, after, (t1 - t0) / 1000)
    s.gpuBusy = gpuReadings.length ? gpuReadings.reduce((a, b) => a + b, 0) / gpuReadings.length : null
    samples.push(s)
    gpuReadings = []
    before = after
    t0 = t1
  }
  if (gpuTimer) clearInterval(gpuTimer)
  return samples
}

async function trace(app, file, seconds) {
  await app.evaluate(({ contentTracing }) =>
    contentTracing.startRecording({
      included_categories: ['toplevel', 'cc', 'viz', 'gpu', 'blink', 'v8', 'renderer.scheduler', 'devtools.timeline', 'disabled-by-default-devtools.timeline']
    })
  )
  await sleep(seconds * 1000)
  await app.evaluate(({ contentTracing }, path) => contentTracing.stopRecording(path), file)
  log(`trace: ${file}`)
}

// ---------- cenários ----------

const IN_CALL = `return !!h.byLabel('^Desconectar')`

function scenarios(ctx) {
  const { app, win, peer, seedData } = ctx
  const hash = (h) => app.inPage(`location.hash = ${JSON.stringify(h)}; return true`)
  const toText = async () => {
    await app.inPage(`h.byLabel('^Desconectar')?.click(); return true`)
    channel = null
    await hash(`#/servers/${seedData.serverId}/channels/${seedData.textId}`)
    await app.waitFor('o canal de texto', `return document.body.innerText.includes('mensagem 40 da medição')`)
  }
  let channel = null
  const toCall = async (name = 'voz-perf') => {
    if (channel === name && (await app.inPage(IN_CALL))) return
    await app.inPage(`h.byLabel('^Desconectar')?.click(); return true`)
    await hash(`#/servers/${seedData.serverId}`)
    await app.waitFor(`o canal ${name} na lista`, `const el = h.byText(${JSON.stringify(name)}); el?.click(); return !!el`)
    await app.waitFor('entrar na call', IN_CALL)
    channel = name
  }
  const peerSharing = () => peer.page.getByRole('button', { name: 'Parar de compartilhar tela' }).first().isVisible()
  const stopShare = async () => {
    if (await peerSharing()) await peer.page.getByRole('button', { name: 'Parar de compartilhar tela' }).first().click()
  }
  const watchStream = async () => {
    await win.focus()
    await toCall()
    if (!(await peerSharing())) await peer.page.getByRole('button', { name: 'Compartilhar tela' }).first().click()
    const playing = `[...document.querySelectorAll('video')].some((v) => h.visible(v) && v.videoWidth > 0)`
    await app.waitFor('assistir a transmissão', `if (${playing}) return true; h.byText('Assistir transmissão')?.click(); return false`)
  }
  return {
    a: { id: 'a-texto-foco', enter: async () => { await win.focus(); await toText(); await win.focus() } },
    b: { id: 'b-texto-sem-foco', enter: async () => { await win.focus(); await toText(); await win.blur() } },
    c: { id: 'c-texto-minimizada', enter: async () => { await win.focus(); await toText(); await win.minimize() } },
    d: {
      id: 'd-call-voz-sem-foco',
      enter: async () => { await win.focus(); await stopShare(); await toCall(); await win.blur() }
    },
    e: { id: 'e-call-assistindo-tela-sem-foco', enter: async () => { await watchStream(); await win.blur() } },
    // f (overlay de jogo) só existe no Windows: ver o roteiro em docs/PERFORMANCE.md.
    g: { id: 'g-call-assistindo-tela-minimizada', enter: async () => { await watchStream(); await win.minimize() } },
    // Duas pessoas com avatar GIF (e microfone que bipa) num canal à parte.
    h: { id: 'h-call-avatares-gif-foco', enter: async () => { await win.focus(); await stopShare(); await toCall('voz-gif'); await win.focus() } },
    i: { id: 'i-call-avatares-gif-sem-foco', enter: async () => { await win.focus(); await stopShare(); await toCall('voz-gif'); await win.blur() } }
  }
}

// ---------- main ----------

async function bench(opts) {
  const serverUrl = opts.api.replace(/\/api\/?$/, '')
  if (!opts.skipBuild) build(serverUrl)
  const api = apiClient(opts.api)
  const seedData = await seedOnce(api, opts.backendLog, opts.out)
  const needsGif = opts.scenarios.some((s) => 'hi'.includes(s))
  if (needsGif) {
    await seedGifPeers(api, opts.api, seedData, opts.backendLog)
    writeFileSync(join(opts.out, 'seed.json'), JSON.stringify(seedData))
  }
  log('contas e canais de teste prontos')
  const { chromium } = require('playwright')
  const needsPeer = opts.scenarios.some((s) => 'deghi'.includes(s))
  const static_ = needsPeer ? await serveRenderer() : null
  const peerBrowser = needsPeer ? await launchPeers(chromium) : null
  const peer = needsPeer
    ? { browser: peerBrowser, page: await openPeer(peerBrowser, static_.url, seedData.bia, seedData.serverId, 'voz-perf') }
    : null
  if (needsGif) {
    for (const user of seedData.gifPeers) await openPeer(peerBrowser, static_.url, user, seedData.serverId, 'voz-gif')
  }

  const profile = mkdtempSync(join(tmpdir(), 'salinha-perf-profile-'))
  const app = await launchApp({
    front: FRONT,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    // Perfil próprio: não mexe no login/configurações do Salinha instalado.
    env: { ...process.env, XDG_CONFIG_HOME: profile, APPDATA: profile }
  })
  const win = windowControl(app)
  const gpuPath = gpuBusyPath()
  log(`janela: ${win.name}; GPU busy: ${gpuPath ?? 'indisponível'}`)
  const results = {}
  const raw = {}
  try {
    await win.setup()
    await win.place()
    await loginApp(app, seedData.ana)
    const all = scenarios({ app, win, peer, seedData })
    const chosen = opts.scenarios.map((k) => all[k]).filter(Boolean)
    const runs = Object.fromEntries(chosen.map((s) => [s.id, []]))
    for (let rep = 1; rep <= opts.reps; rep++) {
      for (const s of chosen) {
        log(`rep ${rep}/${opts.reps} · ${s.id}`)
        await s.enter()
        await sleep(opts.warmup * 1000)
        if (opts.shots && rep === 1) await app.screenshot(join(opts.out, `shot-${opts.label}-${s.id}.png`))
        const samples = await measure(app, opts.duration, gpuPath)
        runs[s.id].push(summarizeRun(samples))
        ;(raw[s.id] ??= []).push(samples)
      }
    }
    for (const [id, list] of Object.entries(runs)) results[id] = medianOfRuns(list)
    for (const s of chosen.filter((c) => opts.trace.includes(c.id[0]))) {
      await s.enter()
      await sleep(opts.warmup * 1000)
      await trace(app, join(opts.out, `trace-${opts.label}-${s.id}.json`), 10)
    }
  } finally {
    await win.teardown()
    await app.close().catch(() => {})
    await peerBrowser?.close()
    static_?.server.close()
    rmSync(profile, { recursive: true, force: true })
  }
  return { results, raw }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.compare) {
    const load = (p) => JSON.parse(readFileSync(p, 'utf8')).results
    console.log(formatComparison(load(opts.compare[0]), load(opts.compare[1])))
    return
  }
  mkdirSync(opts.out, { recursive: true })
  const { results, raw } = await bench(opts)
  const meta = { label: opts.label, date: new Date().toISOString(), reps: opts.reps, warmup: opts.warmup, duration: opts.duration, platform: process.platform }
  const file = join(opts.out, `bench-${opts.label}-${Date.now()}.json`)
  writeFileSync(file, JSON.stringify({ meta, results, raw }, null, 1))
  console.log(`\n### ${opts.label} (CPU em % de um núcleo; média / p95; mediana de ${opts.reps} repetições)\n`)
  console.log(formatTable(results))
  console.log(`\nJSON: ${file}`)
}

await main()
