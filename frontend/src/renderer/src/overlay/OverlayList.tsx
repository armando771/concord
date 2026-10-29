import {
  overlayRowOpacity,
  type OverlayMember,
  type OverlaySnapshot
} from '../features/overlay/lib/overlayState'
import VoiceStateIcons from '../features/call/components/VoiceStateIcons'
import OverlayAvatar from './OverlayAvatar'
import { OverlayViewers, OverlayWatchingEye } from './OverlayViewers'

/** Opacidade na pílula (não na janela nem na lista): quem fala se destaca dos outros. */
function rowStyle(resting: number, speaking: boolean): React.CSSProperties {
  return { opacity: overlayRowOpacity(resting, speaking) / 100 }
}

/** Uma pessoa da call: avatar + nome + mic/fone cortados (estilo Discord) + olho de quem assiste. */
function OverlayPill({
  member,
  opacity
}: {
  member: OverlayMember
  opacity: number
}): React.JSX.Element {
  return (
    <div
      className="flex w-fit max-w-[240px] items-center gap-2 rounded-full bg-floating/85 py-1 pl-1 pr-3 transition-opacity duration-150"
      style={rowStyle(opacity, member.speaking)}
    >
      <OverlayAvatar member={member} />
      <span
        className={`truncate text-sm ${
          member.speaking ? 'font-bold text-strong' : 'font-medium text-gray-200'
        }`}
      >
        {member.name}
      </span>
      {member.self && <span className="shrink-0 text-[10px] uppercase text-gray-400">você</span>}
      <VoiceStateIcons muted={member.muted} deafened={member.deafened} />
      <OverlayWatchingEye watching={member.watchingMe} />
    </div>
  )
}

/** A lista do overlay: pílulas, "+N" e o selo de espectadores da minha live. */
function OverlayList({ snapshot }: { snapshot: OverlaySnapshot }): React.JSX.Element {
  return (
    <>
      {snapshot.members.map((m) => (
        <OverlayPill key={m.id} member={m} opacity={snapshot.opacity} />
      ))}
      {snapshot.more > 0 && (
        <div
          className="w-fit rounded-full bg-floating/85 px-3 py-1 text-sm font-medium text-gray-200"
          style={rowStyle(snapshot.opacity, false)}
        >
          +{snapshot.more}
        </div>
      )}
      <OverlayViewers viewers={snapshot.viewers} opacity={snapshot.opacity} />
    </>
  )
}

export default OverlayList
