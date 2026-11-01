import { StyleSheet, View } from 'react-native'
import { PresenceDot } from '../../../friends/components/PresenceDot'
import type { PresenceStatus } from '../../../friends/lib/presenceStatus'
import { Avatar } from '../../../../shared/ui/Avatar'

const SIZE = 88
const RING = 6

interface CardAvatarProps {
  name: string
  uri?: string | null
  /** Sem status conhecido, sem bolinha. */
  status?: PresenceStatus
  /** Cor do fundo do cartão: o anel e o recorte da bolinha "furam" o banner com ela. */
  cutout: string
}

/** Avatar grande sobre o banner, com anel na cor do fundo e a bolinha de presença (GIF anima aqui). */
export function CardAvatar({ name, uri, status, cutout }: CardAvatarProps) {
  return (
    <View style={[styles.ring, { borderColor: cutout }]}>
      <Avatar name={name} uri={uri} size={SIZE} animated />
      {status ? (
        <View style={styles.dot}>
          <PresenceDot status={status} cutout={cutout} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  ring: { alignSelf: 'flex-start', borderWidth: RING, borderRadius: (SIZE + RING * 2) / 2 },
  dot: { position: 'absolute', right: -2, bottom: -2 }
})
