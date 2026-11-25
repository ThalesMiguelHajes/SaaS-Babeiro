import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Carregando estabelecimentos</span>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
