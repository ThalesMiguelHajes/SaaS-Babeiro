import type { Database } from "@/types/database";

export * from "./cycles";

type Enums = Database["public"]["Enums"];
export type SubscriptionStatus = Enums["subscription_status"];
export type InvoiceStatus = Enums["invoice_status"];
export type BillingPaymentMethod = Enums["billing_payment_method"];
export type EstablishmentMode = Enums["establishment_mode"];

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  pending_activation: "Aguardando ativação",
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Em atraso",
  suspended: "Suspensa",
  canceled: "Cancelada",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  open: "Em aberto",
  paid: "Paga",
  overdue: "Vencida",
  canceled: "Cancelada",
  partially_paid: "Paga parcialmente",
  refunded: "Estornada",
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  open: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  paid: "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-300",
  overdue: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  canceled: "border-border bg-muted text-muted-foreground line-through",
  partially_paid: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  refunded: "border-border bg-muted text-muted-foreground",
};

export const BILLING_METHODS: { value: BillingPaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "other", label: "Outro" },
];

export const billingMethodLabel = (m: string) =>
  BILLING_METHODS.find((x) => x.value === m)?.label ?? m;

/** "Vencida" na tela mesmo antes da rotina diária (fase B4) atualizar o status no banco. */
export function effectiveInvoiceStatus(
  status: InvoiceStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  if ((status === "open" || status === "partially_paid") && dueDate < today) return "overdue";
  return status;
}

export function isPayable(status: InvoiceStatus): boolean {
  return status === "open" || status === "overdue" || status === "partially_paid";
}

export const PIX_KEY_TYPES = [
  { value: "cnpj", label: "CNPJ" },
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
] as const;

/** Mensagem de cobrança para enviar manualmente pelo WhatsApp (BILLING §11.2). */
export function invoiceWhatsappMessage(input: {
  establishmentName: string;
  number: string | null;
  totalLabel: string;
  dueLabel: string;
  pixKey: string | null;
  pixReceiver: string | null;
  url: string;
}): string {
  return [
    `Olá! Segue a fatura ${input.number ?? ""} de ${input.establishmentName}.`,
    `Valor: ${input.totalLabel} · Vencimento: ${input.dueLabel}`,
    input.pixKey
      ? `Pix: ${input.pixKey}${input.pixReceiver ? ` (${input.pixReceiver})` : ""}`
      : null,
    `Ver fatura e enviar comprovante: ${input.url}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function modeBanner(
  mode: EstablishmentMode,
  status: SubscriptionStatus | null,
): { tone: "info" | "warning" | "danger"; text: string } | null {
  if (mode === "setup") {
    return {
      tone: "info",
      text: "Conta em implantação: a página de agendamento será liberada após o primeiro pagamento.",
    };
  }
  if (mode === "restricted" && status && status !== "active") {
    return {
      tone: "danger",
      text: "Acesso restrito por pendência na assinatura. Novos agendamentos, profissionais e serviços estão bloqueados até a regularização.",
    };
  }
  if (status === "past_due") {
    return { tone: "warning", text: "Há fatura em atraso. Regularize para evitar a suspensão." };
  }
  return null;
}

/** Etapa da régua em texto: −5 → "vence em 5 dias", 0 → "vence hoje", 3 → "vencida há 3 dias". */
export function dunningStageLabel(daysFromDue: number): string {
  if (daysFromDue < 0) return `Vence em ${-daysFromDue} dia${daysFromDue === -1 ? "" : "s"}`;
  if (daysFromDue === 0) return "Vence hoje";
  return `Vencida há ${daysFromDue} dia${daysFromDue === 1 ? "" : "s"}`;
}

/** Aviso de fatura próxima/vencida para o painel do estabelecimento (régua in-app). */
export function invoiceDueBanner(
  invoice: { due_date: string; status: string } | null,
  today: string,
  warnDays = 5,
): { tone: "info" | "warning"; text: string } | null {
  if (!invoice) return null;
  const days = Math.round(
    (Date.parse(`${invoice.due_date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000,
  );
  if (days < 0)
    return { tone: "warning", text: `Sua fatura venceu há ${-days} dia${days === -1 ? "" : "s"}.` };
  if (days === 0) return { tone: "info", text: "Sua fatura vence hoje." };
  if (days <= warnDays)
    return { tone: "info", text: `Sua fatura vence em ${days} dia${days === 1 ? "" : "s"}.` };
  return null;
}
