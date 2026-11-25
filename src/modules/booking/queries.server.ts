import "server-only";

import { cache } from "react";

import { clientIpHash } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

import { bookingTokenSchema } from "./schemas";
import type { BookingPage, PublicBooking } from "./types";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

/**
 * Página pública do estabelecimento (RPC executável só pela service_role, com DTO mínimo).
 * Em cache por requisição: usada pela página e pelos metadados de compartilhamento.
 */
export const getBookingPage = cache(async (slug: string): Promise<BookingPage | null> => {
  const normalized = slug.toLowerCase();
  if (!SLUG.test(normalized)) return null;
  const { data, error } = await createAdminClient().rpc("public_get_booking_page", {
    p_slug: normalized,
  });
  if (error || !data) return null;
  return data as unknown as BookingPage;
});

/** Reserva pelo token do link enviado ao cliente. Null se inválido, expirado ou limitado. */
export const getBookingByToken = cache(async (token: string): Promise<PublicBooking | null> => {
  if (!bookingTokenSchema.safeParse(token).success) return null;
  const { data, error } = await createAdminClient().rpc("public_get_booking", {
    p_token: token,
    p_ip_hash: (await clientIpHash()) as string,
  });
  if (error || !data) return null;
  return data as unknown as PublicBooking;
});
