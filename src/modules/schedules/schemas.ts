import { z } from "zod";

import { BLOCK_KINDS, findIntervalProblem, isValidTime, timeToMinutes } from "./rules";

const time = z.string().refine(isValidTime, "Use o formato 00:00.");

const interval = z.object({ start: time, end: time });

const intervals = z
  .array(interval)
  .max(8, "No máximo 8 intervalos por dia.")
  .superRefine((list, ctx) => {
    const bad = findIntervalProblem(list);
    if (bad >= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Os intervalos precisam terminar depois de começar e não podem se sobrepor.",
        path: [bad],
      });
    }
  });

export const weeklyHoursSchema = z.object({
  days: z.array(z.object({ weekday: z.number().int().min(0).max(6), intervals })).max(7),
});
export type WeeklyHoursInput = z.input<typeof weeklyHoursSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const dateOverrideSchema = z
  .object({
    date: isoDate,
    kind: z.enum(["closed", "custom_hours"]),
    intervals,
    label: z.string().trim().max(80, "No máximo 80 caracteres."),
  })
  .refine((d) => d.kind === "closed" || d.intervals.length > 0, {
    message: "Informe ao menos um intervalo.",
    path: ["intervals"],
  });
export type DateOverrideInput = z.input<typeof dateOverrideSchema>;

export const blockSchema = z
  .object({
    professionalId: z.uuid().nullable(),
    allDay: z.boolean(),
    startDate: isoDate,
    endDate: isoDate,
    startTime: time,
    endTime: time,
    kind: z.enum(BLOCK_KINDS.map((k) => k.value) as [string, ...string[]]),
    reason: z.string().trim().max(200, "No máximo 200 caracteres."),
  })
  .refine(
    (d) =>
      d.allDay
        ? d.endDate >= d.startDate
        : d.endDate > d.startDate ||
          (d.endDate === d.startDate && timeToMinutes(d.endTime) > timeToMinutes(d.startTime)),
    { message: "O fim precisa ser depois do início.", path: ["endDate"] },
  );
export type BlockInput = z.input<typeof blockSchema>;
export type BlockData = z.output<typeof blockSchema>;
