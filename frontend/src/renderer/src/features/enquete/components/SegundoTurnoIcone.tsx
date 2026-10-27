/** O "L" do botão na barra lateral; a cor vem de `className` (como nos ícones). */
function SegundoTurnoIcone({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center text-xl font-black leading-none ${className}`}
    >
      L
    </span>
  )
}

export default SegundoTurnoIcone
