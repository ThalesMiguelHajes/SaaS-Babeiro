import { MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { publicEnv } from "@/lib/env";
import { publicAssetUrl } from "@/lib/storage";
import { BookingFlow } from "@/modules/booking/components/booking-flow";
import { BrandScope } from "@/modules/booking/components/brand-scope";
import { EstablishmentHeader } from "@/modules/booking/components/establishment-header";
import { getBookingPage } from "@/modules/booking/queries.server";

export async function generateMetadata({
  params,
}: PageProps<"/agendar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getBookingPage(slug);
  if (!page) return { title: "Página não encontrada" };
  const e = page.establishment;
  const image = publicAssetUrl(e.cover_path) ?? publicAssetUrl(e.logo_path);
  const description = e.description ?? `Agende seu horário em ${e.name}.`;
  return {
    title: `Agendar em ${e.name}`,
    description,
    alternates: { canonical: `${publicEnv.NEXT_PUBLIC_APP_URL}/agendar/${e.slug}` },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title: `Agende em ${e.name}`,
      description,
      url: `${publicEnv.NEXT_PUBLIC_APP_URL}/agendar/${e.slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}

export default async function PublicBookingPage({ params }: PageProps<"/agendar/[slug]">) {
  const { slug } = await params;
  const page = await getBookingPage(slug);
  if (!page) notFound();
  const e = page.establishment;

  return (
    <BrandScope color={e.accent_color}>
      <EstablishmentHeader page={page} />
      <div className="mt-6 flex flex-col gap-6">
        {e.booking_enabled ? (
          <Suspense fallback={null}>
            <BookingFlow page={page} />
          </Suspense>
        ) : (
          <div className="mx-4 flex flex-col gap-3 rounded-xl border p-4 text-sm" role="status">
            <p className="font-medium">O agendamento online está indisponível no momento.</p>
            {e.whatsapp_e164 && (
              <a
                href={`https://wa.me/${e.whatsapp_e164.replace(/^\+/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 font-medium text-[var(--brand-foreground)]"
              >
                <MessageCircleIcon className="size-4" aria-hidden />
                Falar pelo WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
      <footer className="mt-auto px-4 pt-10 text-center text-xs text-muted-foreground">
        Agendamento online por {publicEnv.NEXT_PUBLIC_APP_NAME}
      </footer>
    </BrandScope>
  );
}
