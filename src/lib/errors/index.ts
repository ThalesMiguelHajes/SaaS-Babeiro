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
  PLAN_LIMIT_REACHED: "O limite de profissionais do plano foi atingido.",
  SLOT_UNAVAILABLE: "Esse horário acabou de ser reservado. Escolha outro.",
  INVITATION_INVALID: "Este convite é inválido, expirou ou já foi utilizado.",
  INVITATION_EMAIL_MISMATCH: "Este convite foi enviado para outro e-mail.",
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
