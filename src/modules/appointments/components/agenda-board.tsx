"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { AgendaDay } from "../types";
import { AppointmentSheet } from "./appointment-sheet";
import { NewAppointmentDialog, type NewAppointmentPrefill } from "./new-appointment-dialog";
import { ScheduleGrid } from "./schedule-grid";

/** Agenda do dia interativa: grade + painel do agendamento + novo agendamento. */
export function AgendaBoard({
  slug,
  date,
  day,
  isAdmin,
  ownProfessionalId,
  canRecordPayment,
  services,
  initialOpenId = null,
}: {
  slug: string;
  date: string;
  day: AgendaDay;
  isAdmin: boolean;
  ownProfessionalId: string | null;
  canRecordPayment: boolean;
  services: { id: string; name: string; duration_minutes: number; professionalIds: string[] }[];
  initialOpenId?: string | null;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [newState, setNewState] = useState<{ key: number; prefill: NewAppointmentPrefill } | null>(
    null,
  );
  const professionals = day.professionals
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, display_name: p.display_name }));
  const canCreate = isAdmin || Boolean(ownProfessionalId);

  function openNew(prefill: NewAppointmentPrefill) {
    setNewState((s) => ({ key: (s?.key ?? 0) + 1, prefill }));
  }

  return (
    <div className="flex flex-col gap-3">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => openNew({ professionalId: null, date, startsAt: null })}>
            <PlusIcon aria-hidden />
            Novo agendamento
          </Button>
        </div>
      )}
      <ScheduleGrid
        day={day}
        date={date}
        onAppointmentClick={setOpenId}
        onEmptyClick={
          canCreate
            ? (professionalId, startsAt) => openNew({ professionalId, date, startsAt })
            : undefined
        }
      />
      <AppointmentSheet
        slug={slug}
        appointmentId={openId}
        timeZone={day.timezone}
        isAdmin={isAdmin}
        canRecordPayment={canRecordPayment}
        professionals={professionals}
        onClose={() => setOpenId(null)}
        onChanged={() => router.refresh()}
      />
      {newState && (
        <NewAppointmentDialog
          key={newState.key}
          slug={slug}
          open
          onOpenChange={(o) => !o && setNewState(null)}
          prefill={newState.prefill}
          services={services}
          professionals={professionals}
          timeZone={day.timezone}
          isAdmin={isAdmin}
          ownProfessionalId={ownProfessionalId}
          onCreated={() => {
            setNewState(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
