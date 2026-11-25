import { todayInTimeZone } from "@/modules/availability/rules";

import {
  canStaffRecordPayments,
  getAgendaDay,
  listAppointments,
  listServicesForBooking,
} from "../queries";
import { listFiltersSchema } from "../schemas";
import { AgendaBoard } from "./agenda-board";
import { AgendaToolbar } from "./agenda-toolbar";
import { AppointmentList } from "./appointment-list";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Agenda (Dia ou Lista) do painel e da área do profissional. O banco aplica o escopo do papel. */
export async function AgendaView({
  basePath,
  slug,
  establishmentId,
  timeZone,
  isAdmin,
  ownProfessionalId,
  searchParams,
}: {
  basePath: string;
  slug: string;
  establishmentId: string;
  timeZone: string;
  isAdmin: boolean;
  ownProfessionalId: string | null;
  searchParams: Params;
}) {
  const today = todayInTimeZone(timeZone);
  const view = one(searchParams.visao) === "lista" ? "lista" : "dia";
  const dateParam = one(searchParams.data);
  const date = dateParam && DATE.test(dateParam) ? dateParam : today;

  if (view === "lista") {
    const parsed = listFiltersSchema.safeParse({
      from: one(searchParams.de) || today,
      to: one(searchParams.ate) || shift(today, 6),
      professionalId: UUID.test(one(searchParams.profissional) ?? "")
        ? one(searchParams.profissional)
        : null,
      status: one(searchParams.status) || null,
    });
    const filters = parsed.success
      ? parsed.data
      : { from: today, to: shift(today, 6), professionalId: null, status: null };
    const [rows, day] = await Promise.all([
      listAppointments(establishmentId, timeZone, filters),
      getAgendaDay(establishmentId, today),
    ]);
    return (
      <>
        <AgendaToolbar
          basePath={basePath}
          date={date}
          today={today}
          timeZone={timeZone}
          view="lista"
        />
        <AppointmentList
          basePath={basePath}
          rows={rows}
          filters={filters}
          professionals={day.professionals}
          timeZone={timeZone}
        />
      </>
    );
  }

  const [day, services, staffPay] = await Promise.all([
    getAgendaDay(establishmentId, date),
    listServicesForBooking(establishmentId),
    isAdmin ? Promise.resolve(true) : canStaffRecordPayments(establishmentId),
  ]);
  const openId = one(searchParams.abrir);

  return (
    <>
      <AgendaToolbar basePath={basePath} date={date} today={today} timeZone={timeZone} view="dia" />
      <AgendaBoard
        key={date}
        slug={slug}
        date={date}
        day={day}
        isAdmin={isAdmin}
        ownProfessionalId={ownProfessionalId}
        canRecordPayment={staffPay}
        services={
          isAdmin
            ? services
            : services.filter(
                (s) => ownProfessionalId && s.professionalIds.includes(ownProfessionalId),
              )
        }
        initialOpenId={openId && UUID.test(openId) ? openId : null}
      />
    </>
  );
}
