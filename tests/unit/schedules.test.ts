import { describe, expect, it } from "vitest";

import {
  dayPeriodOf,
  groupSlotsByPeriod,
  localToInstant,
  todayInTimeZone,
} from "@/modules/availability/rules";
import {
  describeIntervals,
  findIntervalProblem,
  groupWeeklyHours,
  timeToMinutes,
  toWeeklyPayload,
} from "@/modules/schedules/rules";
import { blockSchema, dateOverrideSchema, weeklyHoursSchema } from "@/modules/schedules/schemas";

const TZ = "America/Sao_Paulo";

describe("intervalos de horário", () => {
  it("converte horário em minutos, inclusive 24:00", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBe(1440);
  });

  it("aceita almoço como dois intervalos", () => {
    expect(
      findIntervalProblem([
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "18:00" },
      ]),
    ).toBe(-1);
  });

  it("aponta intervalo sobreposto ou invertido", () => {
    expect(
      findIntervalProblem([
        { start: "09:00", end: "12:00" },
        { start: "11:00", end: "14:00" },
      ]),
    ).toBe(1);
    expect(findIntervalProblem([{ start: "18:00", end: "09:00" }])).toBe(0);
    expect(findIntervalProblem([{ start: "9h", end: "10:00" }])).toBe(0);
  });

  it("intervalos encostados não se sobrepõem", () => {
    expect(
      findIntervalProblem([
        { start: "09:00", end: "12:00" },
        { start: "12:00", end: "13:00" },
      ]),
    ).toBe(-1);
  });

  it("agrupa linhas do banco por dia (segunda a domingo) e gera o payload da RPC", () => {
    const days = groupWeeklyHours([
      { weekday: 1, start_time: "13:00:00", end_time: "18:00:00" },
      { weekday: 1, start_time: "09:00:00", end_time: "12:00:00" },
      { weekday: 0, start_time: "10:00:00", end_time: "14:00:00" },
    ]);
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days[0]?.intervals).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ]);
    expect(toWeeklyPayload(days)).toHaveLength(3);
    expect(describeIntervals(days[0]!.intervals)).toBe("09:00–12:00 · 13:00–18:00");
    expect(describeIntervals([])).toBe("Fechado");
  });
});

describe("schemas de agenda", () => {
  it("recusa sobreposição no horário semanal", () => {
    const r = weeklyHoursSchema.safeParse({
      days: [
        {
          weekday: 2,
          intervals: [
            { start: "09:00", end: "13:00" },
            { start: "12:00", end: "18:00" },
          ],
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("horário especial exige intervalo; fechado não", () => {
    expect(
      dateOverrideSchema.safeParse({ date: "2026-12-25", kind: "closed", intervals: [], label: "" })
        .success,
    ).toBe(true);
    expect(
      dateOverrideSchema.safeParse({
        date: "2026-12-24",
        kind: "custom_hours",
        intervals: [],
        label: "",
      }).success,
    ).toBe(false);
  });

  it("bloqueio precisa terminar depois de começar", () => {
    const base = {
      professionalId: null,
      allDay: false,
      startDate: "2026-12-01",
      endDate: "2026-12-01",
      startTime: "12:00",
      endTime: "13:00",
      kind: "break",
      reason: "",
    };
    expect(blockSchema.safeParse(base).success).toBe(true);
    expect(blockSchema.safeParse({ ...base, endTime: "11:00" }).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, allDay: true, endTime: "11:00" }).success).toBe(true);
  });
});

describe("horários livres", () => {
  it("agrupa em Manhã, Tarde e Noite no fuso do estabelecimento", () => {
    const slots = ["09:00", "11:45", "12:00", "17:30", "18:00"].map((t) => ({
      startsAt: localToInstant("2026-12-01", t, TZ),
    }));
    const groups = groupSlotsByPeriod(slots, TZ);
    expect(groups.map((g) => [g.label, g.slots.length])).toEqual([
      ["Manhã", 2],
      ["Tarde", 2],
      ["Noite", 1],
    ]);
    expect(dayPeriodOf(localToInstant("2026-12-01", "12:00", TZ), TZ)).toBe("afternoon");
  });

  it("converte data e hora locais em instante (São Paulo é UTC−3)", () => {
    expect(localToInstant("2026-12-01", "09:00", TZ)).toBe("2026-12-01T12:00:00.000Z");
    expect(localToInstant("2026-12-01", "24:00", TZ)).toBe("2026-12-02T03:00:00.000Z");
  });

  it("calcula o dia local de hoje", () => {
    // 01:30 UTC de 2 de dezembro ainda é 1º de dezembro em São Paulo.
    expect(todayInTimeZone(TZ, new Date("2026-12-02T01:30:00Z"))).toBe("2026-12-01");
  });
});
