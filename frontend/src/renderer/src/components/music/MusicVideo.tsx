import type { MusicItem } from '../../api/music'

// Stub da Task 15: só a capa. A Task 15 troca por vídeo sincronizado.
function MusicVideo({
  item
}: {
  serverId: string
  item: MusicItem
  startedAt: number
}): React.JSX.Element {
  return <img src={item.thumbnail} className="aspect-video w-full rounded-lg object-cover" alt="" />
}

export default MusicVideo
