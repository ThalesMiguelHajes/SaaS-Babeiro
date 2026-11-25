import {
  FormSkeleton,
  HeaderSkeleton,
  LoadingAnnouncement,
} from "@/components/shared/page-skeletons";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncement />
      <HeaderSkeleton withAction={false} />
      <FormSkeleton fields={6} />
    </>
  );
}
