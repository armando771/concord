import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import UserContextMenuModeration, {
  VoiceModerationSection,
  ServerModerationSection
} from './UserContextMenuModeration'

describe('UserContextMenuModeration', () => {
  const defaultProps = {
    serverId: 's1',
    voiceCallId: 'v1',
    targetUserId: 'u1',
    targetName: 'Fulano',
    serverMuted: false,
    serverDeafened: false,
    canMuteInVoice: false,
    canDeafenInVoice: false,
    canDisconnect: false,
    canKick: false,
    canBan: false,
    itemClass: 'item-class',
    saving: false,
    close: vi.fn(),
    onModerate: vi.fn()
  }

  it('retorna null quando não tem permissões nem voz nem servidor', () => {
    const html = renderToStaticMarkup(<UserContextMenuModeration {...defaultProps} />)
    expect(html).toBe('')
  })

  it('renderiza Desconectar da chamada quando canDisconnect é true', () => {
    const html = renderToStaticMarkup(
      <UserContextMenuModeration {...defaultProps} canDisconnect={true} />
    )
    expect(html).toContain('Desconectar da chamada')
    expect(html).toContain('Voz')
  })

  it('renderiza Expulsar e Banir quando canKick e canBan são true', () => {
    const html = renderToStaticMarkup(
      <UserContextMenuModeration {...defaultProps} canKick={true} canBan={true} />
    )
    expect(html).toContain('Expulsar Fulano')
    expect(html).toContain('Banir Fulano')
  })
})

describe('VoiceModerationSection', () => {
  const defaultVoiceProps = {
    voiceCallId: 'v1',
    targetUserId: 'u1',
    serverMuted: false,
    serverDeafened: false,
    canMuteInVoice: true,
    canDeafenInVoice: true,
    canDisconnect: true,
    itemClass: 'item-class',
    saving: false,
    onModerate: vi.fn()
  }

  it('renderiza estados alternados de áudio (silenciar/liberar fala, ensurdecer/liberar áudio)', () => {
    const unmutedHtml = renderToStaticMarkup(<VoiceModerationSection {...defaultVoiceProps} />)
    expect(unmutedHtml).toContain('Silenciar no servidor')
    expect(unmutedHtml).toContain('Ensurdecer no servidor')

    const mutedHtml = renderToStaticMarkup(
      <VoiceModerationSection {...defaultVoiceProps} serverMuted={true} serverDeafened={true} />
    )
    expect(mutedHtml).toContain('Liberar a fala no servidor')
    expect(mutedHtml).toContain('Liberar o áudio no servidor')
  })

  it('retorna null se todas as permissões de voz forem falsas', () => {
    const html = renderToStaticMarkup(
      <VoiceModerationSection
        {...defaultVoiceProps}
        canMuteInVoice={false}
        canDeafenInVoice={false}
        canDisconnect={false}
      />
    )
    expect(html).toBe('')
  })
})

describe('ServerModerationSection', () => {
  const defaultServerProps = {
    serverId: 's1',
    targetUserId: 'u1',
    targetName: 'Beltrano',
    canKick: false,
    canBan: false,
    itemClass: 'item-class',
    close: vi.fn(),
    askKick: vi.fn(),
    askBan: vi.fn()
  }

  it('retorna null se não puder expulsar nem banir', () => {
    const html = renderToStaticMarkup(<ServerModerationSection {...defaultServerProps} />)
    expect(html).toBe('')
  })

  it('renderiza apenas expulsar quando só canKick é true', () => {
    const html = renderToStaticMarkup(
      <ServerModerationSection {...defaultServerProps} canKick={true} />
    )
    expect(html).toContain('Expulsar Beltrano')
    expect(html).not.toContain('Banir Beltrano')
  })

  it('renderiza apenas banir quando só canBan é true', () => {
    const html = renderToStaticMarkup(
      <ServerModerationSection {...defaultServerProps} canBan={true} />
    )
    expect(html).not.toContain('Expulsar Beltrano')
    expect(html).toContain('Banir Beltrano')
  })
})
