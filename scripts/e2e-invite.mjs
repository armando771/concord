// E2E do convite por código: Ana pega o código em "Convidar"; Bia (que não é
// amiga dela) digita o código e entra no servidor sozinha.
// Uso: igual ao scripts/e2e-voice.mjs (backend rodando + renderer servido em APP).
//   API=http://localhost:8080/api APP=http://localhost:5174/ node scripts/e2e-invite.mjs
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
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

async function makeUser(name) {
  const email = `${name}-${run}@teste.dev`
  const password = 'senha-forte-123'
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { username: `${name}${run}`, display_name: name, email, password }
  })
  return { email, password, token: body.access_token, name }
}

function check(desc, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${desc}${detail === undefined ? '' : ': ' + JSON.stringify(detail)}`)
  if (!ok) process.exitCode = 1
}

const ana = await makeUser('ana')
const bia = await makeUser('bia')
const server = (await api('/servers', { token: ana.token, method: 'POST', body: { name: `Turma ${run}` } })).body
const serverId = server.id ?? server.server?.id

const browser = await chromium.launch({ executablePath: process.env.CHROME })
async function login(user) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await context.newPage()
  await page.goto(APP + '#/login')
  await page.fill('input[type=email]', user.email)
  await page.fill('input[type=password]', user.password)
  await page.click('button[type=submit]')
  await page.getByText('Adicionar amigo').first().waitFor({ timeout: 30000 })
  return page
}

try {
  // Ana: Convidar → código → Copiar
  const pageA = await login(ana)
  await pageA.goto(APP + `#/servers/${serverId}`)
  await pageA.getByRole('button', { name: 'Convidar', exact: true }).first().click()
  const codeEl = pageA.getByLabel('Código de convite')
  await pageA.waitForFunction(() => /^[A-Z2-9]{8}$/.test(document.querySelector('[aria-label="Código de convite"]')?.textContent ?? ''))
  const code = (await codeEl.textContent()).trim()
  check('ana vê o código do servidor', /^[A-Z2-9]{8}$/.test(code), code)
  await pageA.getByRole('button', { name: 'Copiar' }).click()
  check('copiar põe o código na área de transferência', (await pageA.evaluate(() => navigator.clipboard.readText())) === code)

  // Mesmo código ao abrir de novo (não muda a cada vez)
  const again = (await api(`/servers/${serverId}/invite-code`, { token: ana.token })).body.code
  check('o código é fixo', again === code)
  check('quem não é membro não vê o código', (await api(`/servers/${serverId}/invite-code`, { token: bia.token })).status === 403)
  check('código errado é recusado', (await api('/invites/join', { token: bia.token, method: 'POST', body: { code: 'ZZZZZZZZ' } })).status === 404)

  // Bia: + → Entrar com código (digitando em minúsculas, com espaço)
  const pageB = await login(bia)
  await pageB.getByRole('button', { name: 'Adicionar servidor' }).click()
  const typed = `${code.slice(0, 4).toLowerCase()} ${code.slice(4).toLowerCase()}`
  await pageB.getByLabel('Código de convite').fill(typed)
  await pageB.getByRole('button', { name: 'Entrar', exact: true }).click()
  await pageB.waitForURL((u) => u.hash.includes(`/servers/${serverId}`), { timeout: 15000 })
  check('bia entra no servidor com o código digitado', true, typed)
  await pageB.getByTitle(`Turma ${run}`).first().waitFor({ timeout: 10000 })
  check('o servidor aparece na lista da bia', true)

  // Ana vê a Bia entrar (ao vivo, sem recarregar)
  await pageA.getByRole('button', { name: 'Fechar' }).click()
  await pageA.getByText('bia', { exact: true }).first().waitFor({ timeout: 10000 })
  check('ana vê a bia na lista de membros na hora', true)

  // Entrar de novo não dá erro nem duplica
  const twice = await api('/invites/join', { token: bia.token, method: 'POST', body: { code } })
  const members = (await api(`/servers/${serverId}`, { token: ana.token })).body.members
  check('entrar de novo não duplica', twice.status === 200 && members.length === 2, members.length)
} catch (err) {
  console.log('FAIL', err.message.split('\n')[0])
  process.exitCode = 1
} finally {
  await browser.close()
}
