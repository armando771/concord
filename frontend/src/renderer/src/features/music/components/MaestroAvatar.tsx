import MaestroImage from './MaestroImage'

/** Avatar fixo do Maestro (GIF embutido no app, sem imagem no banco). */
function MaestroAvatar({ size = 36 }: { size?: number }): React.JSX.Element {
  return (
    <MaestroImage
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-accent object-cover shadow-md"
    />
  )
}

export default MaestroAvatar
