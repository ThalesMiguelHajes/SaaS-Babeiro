import {
  HeaderSkeleton,
  LoadingAnnouncement,
  TableSkeleton,
} from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncement />
      <HeaderSkeleton withAction={false} />
      <TableSkeleton rows={10} />
    </>
  );
}
