import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StandardUserServerSection } from './UserContextMenuServerSections'

describe('UserContextMenuServerSections', () => {
  it('StandardUserServerSection renderiza botão alterar apelido quando canNick é true', () => {
    const html = renderToStaticMarkup(
      <StandardUserServerSection
        server={{ id: 's1' }}
        canNick={true}
        canMuteInVoice={false}
        canDeafenInVoice={false}
        canDisconnect={false}
        canKick={false}
        canBan={false}
        target={{ userId: 'u1', name: 'Usuário 1' }}
        saving={false}
        close={vi.fn()}
        itemClass="item"
        onEditNickname={vi.fn()}
        onModerate={vi.fn()}
      />
    )
    expect(html).toContain('Alterar apelido')
  })
})
