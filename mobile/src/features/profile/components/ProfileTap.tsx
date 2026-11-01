import type { ReactNode } from 'react'
import { Pressable } from 'react-native'

/** Nome em texto tem uns 18 dp de altura: a folga leva a área de toque a 44 dp ou mais. */
const HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 } as const

interface ProfileTapProps {
  userId: string | undefined
  /** Texto lido pelo leitor de tela (o nome da pessoa). */
  label: string
  /** Sem ele (ou sem id), o conteúdo aparece como sempre, sem virar botão. */
  onOpen?: (userId: string) => void
  children: ReactNode
}

/** Faz do avatar ou do nome de uma pessoa um toque que abre o perfil dela. */
export function ProfileTap({ userId, label, onOpen, children }: ProfileTapProps) {
  if (!userId || !onOpen) return <>{children}</>
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={HIT_SLOP} onPress={() => onOpen(userId)}>
      {children}
    </Pressable>
  )
}
