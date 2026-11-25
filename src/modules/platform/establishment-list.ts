import { z } from "zod";

import { Constants } from "@/types/database";

export const PAGE_SIZE = 20;

export const listFilters = z.object({
  q: z.string().trim().max(120).catch(""),
  status: z.enum(Constants.public.Enums.establishment_status).optional().catch(undefined),
  pagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(Math.floor(2147483647 / PAGE_SIZE))
    .catch(1),
});

export type ListFilters = z.infer<typeof listFilters>;

export function listUrl({ q, status, pagina }: ListFilters) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (pagina > 1) query.set("pagina", String(pagina));
  return "/admin/estabelecimentos" + (query.size ? "?" + query.toString() : "");
}
