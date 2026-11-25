import { publicEnv } from "@/lib/env";

export const ESTABLISHMENT_ASSETS_BUCKET = "establishment-assets";

/** URL pública de um arquivo do bucket de imagens dos estabelecimentos. */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${ESTABLISHMENT_ASSETS_BUCKET}/${encoded}`;
}
