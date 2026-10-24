// Uso: backend + LiveKit rodando, renderer buildado com VITE_SERVER_URL e
// servido em APP (ex.: python3 -m http.server 5174 em frontend/out/renderer).
//   API=http://localhost:8080/api APP=http://localhost:5174/ node scripts/e2e-voice.mjs
// E2E: dois clientes (Chromium, mídia fake) entram no mesmo canal de voz via
// backend + LiveKit locais; um compartilha a tela. Verifica áudio e tela remotos.
import { createRequire } from 'module'
const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { chromium } = require('playwright')

const API = process.env.API ?? 'http://localhost:8080/api'
const APP = process.env.APP ?? 'http://localhost:5174/'
const run = Date.now().toString(36)

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function makeUser(name) {
  const email = `${name}-${run}@teste.dev`
  const password = 'senha-forte-123'
  const { access_token } = await api('/auth/register', {
    method: 'POST',
    body: { username: `${name}${run}`, display_name: name, email, password }
  })
  const me = await api('/users/me', { token: access_token })
  return { email, password, token: access_token, id: me.id ?? me.user?.id, username: `${name}${run}` }
}

const ana = await makeUser('ana')
const bia = await makeUser('bia')
await api('/friends/request', { token: ana.token, method: 'POST', body: { username: bia.username } })
await api(`/friends/${ana.username}/accept`, { token: bia.token, method: 'PUT' })
const server = await api('/servers', { token: ana.token, method: 'POST', body: { name: `E2E ${run}` } })
const serverId = server.id ?? server.server?.id
const channel = await api(`/servers/${serverId}/channels`, {
  token: ana.token, method: 'POST', body: { name: 'voz-e2e', type: 'voice' }
})
const channelId = channel.id ?? channel.channel?.id
await api(`/servers/${serverId}/invite`, { token: ana.token, method: 'POST', body: { user_id: bia.id } })
const invites = await api('/invites', { token: bia.token })
const invite = (Array.isArray(invites) ? invites : invites.invites).find((i) => (i.server_id ?? i.server?.id) === serverId)
await api(`/invites/${invite.id}/accept`, { token: bia.token, method: 'POST' })
console.log('setup ok', { serverId, channelId })

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--auto-select-desktop-capture-source=Entire screen',
    '--autoplay-policy=no-user-gesture-required'
  ]
})

async function openClient(user) {
  const context = await browser.newContext({ permissions: ['microphone', 'camera'] })
  const page = await context.newPage()
  page.on('response', (r) => { if (r.status() === 404) console.log(`[${user.username}] 404:`, r.url()) })
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${user.username}] console:`, m.text()) })
  await page.goto(APP + '#/login')
  await page.fill('input[type=email]', user.email)
  await page.fill('input[type=password]', user.password)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.hash.includes('login'))
  // O app ainda navega para a home após o login; espera ela renderizar para a
  // navegação abaixo não ser sobrescrita (com latência de túnel isso demora).
  await page.getByText('Adicionar amigo').first().waitFor({ timeout: 30000 })
  await page.goto(APP + `#/servers/${serverId}`)
  await page.getByText('voz-e2e', { exact: true }).first().click()
  return page
}

const audioTracks = (page) => page.evaluate(() =>
  [...document.querySelectorAll('audio')].flatMap((el) =>
    el.srcObject ? el.srcObject.getAudioTracks().map((t) => t.readyState) : []))
const videoTracks = (page) => page.evaluate(() =>
  [...document.querySelectorAll('video')].flatMap((el) =>
    el.srcObject ? el.srcObject.getVideoTracks().map((t) => `${t.readyState}:${el.videoWidth}x${el.videoHeight}`) : []))

async function waitFor(desc, fn, ok, timeout = 20000) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeout) {
    last = await fn()
    if (ok(last)) { console.log(`PASS ${desc}:`, JSON.stringify(last)); return last }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`FAIL ${desc}: ${JSON.stringify(last)}`)
}

let failed = false
try {
  const pageA = await openClient(ana)
  const pageB = await openClient(bia)

  await waitFor('ana ouve a bia', () => audioTracks(pageA), (t) => t.includes('live'))
  await waitFor('bia ouve a ana', () => audioTracks(pageB), (t) => t.includes('live'))

  await pageA.getByRole('button', { name: 'Compartilhar tela' }).click()
  await waitFor('bia vê a tela da ana', () => videoTracks(pageB), (t) => t.some((v) => v.startsWith('live:') && !v.endsWith(':0x0')))

  await pageB.getByRole('button', { name: 'Compartilhar tela' }).click()
  await waitFor('ana vê a tela da bia (duas telas ao mesmo tempo)', () => videoTracks(pageA), (t) => t.filter((v) => v.startsWith('live:') && !v.endsWith(':0x0')).length >= 2)

  await pageA.screenshot({ path: '/tmp/concord-e2e-ana.png' })
  await pageB.getByRole('button', { name: 'Desconectar', exact: true }).click()
  await waitFor('ana para de ouvir a bia após ela sair', () => audioTracks(pageA), (t) => t.length === 0)

  // DM: ana liga para a bia, bia aceita, ambos se ouvem e a bia liga a câmera.
  await pageA.getByRole('button', { name: 'Desconectar', exact: true }).click()
  await pageA.goto(APP + `#/dm/${bia.id}`)
  await pageA.getByRole('button', { name: 'Iniciar chamada de voz' }).click()
  await pageB.getByRole('button', { name: 'Aceitar chamada' }).click({ timeout: 15000 })
  await waitFor('DM: ana ouve a bia', () => audioTracks(pageA), (t) => t.includes('live'))
  await waitFor('DM: bia ouve a ana', () => audioTracks(pageB), (t) => t.includes('live'))
  await pageB.getByRole('button', { name: 'Ligar câmera' }).first().click()
  await waitFor('DM: ana vê a câmera da bia', () => videoTracks(pageA), (t) => t.some((v) => v.startsWith('live:') && !v.endsWith(':0x0')))
  await pageA.getByRole('button', { name: 'Encerrar chamada' }).first().click()
  await waitFor('DM: bia sai da chamada quando a ana encerra', () => audioTracks(pageB), (t) => t.length === 0)
} catch (err) {
  failed = true
  console.error(err.message)
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
