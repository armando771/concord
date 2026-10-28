import { Skeleton, SkeletonRegion } from '../../../shared/ui/skeleton/Skeleton'

export function RankingSkeleton({ rows = 8 }: { rows?: number }): React.JSX.Element {
  return (
    <SkeletonRegion label="Carregando o ranking…" className="flex flex-col gap-3">
      <div className="flex items-end gap-3 pb-2">
        {['h-16', 'h-24', 'h-12'].map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton circle className="size-14" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className={`w-full ${h}`} />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3">
          <Skeleton className="h-3 w-8" />
          <Skeleton circle className="size-9" />
          <Skeleton className="h-3 w-32 flex-1" />
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </SkeletonRegion>
  )
}
