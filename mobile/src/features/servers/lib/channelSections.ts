import type { Channel, ChannelType } from '../api/channels'

export interface ChannelSection {
  kind: ChannelType
  title: string
  channels: Channel[]
}

const TITLES: Record<ChannelType, string> = { text: 'Canais de texto', voice: 'Canais de voz' }

/** Separa texto e voz, mantendo a ordem do servidor (`position`); seção vazia some. */
export function channelSections(channels: Channel[]): ChannelSection[] {
  return (['text', 'voice'] as const)
    .map((kind) => ({
      kind,
      title: TITLES[kind],
      channels: channels.filter((c) => c.type === kind).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }))
    .filter((section) => section.channels.length > 0)
}
