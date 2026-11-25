/**
 * Códigos de erro de domínio (DATABASE.md §10.5) e mensagens em pt-BR.
 * O banco lança `raise exception using errcode = 'P0001', message = '<CODIGO>'`.
 */
export const DOMAIN_ERROR_MESSAGES = {
  FORBIDDEN: "Você não tem permissão para realizar esta ação.",
  FORBIDDEN_COLUMN: "Este dado só pode ser alterado pela administração da plataforma.",
  NOT_FOUND: "Registro não encontrado.",
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  VALIDATION_ERROR: "Confira os campos destacados.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  WEAK_PASSWORD: "A senha precisa ter pelo menos 8 caracteres, com letras e números.",
  SLUG_RESERVED: "Este endereço é reservado. Escolha outro.",
  SLUG_TAKEN: "Este endereço já está em uso.",
  INVALID_TIMEZONE: "Fuso horário inválido.",
  LAST_OWNER: "O estabelecimento precisa manter um responsável principal.",
  TENANT_IMMUTABLE: "Não é possível mover este registro para outro estabelecimento.",
  APPEND_ONLY: "Registros de histórico não podem ser alterados.",
  ESTABLISHMENT_UNAVAILABLE: "Este estabelecimento não está aceitando agendamentos no momento.",
  ESTABLISHMENT_RESTRICTED:
    "O estabelecimento está em modo restrito. Regularize a situação para continuar.",
  PLAN_LIMIT_REACHED:
    "O limite de profissionais do plano foi atingido. Desative alguém ou solicite mais vagas.",
  SLOT_UNAVAILABLE: "Esse horário não está mais disponível. Escolha outro.",
  SERVICE_UNAVAILABLE: "Este serviço não está disponível para agendamento.",
  PROFESSIONAL_UNAVAILABLE: "Este profissional não realiza o serviço escolhido ou está inativo.",
  OUTSIDE_BOOKING_WINDOW: "Este horário está fora do período permitido para agendamento.",
  INVALID_STATUS_TRANSITION: "Essa mudança de situação não é permitida para este agendamento.",
  STALE_VERSION:
    "Este agendamento foi alterado por outra pessoa. Atualize a página e tente de novo.",
  POLICY_VIOLATION: "A política do estabelecimento não permite esta alteração.",
  HAS_FUTURE_APPOINTMENTS:
    "Há agendamentos futuros com este profissional. Remarque ou cancele antes de desativar.",
  CUSTOMER_LIMIT_REACHED:
    "Você já tem agendamentos em aberto aqui. Cancele ou conclua um deles antes de marcar outro.",
  COUPON_CODE_TAKEN: "Já existe um cupom com este código.",
  COUPON_INVALID: "Cupom inválido, vencido, inativo ou esgotado.",
  COUPON_ALREADY_USED: "Este cupom já foi aplicado a esta assinatura.",
  SUBSCRIPTION_EXISTS: "Este estabelecimento já tem uma assinatura em andamento.",
  PROMOTION_UNAVAILABLE: "A oferta de entrada não está disponível para este plano.",
  PROMOTION_ALREADY_USED: "Este estabelecimento já usou a oferta de entrada.",
  PLAN_VERSION_IN_USE: "Esta versão do plano já está em uso. Crie uma nova versão de preço.",
  INVOICE_IMMUTABLE: "Fatura emitida não pode ser alterada. Cancele e gere outra.",
  OVERLAPPING_INTERVALS: "Há intervalos que se sobrepõem no mesmo dia. Ajuste os horários.",
  INVITATION_INVALID: "Este convite é inválido, expirou ou já foi utilizado.",
  INVITATION_EMAIL_MISMATCH: "Este convite foi enviado para outro e-mail.",
  OWNER_EXISTS: "Este estabelecimento já tem um responsável principal.",
  ALREADY_MEMBER: "Esta pessoa já faz parte da equipe.",
  REASON_REQUIRED: "Informe o motivo.",
  EMAIL_IN_USE: "Já existe uma conta com este e-mail. Entre com ela para aceitar o convite.",
  FILE_INVALID: "Envie uma imagem JPG, PNG ou WebP de até 5 MB.",
  CANNOT_CHANGE_SELF: "Você não pode alterar o seu próprio acesso.",
  NOT_A_MEMBER: "Essa pessoa não faz parte da equipe.",
  ALREADY_LINKED: "Essa conta já está vinculada a outro profissional.",
  UNEXPECTED: "Algo deu errado. Tente novamente em instantes.",
} as const;

export type DomainErrorCode = keyof typeof DOMAIN_ERROR_MESSAGES;

export function isDomainErrorCode(value: unknown): value is DomainErrorCode {
  return typeof value === "string" && Object.hasOwn(DOMAIN_ERROR_MESSAGES, value);
}

export function messageFor(code: DomainErrorCode): string {
  return DOMAIN_ERROR_MESSAGES[code];
}

type PostgrestLikeError = { code?: string | null; message?: string | null };

/**
 * Converte um erro do Supabase/PostgREST em código de domínio.
 * Mensagens SQL nunca chegam ao usuário (CLAUDE.md §5).
 */
export function toDomainErrorCode(error: PostgrestLikeError | null | undefined): DomainErrorCode {
  if (!error) return "UNEXPECTED";
  if (error.code === "P0001" && isDomainErrorCode(error.message)) return error.message;
  switch (error.code) {
    case "42501":
      return "FORBIDDEN";
    case "23P01":
      return "SLOT_UNAVAILABLE";
    case "PGRST116":
      return "NOT_FOUND";
    default:
      return "UNEXPECTED";
  }
}
