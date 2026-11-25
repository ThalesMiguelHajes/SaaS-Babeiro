import { AtSignIcon, ClockIcon, MapPinIcon, MessageCircleIcon } from "lucide-react";

import { publicAssetUrl } from "@/lib/storage";
import { WEEKDAYS, describeIntervals } from "@/modules/schedules/rules";

import { formatAddress, mapsLink } from "../rules";
import type { BookingPage } from "../types";

/** Vitrine do estabelecimento: capa, logo, nome, contatos e horário de funcionamento. */
export function EstablishmentHeader({ page }: { page: BookingPage }) {
  const e = page.establishment;
  const cover = publicAssetUrl(e.cover_path);
  const logo = publicAssetUrl(e.logo_path);
  const address = formatAddress(e);
  const initials = e.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <header className="flex flex-col">
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-[var(--brand)] sm:rounded-b-2xl">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- sem otimização da Vercel (cota do Hobby)
          <img src={cover} alt="" className="size-full object-cover" />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
          aria-hidden
        />
      </div>
      <div className="relative z-10 -mt-10 flex flex-col gap-3 px-4">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-[var(--brand)] text-2xl font-semibold text-[var(--brand-foreground)] shadow-sm">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- idem
            <img src={logo} alt={`Logo de ${e.name}`} className="size-full object-cover" />
          ) : (
            <span aria-hidden>{initials}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{e.name}</h1>
          {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {address && (
            <li>
              <a
                href={mapsLink(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 hover:bg-muted"
              >
                <MapPinIcon className="size-4" aria-hidden />
                {address}
              </a>
            </li>
          )}
          {e.whatsapp_e164 && (
            <li>
              <a
                href={`https://wa.me/${e.whatsapp_e164.replace(/^\+/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 hover:bg-muted"
              >
                <MessageCircleIcon className="size-4" aria-hidden />
                WhatsApp
              </a>
            </li>
          )}
          {e.instagram_handle && (
            <li>
              <a
                href={`https://instagram.com/${e.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 hover:bg-muted"
              >
                <AtSignIcon className="size-4" aria-hidden />@{e.instagram_handle.replace(/^@/, "")}
              </a>
            </li>
          )}
        </ul>
        {page.hours.length > 0 && (
          <details className="group rounded-lg border px-3 py-2 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
              <ClockIcon className="size-4" aria-hidden />
              Horário de funcionamento
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {WEEKDAYS.map((d) => (
                <div key={d.value} className="contents">
                  <dt className="text-muted-foreground">{d.label}</dt>
                  <dd>
                    {describeIntervals(
                      page.hours
                        .filter((h) => h.weekday === d.value)
                        .map((h) => ({ start: h.start, end: h.end })),
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </header>
  );
}
