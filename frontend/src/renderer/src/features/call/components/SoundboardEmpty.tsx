/** Mesa sem nada para mostrar: servidor sem sons ou busca sem resultado. */
export default function SoundboardEmpty({
  searching,
  canAdd
}: {
  /** Há sons, mas a busca não achou nenhum. */
  searching: boolean
  canAdd: boolean
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-subtle py-8 text-center">
      <p className="text-xs font-medium text-gray-300">
        {searching ? 'Nenhum som encontrado para essa busca.' : 'Nenhum som neste servidor ainda.'}
      </p>
      {!searching && canAdd && (
        <p className="mt-1 text-[11px] text-gray-500">
          Clique em &ldquo;Adicionar som&rdquo; para enviar um áudio de até 15s (5 MB).
        </p>
      )}
    </div>
  )
}
