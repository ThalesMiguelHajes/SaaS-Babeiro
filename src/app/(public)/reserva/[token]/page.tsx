import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";

import { publicEnv } from "@/lib/env";
import { BookingManage } from "@/modules/booking/components/booking-manage";
import { BrandScope } from "@/modules/booking/components/brand-scope";
import { getBookingByToken } from "@/modules/booking/queries.server";

// Link com token privado: nunca indexar (cabeçalhos em next.config.ts também).
export const metadata: Metadata = {
  title: "Seu agendamento",
  robots: { index: false, follow: false },
};

export default async function BookingTokenPage({
  params,
  searchParams,
}: PageProps<"/reserva/[token]">) {
  const { token } = await params;
  const { nova } = await searchParams;
  const booking = await getBookingByToken(token);

  if (!booking) {
    return (
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <LinkIcon className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Confira se o link foi copiado inteiro. Se o atendimento já passou há mais de 30 dias, o
          link deixa de funcionar. Em caso de dúvida, fale com o estabelecimento.
        </p>
      </main>
    );
  }

  return (
    <BrandScope color={booking.establishment.accent_color}>
      <main className="flex flex-col">
        <BookingManage
          booking={booking}
          token={token}
          isNew={nova === "1"}
          url={`${publicEnv.NEXT_PUBLIC_APP_URL}/reserva/${token}`}
        />
      </main>
    </BrandScope>
  );
}
