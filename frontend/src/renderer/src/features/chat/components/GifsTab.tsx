import type { GiphyItem } from '../api/giphy'

/** Aba "GIFs" do seletor de mídia (a busca fica no useGifSearch). */
export default function GifsTab({
  gifs,
  loading,
  onSelect
}: {
  gifs: GiphyItem[]
  loading: boolean
  onSelect: (gif: GiphyItem) => void
}): React.JSX.Element {
  if (loading || gifs.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-gray-500">
        {loading ? 'Carregando GIFs...' : 'Nenhum GIF encontrado.'}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {gifs.map((gif) => (
        <button
          key={gif.id}
          type="button"
          title={gif.title}
          onClick={() => onSelect(gif)}
          className="group relative h-28 overflow-hidden rounded-xl bg-white/5 transition-transform hover:scale-102 cursor-pointer"
        >
          <img
            src={gif.preview_url || gif.url}
            alt={gif.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </button>
      ))}
    </div>
  )
}
