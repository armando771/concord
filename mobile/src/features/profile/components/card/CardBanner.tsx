import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { colors } from '../../../../shared/theme/tokens'
import { profileMediaSrc } from '../../lib/profileMedia'

export const BANNER_HEIGHT = 108

const COLOR = /^#[0-9a-f]{6}$/i

interface CardBannerProps {
  url?: string | null
  color?: string | null
}

/** Faixa do topo do cartão: a imagem (GIF anima), senão a cor escolhida, senão a cor da marca. */
export function CardBanner({ url, color }: CardBannerProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const src = failedUrl === url ? null : profileMediaSrc(url)
  if (src) {
    return (
      <Image
        testID="card-banner-image"
        accessible={false}
        source={{ uri: src }}
        resizeMode="cover"
        onError={() => setFailedUrl(url ?? null)}
        style={styles.banner}
      />
    )
  }
  const backgroundColor = color && COLOR.test(color) ? color : colors.brand
  return <View testID="card-banner-color" style={[styles.banner, { backgroundColor }]} />
}

const styles = StyleSheet.create({
  banner: { width: '100%', height: BANNER_HEIGHT }
})
