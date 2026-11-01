/** Selo vermelho de quem está transmitindo (lista do canal de voz). */
function LiveBadge(): React.JSX.Element {
  return (
    <span className="rounded bg-danger-strong px-1 text-[9px] font-bold leading-4 tracking-wide text-white">
      LIVE
    </span>
  )
}

export default LiveBadge
