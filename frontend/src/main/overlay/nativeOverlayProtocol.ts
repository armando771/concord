import type { OverlayMember, OverlaySnapshot } from '../../renderer/src/features/overlay/lib/overlayState'
import {
  normalizeOverlayLayout,
  type OverlayLayout
} from '../../renderer/src/features/overlay/lib/overlayLayout'
import {
  normalizeOverlayShortcut,
  overlayEditHint
} from '../../renderer/src/features/overlay/lib/overlayShortcut'
import type { Foreground } from './overlayPolicy'

// Protocolo do overlay nativo (`concord-audio.exe overlay`): uma mensagem JSON
// por linha. Contrato completo em docs/overlay-nativo.md; o lado Rust fica em
// native/concord-audio/src/overlay/protocol.rs.

/** Etiqueta do próprio usuário (a página mostra "você" em caixa alta). */
const SELF_TAG = 'você'.toLocaleUpperCase('pt-BR')

/** Fora da tela: sempre a mesma linha (o envio repetido é cortado antes). */
export const NATIVE_HIDDEN_LINE = '{"type":"state","visible":false}'

/** Arquivo local do avatar: caminho, null (falhou) ou undefined (baixando). */
export type AvatarPath = (url: string) => string | null | undefined

export interface NativeOverlayView {
  snapshot: OverlaySnapshot | null
  foreground: Foreground
  visible: boolean
  editing: boolean
  avatarPath: AvatarPath
}

/**
 * Avatar a mandar: o GIF inteiro se anima (o helper mostra o primeiro quadro
 * para quem não fala, como o "/static"); se o GIF falhou, a imagem parada;
 * baixando, a inicial por enquanto.
 */
export function nativeMemberAvatar(
  member: Pick<OverlayMember, 'avatarUrl' | 'avatarAnimatedUrl'>,
  avatarPath: AvatarPath
): { avatar: string | null; animated: boolean } {
  if (member.avatarAnimatedUrl) {
    const path = avatarPath(member.avatarAnimatedUrl)
    if (path) return { avatar: path, animated: true }
    if (path === undefined) return { avatar: null, animated: false }
  }
  const path = member.avatarUrl ? avatarPath(member.avatarUrl) : null
  return { avatar: path ?? null, animated: false }
}

function nativeMember(member: OverlayMember, avatarPath: AvatarPath): Record<string, unknown> {
  return {
    id: member.id,
    name: member.name,
    initial: member.initial,
    ...nativeMemberAvatar(member, avatarPath),
    tag: member.self ? SELF_TAG : null,
    muted: member.muted,
    deafened: member.deafened,
    speaking: member.speaking,
    watching: member.watchingMe
  }
}

/** Linha de estado para o stdin do helper. */
export function nativeStateLine(view: NativeOverlayView): string {
  const { snapshot, foreground } = view
  if (!view.visible || !foreground || !snapshot?.inCall) return NATIVE_HIDDEN_LINE
  const shortcut = normalizeOverlayShortcut(snapshot.shortcut)
  return JSON.stringify({
    type: 'state',
    visible: true,
    editing: view.editing,
    game: foreground.pid,
    monitor: foreground.monitor,
    opacity: snapshot.opacity,
    layout: normalizeOverlayLayout(snapshot.layout),
    hint: view.editing ? overlayEditHint(shortcut) : '',
    theme: snapshot.theme ?? undefined,
    members: snapshot.members.map((m) => nativeMember(m, view.avatarPath)),
    more: snapshot.more,
    viewers: snapshot.viewers ?? null
  })
}

export type NativeOverlayEvent =
  | { type: 'ready' }
  | { type: 'layout'; layout: OverlayLayout }
  | { type: 'error'; message: string }

/** Linha do stdout do helper → evento; null = o que esta versão não entende. */
export function parseNativeOverlayEvent(line: string): NativeOverlayEvent | null {
  let data: { type?: unknown; layout?: unknown; message?: unknown } | null
  try {
    data = JSON.parse(line.replace(/\r$/, ''))
  } catch {
    return null
  }
  switch (data?.type) {
    case 'ready':
      return { type: 'ready' }
    case 'layout':
      return { type: 'layout', layout: normalizeOverlayLayout(data.layout) }
    case 'error':
      return { type: 'error', message: typeof data.message === 'string' ? data.message : '' }
    default:
      return null
  }
}
