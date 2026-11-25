import type { Database } from "@/types/database";

export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
export type PaymentMethod = Database["public"]["Enums"]["pos_payment_method"];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

/** Cores do bloco na agenda e do selo (texto sempre acompanha a cor — acessibilidade). */
export const STATUS_TONE: Record<AppointmentStatus, string> = {
  pending:
    "border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  confirmed: "border-sky-500/50 bg-sky-50 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
  in_progress:
    "border-violet-500/50 bg-violet-50 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200",
  completed:
    "border-green-600/50 bg-green-50 text-green-900 dark:bg-green-600/15 dark:text-green-200",
  cancelled: "border-border bg-muted text-muted-foreground line-through",
  no_show: "border-red-500/50 bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-200",
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Crédito" },
  { value: "other", label: "Outro" },
];

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

/** Espelho da máquina de status do banco (DATABASE §9). A UI só exibe ações válidas; o banco decide. */
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type AppointmentAction =
  "confirm" | "start" | "complete" | "no_show" | "cancel" | "reschedule" | "record_payment";

const START_TOLERANCE_MS = 15 * 60_000;

/** Ações disponíveis agora para o agendamento (mesmas regras de horário do trigger). */
export function availableActions(
  status: AppointmentStatus,
  startsAt: string,
  now: Date = new Date(),
  canRecordPayment = true,
): AppointmentAction[] {
  const start = new Date(startsAt).getTime();
  const started = now.getTime() >= start - START_TOLERANCE_MS;
  const actions: AppointmentAction[] = [];
  if (status === "pending") actions.push("confirm", "reschedule", "cancel");
  if (status === "confirmed") {
    if (started) actions.push("complete", "start");
    if (now.getTime() >= start) actions.push("no_show");
    actions.push("reschedule", "cancel");
  }
  if (status === "in_progress") actions.push("complete");
  if ((status === "in_progress" || status === "completed") && canRecordPayment) {
    actions.push("record_payment");
  }
  return actions;
}

/** Soma de pagamentos e o que falta (ou sobra, ex.: gorjeta) em relação ao valor cobrado. */
export function paymentBalance(chargedCents: number, paidCents: number) {
  return {
    paid: paidCents,
    pending: Math.max(chargedCents - paidCents, 0),
    extra: Math.max(paidCents - chargedCents, 0),
  };
}

/** Minutos desde a meia-noite local, para posicionar blocos na grade. */
export function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** Faixa visível da grade: do menor início ao maior fim, arredondada para horas cheias (padrão 08–20). */
export function gridRange(minutes: { start: number; end: number }[]): {
  start: number;
  end: number;
} {
  if (minutes.length === 0) return { start: 8 * 60, end: 20 * 60 };
  const start = Math.min(...minutes.map((m) => m.start));
  const end = Math.max(...minutes.map((m) => m.end));
  return {
    start: Math.max(0, Math.floor(start / 60) * 60),
    end: Math.min(24 * 60, Math.max(Math.ceil(end / 60) * 60, Math.floor(start / 60) * 60 + 60)),
  };
}
