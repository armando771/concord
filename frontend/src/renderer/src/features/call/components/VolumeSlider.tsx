/** Volume de 0 a 150%: 100% é o normal; acima disso é boost (em amarelo). */
function VolumeSlider({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (volume: number) => void
}): React.JSX.Element {
  const percent = Math.round(value * 100)
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-ds-sm font-medium text-gray-400">
        {label}
        <span className={percent > 100 ? 'text-warning' : 'text-strong'}>{percent}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={150}
        step={1}
        value={percent}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full cursor-pointer accent-brand"
      />
    </label>
  )
}

export default VolumeSlider
