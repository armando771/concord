import { describe, expect, it } from 'vitest'
import { dmMenuTarget, dmPeer, dmSearchUsers, type PeerLike } from './dmPeer'

const ana: PeerLike = { id: 'ana', username: 'ana', display_name: 'Ana Souza', avatar_url: 'a.png' }
const bia: PeerLike = { id: 'bia', username: 'bia', display_name: '' }
const eu: PeerLike = { id: 'eu', username: 'eu', display_name: 'Eu Mesmo' }

describe('dmPeer', () => {
  it('acha a pessoa entre os amigos', () => {
    const p = dmPeer('ana', eu, [ana], [])
    expect(p.other).toBe(ana)
    expect(p.name).toBe('Ana Souza')
    expect(p.handle).toBe('ana')
  })

  it('sem ser amigo, vale a pessoa da lista de conversas', () => {
    const p = dmPeer('ana', eu, [], [{ other_user: ana }])
    expect(p.other).toBe(ana)
  })

  it('sem nome de exibição, usa o @', () => {
    expect(dmPeer('bia', eu, [bia], []).name).toBe('')
    expect(dmPeer('bia', eu, [{ id: 'bia', username: 'bia' }], []).name).toBe('bia')
  })

  it('pessoa desconhecida vira "Usuário" e fica sem @', () => {
    const p = dmPeer('zz', eu, [], [])
    expect(p.name).toBe('Usuário')
    expect(p.handle).toBe('')
  })

  it('DM comigo mesmo usa o meu perfil quando ela não está nas listas', () => {
    const p = dmPeer('eu', eu, [], [])
    expect(p.name).toBe('Eu Mesmo')
    expect(p.handle).toBe('eu')
  })

  it('placeholder e menção usam o @, ou o nome sem @', () => {
    const com = dmPeer('ana', eu, [ana], [])
    expect(com.placeholder).toBe('Mensagem para @ana')
    expect(com.mentionable).toEqual([{ username: 'ana', display_name: 'Ana Souza' }])
    const sem = dmPeer('zz', eu, [], [])
    expect(sem.placeholder).toBe('Mensagem para @Usuário')
    expect(sem.mentionable).toEqual([])
  })
})

describe('dmSearchUsers', () => {
  it('eu e a outra pessoa, nessa ordem', () => {
    const peer = dmPeer('ana', eu, [ana], [])
    expect(dmSearchUsers(eu, 'ana', peer).map((u) => u.id)).toEqual(['eu', 'ana'])
  })

  it('sem login, só a outra pessoa; comigo mesmo, só eu', () => {
    const peer = dmPeer('ana', eu, [ana], [])
    expect(dmSearchUsers(null, 'ana', peer).map((u) => u.id)).toEqual(['ana'])
    const self = dmPeer('eu', eu, [], [])
    expect(dmSearchUsers(eu, 'eu', self).map((u) => u.id)).toEqual(['eu'])
  })

  it('outra pessoa sem @ conhecido não entra', () => {
    const peer = dmPeer('zz', eu, [], [])
    expect(dmSearchUsers(eu, 'zz', peer).map((u) => u.id)).toEqual(['eu'])
  })
})

describe('dmMenuTarget', () => {
  const peer = dmPeer('ana', eu, [ana], [])

  it('monta o alvo do menu com a conversa', () => {
    expect(dmMenuTarget('ana', 'eu', 'Ana Souza', peer.handle, 'c1')).toEqual({
      userId: 'ana',
      name: 'Ana Souza',
      username: 'ana',
      conversationId: 'c1'
    })
  })

  it('sem conversa ou sem @, os campos ficam indefinidos', () => {
    expect(dmMenuTarget('zz', 'eu', 'X', '', null)).toEqual({
      userId: 'zz',
      name: 'X',
      username: undefined,
      conversationId: undefined
    })
  })

  it('não abre menu para si mesmo nem sem pessoa na rota', () => {
    expect(dmMenuTarget('eu', 'eu', 'Eu', 'eu', null)).toBeNull()
    expect(dmMenuTarget(undefined, 'eu', 'Eu', 'eu', null)).toBeNull()
  })
})
