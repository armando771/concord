// Seções da tela de Configurações (navegação da esquerda, como no Discord) e a
// busca do topo.

export type SettingsSectionId =
  'account' | 'profiles' | 'privacy' | 'voice' | 'notifications' | 'app'

export interface SettingsSection {
  id: SettingsSectionId
  label: string
  group: 'user' | 'app'
  /** Palavras que a busca também encontra (o que tem dentro da seção). */
  keywords: string[]
}

export const SETTINGS_GROUPS: { id: SettingsSection['group']; label: string }[] = [
  { id: 'user', label: 'Configurações de usuário' },
  { id: 'app', label: 'Configurações do aplicativo' }
]

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'account',
    label: 'Minha conta',
    group: 'user',
    keywords: ['conta', 'usuário', 'e-mail', 'email', 'nome de usuário', 'membro desde']
  },
  {
    id: 'profiles',
    label: 'Perfis',
    group: 'user',
    keywords: [
      'perfil',
      'avatar',
      'foto',
      'gif',
      'banner',
      'cor',
      'bio',
      'sobre mim',
      'pronomes',
      'nota',
      'links',
      'steam',
      'twitch',
      'aniversário'
    ]
  },
  {
    id: 'privacy',
    label: 'Privacidade e segurança',
    group: 'user',
    keywords: [
      'privacidade',
      'segurança',
      'bloquear',
      'bloqueados',
      'pedido de amizade',
      'amigos',
      'mensagem direta',
      'dm'
    ]
  },
  {
    id: 'voice',
    label: 'Voz e áudio',
    group: 'app',
    keywords: ['voz', 'microfone', 'saída', 'fone', 'ruído', 'rnnoise', 'teste do microfone']
  },
  {
    id: 'notifications',
    label: 'Notificações',
    group: 'app',
    keywords: ['notificação', 'som', 'barra de tarefas', 'área de trabalho', 'não perturbe']
  },
  {
    id: 'app',
    label: 'Aplicativo',
    group: 'app',
    keywords: ['windows', 'iniciar', 'inicialização', 'overlay', 'jogos', 'opacidade']
  }
]

/** "Notificação" acha "notificacao" e vice-versa. */
const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function filterSections(
  query: string,
  sections: SettingsSection[] = SETTINGS_SECTIONS
): SettingsSection[] {
  const q = normalize(query)
  if (!q) return sections
  return sections.filter((s) =>
    [s.label, ...s.keywords].some((text) => normalize(text).includes(q))
  )
}
