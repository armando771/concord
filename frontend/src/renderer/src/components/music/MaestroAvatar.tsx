/** Avatar fixo do Maestro (sem imagem no banco). */
function MaestroAvatar({ size = 36 }: { size?: number }): React.JSX.Element {
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md"
      aria-hidden="true"
    >
      🎻
    </div>
  )
}

export default MaestroAvatar
