/**
 * Todos os textos do convite de visitante para a call, num lugar só (para
 * aprovar ou trocar sem caçar pelos componentes).
 */
export const GUEST_COPY = {
  // Quem convida (call de canal de voz)
  button: 'Convidar visitante',
  modalTitle: 'Convidar visitante para a call',
  modalIntro:
    'Gere um link para alguém de fora do servidor entrar só nesta call, sem virar membro. Ouvir os outros e assistir às transmissões vale sempre.',
  durationLabel: 'Duração do acesso',
  permsLabel: 'O visitante também pode',
  canSpeak: 'Falar',
  canStream: 'Câmera e tela',
  generate: 'Gerar link',
  generating: 'Gerando...',
  linkReady: 'Link pronto. Ele só aparece agora: copie e envie para a pessoa.',
  copy: 'Copiar link',
  newLink: 'Gerar outro link',
  activeTitle: 'Links ativos',
  noActive: 'Nenhum link ativo nesta call.',
  expiresIn: (left: string): string => `Termina em ${left}`,
  nobodyYet: 'Ninguém entrou ainda.',
  revoke: 'Revogar link',
  revokeHint: 'Revogar encerra o acesso de todos que entraram por ele.',
  remove: 'Expulsar',
  removed: 'Acesso encerrado',
  close: 'Fechar',
  // Quem recebe o link
  landingTitle: (inviter: string): string => `${inviter} convidou você para uma call`,
  landingPlace: (channel: string, server: string): string => `${channel} · ${server}`,
  landingRules: 'Você entra só nesta call, como visitante. Não vê os chats nem os outros canais.',
  landingPerms: (speak: boolean, stream: boolean): string => {
    if (speak && stream) return 'Você pode falar, ligar a câmera e transmitir a tela.'
    if (speak) return 'Você pode falar. Câmera e tela ficam desligadas.'
    if (stream) return 'Você pode ligar a câmera e transmitir a tela, mas não falar.'
    return 'Você pode ouvir e assistir às transmissões.'
  },
  nameLabel: 'Seu nome na call',
  namePlaceholder: 'Como querem te chamar?',
  nameHint: 'De 2 a 32 caracteres.',
  join: 'Entrar na call',
  joinAs: (name: string): string => `Entrar como ${name}`,
  joining: 'Entrando...',
  unavailableTitle: 'Link indisponível',
  unavailable: 'Este link não existe mais, foi revogado ou já expirou.',
  goHome: 'Ir para a Salinha',
  // Na call
  badge: 'Visitante',
  timeLeft: (left: string): string => `Acesso termina em ${left}`,
  volumes: 'Volume das pessoas',
  volumeOf: (name: string): string => `Volume de ${name}`,
  nobodyElse: 'Ninguém mais na call ainda.',
  leave: 'Sair da call',
  locked: 'A sala está trancada. Peça para alguém de dentro destrancar e tente de novo.',
  leftTitle: 'Você saiu da call',
  leftBody: 'Dá para voltar enquanto o seu acesso não terminar.',
  rejoin: 'Voltar para a call',
  endedTitle: 'Seu acesso terminou',
  ended: {
    expired: 'O tempo de acesso de visitante acabou.',
    revoked: 'O link de convite foi revogado.',
    removed: 'Você foi removido da call.'
  } as Record<string, string>,
  endedFallback: 'Seu acesso de visitante foi encerrado.'
}

/** Prazos que dá para escolher (os mesmos do servidor). */
export const DURATION_OPTIONS = [
  { value: '2h', label: '2 horas' },
  { value: '6h', label: '6 horas' },
  { value: '12h', label: '12 horas' },
  { value: '24h', label: '1 dia' }
] as const

export type GuestDuration = (typeof DURATION_OPTIONS)[number]['value']

/** Texto do botão de entrar: entrando, com a conta logada ou com o nome. */
export function joinButtonLabel(joining: boolean, accountName: string | null): string {
  if (joining) return GUEST_COPY.joining
  return accountName ? GUEST_COPY.joinAs(accountName) : GUEST_COPY.join
}
