import { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { mediaSrc } from '../lib/mediaUrl'
import { colors } from '../theme/tokens'

interface AvatarProps {
  name: string
  /** Foto (caminho relativo do servidor ou URL absoluta); sem ela, a inicial do nome. */
  uri?: string | null
  /** Lado em dp. */
  size: number
  /** Ícone de servidor é quadrado arredondado em vez de círculo. */
  square?: boolean
}

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?'

export function Avatar({ name, uri, size, square = false }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const src = mediaSrc(uri)
  const radius = square ? size * 0.3 : size / 2
  const box = { width: size, height: size, borderRadius: radius }

  if (src && !failed) {
    return (
      <Image
        accessibilityLabel={`Foto de ${name}`}
        source={{ uri: src }}
        onError={() => setFailed(true)}
        style={[styles.image, box]}
      />
    )
  }
  return (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initialOf(name)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.bgAccent },
  fallback: { backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontWeight: '700' }
})
