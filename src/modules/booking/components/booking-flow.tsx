"use client";

import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { formatInTimeZone } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { publicAssetUrl } from "@/lib/storage";

import { createBookingAction } from "../actions";
import {
  ANY_PROFESSIONAL,
  currentStep,
  formatDuration,
  parseSelection,
  toProfessionalParam,
  type BookingSelection,
} from "../rules";
import type { BookingPage, PublicProfessional } from "../types";
import { CustomerForm, type CustomerSubmit } from "./customer-form";
import { DateTimePicker } from "./date-time-picker";

const STEP_TITLES = {
  service: "Escolha o serviço",
  professional: "Escolha o profissional",
  datetime: "Escolha o dia e o horário",
  details: "Seus dados",
} as const;

const STEP_NUMBER = { service: 1, professional: 2, datetime: 3, details: 4 } as const;

function Avatar({ pro, size = 48 }: { pro: PublicProfessional; size?: number }) {
  const photo = publicAssetUrl(pro.photo_path);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- sem otimização da Vercel (cota do Hobby)
        <img src={photo} alt="" className="size-full object-cover" />
      ) : (
        pro.display_name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** Fluxo de agendamento em etapas, com o estado na URL (botão voltar do navegador funciona). */
export function BookingFlow({ page }: { page: BookingPage }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selection = parseSelection(new URLSearchParams(params.toString()));
  const tz = page.establishment.timezone;
  const [reloadKey, setReloadKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const service = page.services.find((s) => s.id === selection.serviceId) ?? null;
  const professionalsForService = service
    ? page.professionals.filter((p) => p.service_ids.includes(service.id))
    : [];
  const professional = page.professionals.find((p) => p.id === selection.professionalId) ?? null;
  // Seleção inválida (serviço/profissional que não existe mais) volta ao passo correspondente.
  const effective: BookingSelection = {
    ...selection,
    serviceId: service ? selection.serviceId : null,
    professionalId:
      service && (selection.professionalId === ANY_PROFESSIONAL || professional)
        ? selection.professionalId
        : null,
  };
  const step = currentStep(effective);

  function go(next: Partial<BookingSelection>, replace = false) {
    const merged = { ...effective, ...next };
    const q = new URLSearchParams();
    if (merged.serviceId) q.set("servico", merged.serviceId);
    if (merged.professionalId) q.set("profissional", merged.professionalId);
    if (merged.date) q.set("data", merged.date);
    if (merged.startsAt) q.set("horario", merged.startsAt);
    const url = `${pathname}${q.size ? `?${q}` : ""}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }

  function back() {
    if (step === "details") go({ startsAt: null });
    else if (step === "datetime") go({ professionalId: null, date: null, startsAt: null });
    else go({ serviceId: null, professionalId: null, date: null, startsAt: null });
  }

  function submit(data: CustomerSubmit) {
    if (!service || !effective.startsAt) return;
    setFormError(null);
    startTransition(async () => {
      const result = await createBookingAction(page.establishment.slug, {
        ...data,
        serviceId: service.id,
        professionalId: toProfessionalParam(effective.professionalId),
        startsAt: effective.startsAt!,
      });
      if (!result.ok) {
        if (
          result.error.code === "SLOT_UNAVAILABLE" ||
          result.error.code === "OUTSIDE_BOOKING_WINDOW"
        ) {
          toast.error("Esse horário acabou de ser reservado. Escolha outro.");
          setReloadKey((k) => k + 1);
          go({ startsAt: null });
          return;
        }
        setFormError(result.error.message);
        return;
      }
      router.push(`/reserva/${result.data.token}?nova=1`);
    });
  }

  const categories = [
    ...page.categories.map((c) => ({
      id: c.id,
      name: c.name,
      services: page.services.filter((s) => s.category_id === c.id),
    })),
    {
      id: "none",
      name: page.categories.length ? "Outros" : "",
      services: page.services.filter(
        (s) => !s.category_id || !page.categories.some((c) => c.id === s.category_id),
      ),
    },
  ].filter((c) => c.services.length > 0);

  return (
    <section className="flex flex-col gap-4 px-4" aria-labelledby="booking-step-title">
      <div className="flex items-center gap-2">
        {step !== "service" && (
          <button
            type="button"
            onClick={back}
            className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Voltar"
          >
            <ChevronLeftIcon className="size-5" aria-hidden />
          </button>
        )}
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Passo {STEP_NUMBER[step]} de 4</span>
          <h2 id="booking-step-title" className="text-lg font-semibold">
            {STEP_TITLES[step]}
          </h2>
        </div>
      </div>

      {step !== "service" && service && (
        <div className="flex flex-col gap-1 rounded-xl bg-muted/60 p-3 text-sm">
          <span className="font-medium">
            {service.name} · {formatDuration(service.duration_minutes)} ·{" "}
            {formatCents(service.price_cents)}
          </span>
          {step !== "professional" && (
            <span className="text-muted-foreground">
              {professional ? `com ${professional.display_name}` : "com qualquer profissional"}
            </span>
          )}
          {effective.startsAt && (
            <span className="font-medium first-letter:uppercase">
              {formatInTimeZone(effective.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm", tz)}
            </span>
          )}
        </div>
      )}

      {step === "service" &&
        (page.services.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum serviço disponível para agendamento online no momento.
          </p>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              {c.name && <h3 className="text-sm font-medium text-muted-foreground">{c.name}</h3>}
              <ul className="flex flex-col gap-2">
                {c.services.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const pros = page.professionals.filter((p) => p.service_ids.includes(s.id));
                        // Um único profissional: pula a escolha.
                        go({
                          serviceId: s.id,
                          professionalId: pros.length === 1 ? pros[0]!.id : null,
                          date: null,
                          startsAt: null,
                        });
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted"
                    >
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="font-medium">{s.name}</span>
                        {s.description && (
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {s.description}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {formatDuration(s.duration_minutes)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCents(s.price_cents)}
                      </span>
                      <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ))}

      {step === "professional" && (
        <ul className="flex flex-col gap-2">
          <li>
            <button
              type="button"
              onClick={() => go({ professionalId: ANY_PROFESSIONAL })}
              className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-foreground)]">
                <UsersIcon className="size-5" aria-hidden />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">Qualquer profissional</span>
                <span className="text-sm text-muted-foreground">Mais horários disponíveis</span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </li>
          {professionalsForService.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => go({ professionalId: p.id })}
                className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted"
              >
                <Avatar pro={p} />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{p.display_name}</span>
                  {p.specialties.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {p.specialties.join(" · ")}
                    </span>
                  )}
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === "datetime" && service && (
        <DateTimePicker
          slug={page.establishment.slug}
          serviceId={service.id}
          professionalId={toProfessionalParam(effective.professionalId)}
          timeZone={tz}
          maxDaysAhead={page.settings.max_booking_days_ahead}
          date={effective.date}
          startsAt={effective.startsAt}
          reloadKey={reloadKey}
          onDateChange={(d) => go({ date: d, startsAt: null }, true)}
          onSlotChange={(t) => go({ startsAt: t })}
        />
      )}

      {step === "details" && (
        <CustomerForm
          pending={pending}
          error={formError}
          policyText={page.settings.booking_policy_text}
          onSubmit={submit}
        />
      )}

      {page.settings.booking_requires_confirmation && step === "details" && (
        <p className="text-sm text-muted-foreground">
          O estabelecimento confirma cada agendamento. Você verá a situação no link da reserva.
        </p>
      )}
    </section>
  );
}
