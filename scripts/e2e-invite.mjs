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

  // Qualquer membro pode convidar: a Bia (membro comum) vê o botão e o código
  await pageB.getByRole('button', { name: 'Convidar', exact: true }).first().click()
  await pageB.waitForFunction(() => /^[A-Z2-9]{8}$/.test(document.querySelector('[aria-label="Código de convite"]')?.textContent ?? ''))
  check('membro comum também vê o código para convidar', (await pageB.getByLabel('Código de convite').first().textContent()).trim() === code)
  await pageB.getByRole('button', { name: 'Fechar' }).click()

  // Moderador: a Ana (dona) clica com o botão direito na Bia e promove
  const createChannel = () => api(`/servers/${serverId}/channels`, { token: bia.token, method: 'POST', body: { name: `sala-${Date.now()}`, type: 'text' } })
  check('membro comum não cria canal', (await createChannel()).status === 403)
  await pageA.getByText('bia', { exact: true }).first().click({ button: 'right' })
  await pageA.getByRole('menuitem', { name: 'Tornar moderador' }).click()
  await pageA.getByText('Moderadores — 1').waitFor({ timeout: 10000 })
  check('ana vê a bia em Moderadores', true)
  await pageB.getByText('Moderadores — 1').waitFor({ timeout: 10000 })
  check('a bia também vê na hora (sem recarregar)', true)
  check('moderadora cria canal', (await createChannel()).status === 201)
  const biaId = (await api('/users/me', { token: bia.token })).body.id
  check('moderadora não muda cargos (só a dona)', (await api(`/servers/${serverId}/members/${biaId}/role`, { token: bia.token, method: 'PUT', body: { role: 'member' } })).status === 403)
  await pageA.getByText('bia', { exact: true }).first().click({ button: 'right' })
  await pageA.getByRole('menuitem', { name: 'Remover moderador' }).click()
  await pageA.getByText('Membros — 1').waitFor({ timeout: 10000 })
  check('ana remove o moderador', (await createChannel()).status === 403)

  // Botão direito na Ana (lista de membros): mensagem privada e amizade, sem
  // serem amigas — basta estarem no mesmo servidor.
  await pageB.getByText('ana', { exact: true }).first().click({ button: 'right' })
  await pageB.getByRole('menuitem', { name: 'Enviar mensagem' }).click()
  await pageB.waitForURL((u) => u.hash.includes('/dm/'), { timeout: 10000 })
  const box = pageB.getByPlaceholder(/Mensagem para @ana/)
  await box.fill('oi ana, entrei pelo código!')
  await box.press('Enter')
  const anaConvs = async () => (await api('/conversations', { token: ana.token })).body ?? []
  let got = false
  for (let i = 0; i < 20 && !got; i++) {
    const convs = await anaConvs()
    got = convs.some((c) => c.last_message?.content === 'oi ana, entrei pelo código!')
    if (!got) await new Promise((r) => setTimeout(r, 500))
  }
  check('bia manda mensagem privada para a ana sem serem amigas', got)
  await pageB.goto(APP + `#/servers/${serverId}`)
  await pageB.getByText('ana', { exact: true }).first().click({ button: 'right' })
  await pageB.getByRole('menuitem', { name: 'Adicionar amigo' }).click()
  let pending = ''
  for (let i = 0; i < 20 && !pending.includes(`bia${run}`); i++) {
    pending = JSON.stringify((await api('/friends/pending', { token: ana.token })).body)
    await new Promise((r) => setTimeout(r, 300))
  }
  check('pedido de amizade chega para a ana', pending.includes(`bia${run}`))
  const stranger = await makeUser('estranho')
  const anaId = (await api('/users/me', { token: ana.token })).body.id
  const blocked = await api(`/conversations/with/${anaId}`, { token: stranger.token })
  check('quem não divide servidor nem é amigo não abre DM', blocked.status === 403, blocked.status)

  // Entrar de novo não dá erro nem duplica
  const twice = await api('/invites/join', { token: bia.token, method: 'POST', body: { code } })
  const members = (await api(`/servers/${serverId}`, { token: ana.token })).body.members
  check('entrar de novo não duplica', twice.status === 200 && members.length === 2, members.length)
} catch (err) {
  console.log('FAIL', err.message.split('\n').slice(0, 4).join(' / '))
  process.exitCode = 1
} finally {
  await browser.close()
}
