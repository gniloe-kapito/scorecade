import { Skeleton } from "@/components/ui/skeleton";

const shimmer = "shimmer";

export function CoverCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className={`aspect-[2/3] w-full rounded-xl ${shimmer}`} />
      <Skeleton className={`h-3 w-4/5 ${shimmer}`} />
    </div>
  );
}

export function CoverGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CoverCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CoverRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-32 shrink-0 space-y-2 md:w-36">
          <Skeleton className={`aspect-[2/3] w-full rounded-xl ${shimmer}`} />
          <Skeleton className={`h-3 w-4/5 ${shimmer}`} />
        </div>
      ))}
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className={`h-12 w-8 rounded-md ${shimmer}`} />
      <div className="flex-1 space-y-2">
        <Skeleton className={`h-4 w-1/2 ${shimmer}`} />
        <Skeleton className={`h-3 w-1/4 ${shimmer}`} />
      </div>
      <Skeleton className={`h-9 w-9 rounded-lg ${shimmer}`} />
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function CapsuleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Skeleton className={`aspect-[460/215] w-full rounded-none ${shimmer}`} />
      <div className="space-y-2 p-2.5">
        <Skeleton className={`h-3.5 w-4/5 ${shimmer}`} />
        <Skeleton className={`h-2.5 w-1/2 ${shimmer}`} />
      </div>
    </div>
  );
}

export function CapsuleGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CapsuleCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function GamePageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 flex gap-4">
        <Skeleton className="h-[168px] w-28 shrink-0 rounded-xl md:h-[210px] md:w-40" />
        <div className="flex-1 space-y-3 self-end pb-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="mt-4 h-24 w-full rounded-xl" />
    </div>
  );
}
