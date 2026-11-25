import {
  HeaderSkeleton,
  LoadingAnnouncement,
  TableSkeleton,
} from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncement />
      <HeaderSkeleton />
      <TableSkeleton rows={8} columns={5} />
    </>
  );
}
