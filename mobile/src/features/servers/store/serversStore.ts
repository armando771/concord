import { create } from 'zustand'
import { listChannels, type Channel } from '../api/channels'
import { listServers, type Server } from '../api/servers'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ServersState {
  servers: Server[]
  status: Status
  channelsByServer: Record<string, Channel[]>
  /** Servidores cuja lista de canais falhou ao carregar (a tela oferece tentar de novo). */
  channelsError: Record<string, boolean>
  load: () => Promise<void>
  loadChannels: (serverId: string) => Promise<void>
  reset: () => void
}

const empty = (): Pick<ServersState, 'servers' | 'status' | 'channelsByServer' | 'channelsError'> => ({
  servers: [],
  status: 'idle',
  channelsByServer: {},
  channelsError: {}
})

export const useServersStore = create<ServersState>()((set) => ({
  ...empty(),
  load: async () => {
    set({ status: 'loading' })
    try {
      set({ servers: await listServers(), status: 'ready' })
    } catch {
      set({ status: 'error' })
    }
  },
  loadChannels: async (serverId) => {
    try {
      const channels = await listChannels(serverId)
      set((s) => ({
        channelsByServer: { ...s.channelsByServer, [serverId]: channels },
        channelsError: { ...s.channelsError, [serverId]: false }
      }))
    } catch {
      set((s) => ({
        channelsByServer: { ...s.channelsByServer, [serverId]: s.channelsByServer[serverId] ?? [] },
        channelsError: { ...s.channelsError, [serverId]: true }
      }))
    }
  },
  reset: () => set(empty())
}))
