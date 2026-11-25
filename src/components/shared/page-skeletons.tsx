import { Skeleton } from "@/components/ui/skeleton";

/** Esqueletos exibidos instantaneamente enquanto a página carrega (loading.tsx). */

export function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="hidden h-8 w-44 sm:block" />}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border" aria-hidden>
      <div className="flex gap-4 border-b bg-muted/30 px-3 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b px-3 py-3.5 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={c === 0 ? "h-4 flex-[2]" : "h-4 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="flex max-w-3xl flex-col gap-5" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Texto para leitores de tela durante o carregamento. */
export function LoadingAnnouncement() {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      Carregando…
    </p>
  );
}
