import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { UserPanel } from '../../profile/components/UserPanel'
import type { Channel } from '../api/channels'
import { useSelectedServerStore } from '../store/selectedServerStore'
import { useServersStore } from '../store/serversStore'
import { ChannelList } from './ChannelList'
import { ServerRail } from './ServerRail'

interface HomeScreenProps {
  onOpenChannel: (channel: Channel) => void
  onOpenSettings: () => void
}

/** Tela principal: trilho de servidores, lista de canais (ou DMs) e o painel do usuário. */
export function HomeScreen({ onOpenChannel, onOpenSettings }: HomeScreenProps) {
  const servers = useServersStore((s) => s.servers)
  const status = useServersStore((s) => s.status)
  const channelsByServer = useServersStore((s) => s.channelsByServer)
  const channelsError = useServersStore((s) => s.channelsError)
  const load = useServersStore((s) => s.load)
  const loadChannels = useServersStore((s) => s.loadChannels)
  const serverId = useSelectedServerStore((s) => s.serverId)
  const select = useSelectedServerStore((s) => s.select)
  const ensureSelection = useSelectedServerStore((s) => s.ensureSelection)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    ensureSelection(servers.map((server) => server.id))
  }, [servers, ensureSelection])

  const needsChannels = serverId !== null && channelsByServer[serverId] === undefined
  useEffect(() => {
    if (serverId && needsChannels) void loadChannels(serverId)
  }, [serverId, needsChannels, loadChannels])

  const server = servers.find((s) => s.id === serverId)

  return (
    <View style={styles.screen}>
      <View style={styles.columns}>
        <ServerRail servers={servers} selectedId={serverId} onSelect={select} />
        <View style={styles.main}>
          {status === 'error' && servers.length === 0 ? (
            <View style={styles.centered}>
              <Banner message="Não foi possível carregar os servidores." />
              <Button title="Tentar de novo" onPress={() => void load()} variant="secondary" />
            </View>
          ) : server ? (
            <ChannelList
              serverName={server.name}
              channels={channelsByServer[server.id] ?? []}
              error={channelsError[server.id] === true}
              onOpenChannel={onOpenChannel}
              onRetry={() => void loadChannels(server.id)}
            />
          ) : (
            <View style={styles.centered}>
              <Text style={styles.soon}>Mensagens diretas: em breve</Text>
            </View>
          )}
        </View>
      </View>
      <UserPanel onOpenSettings={onOpenSettings} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgTertiary },
  columns: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bgPrimary },
  soon: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' }
})
