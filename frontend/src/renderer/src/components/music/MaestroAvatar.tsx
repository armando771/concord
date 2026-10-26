import maestroGif from '../../assets/maestro.gif'

/** Avatar fixo do Maestro (GIF embutido no app, sem imagem no banco). */
function MaestroAvatar({ size = 36 }: { size?: number }): React.JSX.Element {
  return (
    <img
      src={maestroGif}
      alt=""
      draggable={false}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      className="shrink-0 rounded-full bg-accent object-cover shadow-md"
      aria-hidden="true"
    />
  )
}

export default MaestroAvatar
