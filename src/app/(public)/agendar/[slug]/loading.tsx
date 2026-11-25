import { Skeleton } from "@/components/ui/skeleton";
import { LoadingAnnouncement } from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
      <LoadingAnnouncement />
      <Skeleton className="aspect-[16/7] w-full rounded-none" />
      <div className="flex flex-col gap-3 px-4">
        <Skeleton className="-mt-14 size-20 rounded-2xl" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
