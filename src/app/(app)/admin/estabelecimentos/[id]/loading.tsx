import {
  HeaderSkeleton,
  LoadingAnnouncement,
  FormSkeleton,
} from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncement />
      <HeaderSkeleton />
      <FormSkeleton fields={7} />
    </>
  );
}
