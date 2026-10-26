// E2E test for Stickers, Giphy/GIFs, Reactions and Media in chat
import { strict as assert } from 'assert'
import { execSync } from 'child_process'

const API = process.env.API ?? 'http://localhost:8080/api'
const run = Date.now().toString(36)

// PNG 1x1 valid image
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed }
}

async function uploadSticker(token, serverId, name, bytes) {
  const form = new FormData()
  form.append('name', name)
  form.append('file', new Blob([bytes], { type: 'image/png' }), `${name}.png`)
  const res = await fetch(`${API}/servers/${serverId}/stickers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

async function makeUser(name) {
  const username = `${name}_${run}`
  const email = `${name}-${run}@teste.dev`
  const password = 'senha-forte-123'
  let res = await api('/auth/register', {
    method: 'POST',
    body: { username, display_name: name, email, password }
  })

  if (res.status === 429) {
    console.log(`   (Aviso: registro de ${name} retornou 429, tentando login com conta existente ${name}...)`)
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: { login: name, password }
    })
    if (loginRes.status === 200 && loginRes.body?.access_token) {
      const me = (await api('/users/me', { token: loginRes.body.access_token })).body
      return {
        email: `${name}@teste.dev`,
        password,
        token: loginRes.body.access_token,
        name,
        id: me.id ?? me.user?.id
      }
    }
  }

  assert.equal(res.status, 201, `register ${name} failed: ${JSON.stringify(res.body)}`)
  
  // Marca email como verificado no banco para os testes
  execSync('docker exec concord-postgres psql -U concord-user -d concord -c "UPDATE users SET email_verified_at = NOW();"')

  const me = (await api('/users/me', { token: res.body.access_token })).body
  return {
    email,
    password,
    token: res.body.access_token,
    name,
    id: me.id ?? me.user?.id
  }
}

async function runTests() {
  console.log('--- INICIANDO TESTES END-TO-END (E2E) ---')

  // 1. Criação de usuários Ana e Bia
  console.log('1. Criando usuários Ana e Bia...')
  const ana = await makeUser('ana')
  const bia = await makeUser('bia')
  console.log(`   Ana: ${ana.id}, Bia: ${bia.id}`)

  // 2. Ana cria um servidor e pega o canal de texto
  console.log('2. Ana criando servidor...')
  const srvRes = await api('/servers', {
    token: ana.token,
    method: 'POST',
    body: { name: `Servidor E2E ${run}` }
  })
  assert.equal(srvRes.status, 201, 'Servidor deve ser criado com 201')
  const serverId = srvRes.body.id ?? srvRes.body.server?.id

  // Bia entra no servidor
  console.log('   Bia entrando no servidor pelo código de convite...')
  const codeRes = await api(`/servers/${serverId}/invite-code`, { token: ana.token })
  assert.equal(codeRes.status, 200)
  const joinRes = await api('/invites/join', {
    token: bia.token,
    method: 'POST',
    body: { code: codeRes.body.code }
  })
  assert.equal(joinRes.status, 200, `Bia deve entrar no servidor: ${JSON.stringify(joinRes.body)}`)

  // Pega o canal de texto principal
  const channels = (await api(`/servers/${serverId}/channels`, { token: ana.token })).body
  const channel = channels.find((c) => (c.type ?? 'text') === 'text')
  assert.ok(channel, 'Canal de texto deve existir')
  console.log(`   Servidor: ${serverId}, Canal: ${channel.id}`)

  // 3. Upload de Figurinha (Ana envia figurinha)
  console.log('3. Ana enviando figurinha para o servidor...')
  const uploadRes = await uploadSticker(ana.token, serverId, 'doge_test', PNG)
  assert.equal(uploadRes.status, 201, `Upload de figurinha deve retornar 201: ${JSON.stringify(uploadRes.body)}`)
  const sticker = uploadRes.body
  assert.equal(sticker.name, 'doge_test')
  assert.equal(sticker.server_id, serverId)
  assert.equal(sticker.uploader_id, ana.id)
  console.log(`   Figurinha criada com sucesso: ID ${sticker.id} (nome: :${sticker.name}:)`)

  // 4. Bia lista figurinhas do servidor
  console.log('4. Bia listando figurinhas do servidor...')
  const listStkRes = await api(`/servers/${serverId}/stickers`, { token: bia.token })
  assert.equal(listStkRes.status, 200)
  assert.ok(Array.isArray(listStkRes.body))
  assert.ok(listStkRes.body.some((s) => s.id === sticker.id && s.name === 'doge_test'))
  console.log(`   Bia encontrou a figurinha da Ana no servidor!`)

  // 5. Download do arquivo de figurinha com media token
  console.log('5. Obtendo media token e baixando arquivo da figurinha...')
  const tokenRes = await api('/media/token', { token: bia.token })
  assert.equal(tokenRes.status, 200)
  const mediaToken = tokenRes.body.token
  const fileRes = await fetch(`${API}/stickers/${sticker.id}/file?token=${mediaToken}`)
  assert.equal(fileRes.status, 200, 'Download da figurinha deve retornar 200')
  const fileBytes = Buffer.from(await fileRes.arrayBuffer())
  assert.equal(fileBytes.length, PNG.length)
  console.log(`   Download da figurinha conferido (${fileBytes.length} bytes)!`)

  // 6. Envio de mensagem com Figurinha (sem texto)
  console.log('6. Ana enviando mensagem apenas com a Figurinha no chat...')
  const sendStkMsg = await api(`/channels/${channel.id}/messages`, {
    token: ana.token,
    method: 'POST',
    body: {
      content: '',
      sticker_id: sticker.id
    }
  })
  assert.equal(sendStkMsg.status, 201, `Envio de figurinha deve retornar 201: ${JSON.stringify(sendStkMsg.body)}`)
  const msg1 = sendStkMsg.body
  assert.equal(msg1.sticker_id, sticker.id)
  assert.ok(msg1.sticker, 'Preview da figurinha deve estar populado')
  assert.equal(msg1.sticker.name, 'doge_test')
  console.log(`   Mensagem com figurinha enviada com sucesso: ID ${msg1.id}`)

  // 7. Envio de mensagem com GIF
  console.log('7. Bia enviando mensagem com GIF do Giphy...')
  const sendGifMsg = await api(`/channels/${channel.id}/messages`, {
    token: bia.token,
    method: 'POST',
    body: {
      content: 'olha esse gif!',
      gif_url: 'https://media.giphy.com/media/test/giphy.gif',
      gif_metadata: { width: 480, height: 270, preview_url: 'https://media.giphy.com/media/test/preview.gif' }
    }
  })
  assert.equal(sendGifMsg.status, 201, `Envio de GIF deve retornar 201: ${JSON.stringify(sendGifMsg.body)}`)
  const msg2 = sendGifMsg.body
  assert.equal(msg2.gif_url, 'https://media.giphy.com/media/test/giphy.gif')
  assert.equal(msg2.gif_metadata.width, 480)
  console.log(`   Mensagem com GIF enviada com sucesso: ID ${msg2.id}`)

  // 8. Reações com Emojis
  console.log('8. Testando sistema de reações com emojis...')
  // Bia reage com 👍 na mensagem de figurinha da Ana
  const react1 = await api(`/channels/${channel.id}/messages/${msg1.id}/reactions`, {
    token: bia.token,
    method: 'POST',
    body: { emoji: '👍' }
  })
  assert.equal(react1.status, 200, `Reação com 👍 deve retornar 200: ${JSON.stringify(react1.body)}`)
  console.log('   Bia reagiu com 👍 na mensagem da Ana')

  // Ana também reage com 👍 na mesma mensagem
  const react2 = await api(`/channels/${channel.id}/messages/${msg1.id}/reactions`, {
    token: ana.token,
    method: 'POST',
    body: { emoji: '👍' }
  })
  assert.equal(react2.status, 200)
  console.log('   Ana também reagiu com 👍 na mesma mensagem')

  // Ana reage com 🔥 na mensagem de GIF da Bia
  const react3 = await api(`/channels/${channel.id}/messages/${msg2.id}/reactions`, {
    token: ana.token,
    method: 'POST',
    body: { emoji: '🔥' }
  })
  assert.equal(react3.status, 200)
  console.log('   Ana reagiu com 🔥 na mensagem da Bia')

  // 9. Consulta histórico de mensagens e confere agregação de reações
  console.log('9. Verificando listagem e agregação de reações no chat...')
  const listMsgs = await api(`/channels/${channel.id}/messages`, { token: bia.token })
  assert.equal(listMsgs.status, 200)
  const fetchedMsg1 = listMsgs.body.find((m) => m.id === msg1.id)
  assert.ok(fetchedMsg1, 'Mensagem 1 deve estar na lista')
  assert.ok(fetchedMsg1.reactions, 'Reações devem estar presentes')
  const thumbReaction = fetchedMsg1.reactions.find((r) => r.emoji === '👍')
  assert.ok(thumbReaction, 'Reação 👍 deve existir')
  assert.equal(thumbReaction.count, 2, 'Contagem de 👍 deve ser 2')
  assert.ok(thumbReaction.user_ids.includes(ana.id))
  assert.ok(thumbReaction.user_ids.includes(bia.id))
  console.log(`   Reação 👍 na msg 1 verificada: count=${thumbReaction.count}, users=[Ana, Bia]`)

  // 10. Removendo reação (Bia remove o 👍)
  console.log('10. Bia removendo reação 👍...')
  const removeReact = await api(`/channels/${channel.id}/messages/${msg1.id}/reactions?emoji=${encodeURIComponent('👍')}`, {
    token: bia.token,
    method: 'DELETE'
  })
  assert.equal(removeReact.status, 200, 'Remoção de reação deve retornar 200')

  // Confere que agora count é 1
  const listMsgsAfter = await api(`/channels/${channel.id}/messages`, { token: bia.token })
  const fetchedMsg1After = listMsgsAfter.body.find((m) => m.id === msg1.id)
  const thumbAfter = fetchedMsg1After.reactions.find((r) => r.emoji === '👍')
  assert.ok(thumbAfter, 'Reação ainda deve existir (da Ana)')
  assert.equal(thumbAfter.count, 1, 'Contagem deve ser 1 após remoção da Bia')
  assert.deepEqual(thumbAfter.user_ids, [ana.id])
  console.log('   Remoção de reação confirmada com sucesso!')

  // 11. Teste dos endpoints proxy do Giphy (Trending e Search)
  console.log('11. Testando endpoints de proxy do Giphy...')
  const trendingRes = await api('/gifs/trending', { token: bia.token })
  assert.equal(trendingRes.status, 200, 'Trending GIFs deve retornar 200')
  assert.ok(Array.isArray(trendingRes.body), 'Trending GIFs deve ser um array')
  console.log(`   Giphy Trending OK (retornou ${trendingRes.body.length} itens)`)

  const searchRes = await api('/gifs/search?q=cats', { token: bia.token })
  assert.equal(searchRes.status, 200, 'Search GIFs deve retornar 200')
  assert.ok(Array.isArray(searchRes.body), 'Search GIFs deve ser um array')
  console.log(`   Giphy Search OK (retornou ${searchRes.body.length} itens)`)

  // 12. Exclusão de Figurinha
  console.log('12. Ana excluindo a figurinha...')
  const delStk = await api(`/servers/${serverId}/stickers/${sticker.id}`, {
    token: ana.token,
    method: 'DELETE'
  })
  assert.equal(delStk.status, 200)
  const listStkEmpty = await api(`/servers/${serverId}/stickers`, { token: ana.token })
  assert.equal(listStkEmpty.body.length, 0, 'Servidor não deve ter mais figurinhas')
  console.log('   Figurinha excluída do servidor com sucesso!')

  // 13. Mensagem com figurinha excluída continua legível
  console.log('13. Conferindo que mensagem de figurinha excluída continua legível...')
  const listMsgsFinal = await api(`/channels/${channel.id}/messages`, { token: bia.token })
  const finalMsg1 = listMsgsFinal.body.find((m) => m.id === msg1.id)
  assert.ok(finalMsg1, 'Mensagem deve continuar existindo')
  console.log('   Mensagem pós-exclusão mantida no histórico!')

  console.log('\n=============================================')
  console.log('🎉 TODOS OS 13 TESTES END-TO-END PASSARAM!')
  console.log('=============================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE E2E:', err)
  process.exit(1)
})
