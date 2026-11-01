/** O cartão centralizado das telas do link de visitante (como o do convite de servidor). */
function GuestCard({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto bg-tertiary p-4">
      <div className="relative w-full max-w-[480px] rounded-2xl border border-subtle bg-modal p-6 text-center shadow-2xl shadow-black/60 sm:p-8">
        {children}
      </div>
    </div>
  )
}

export default GuestCard
