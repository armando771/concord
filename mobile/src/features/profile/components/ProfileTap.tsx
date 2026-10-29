import type { ReactNode } from 'react'
import { Pressable } from 'react-native'

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
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={() => onOpen(userId)}>
      {children}
    </Pressable>
  )
}
