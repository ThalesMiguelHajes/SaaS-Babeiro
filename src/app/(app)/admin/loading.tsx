import {
  HeaderSkeleton,
  LoadingAnnouncement,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncement />
      <HeaderSkeleton />
      <StatCardsSkeleton />
      <TableSkeleton rows={6} />
    </>
  );
}
