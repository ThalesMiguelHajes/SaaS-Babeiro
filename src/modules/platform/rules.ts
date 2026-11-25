/** Gera um slug de URL a partir do nome ("Barbearia São João" → "barbearia-sao-joao"). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const BUSINESS_TYPE_LABEL = {
  barbershop: "Barbearia",
  beauty_salon: "Salão de beleza",
  nail_studio: "Esmalteria / manicure",
  aesthetics: "Estética",
  other: "Outro",
} as const;

export const ESTABLISHMENT_STATUS_LABEL = {
  active: "Ativo",
  suspended: "Suspenso",
  deactivated: "Desativado",
} as const;

export const MEMBER_ROLE_LABEL = {
  owner: "Responsável",
  admin: "Administrador",
  staff: "Profissional",
} as const;

export const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Fusos oferecidos no cadastro (o banco aceita qualquer fuso IANA válido). */
export const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, Nordeste, GO, DF)" },
  { value: "America/Manaus", label: "Amazonas (AM, RR, RO, MT, MS)" },
  { value: "America/Belem", label: "Pará / Amapá" },
  { value: "America/Fortaleza", label: "Fortaleza" },
  { value: "America/Recife", label: "Recife" },
  { value: "America/Bahia", label: "Bahia" },
  { value: "America/Cuiaba", label: "Cuiabá" },
  { value: "America/Campo_Grande", label: "Campo Grande" },
  { value: "America/Porto_Velho", label: "Porto Velho" },
  { value: "America/Boa_Vista", label: "Boa Vista" },
  { value: "America/Rio_Branco", label: "Acre" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
] as const;

/** Mensagem pronta para enviar o convite pelo WhatsApp (envio manual). */
export function invitationMessage(input: {
  establishmentName: string;
  roleLabel: string;
  url: string;
}) {
  return (
    `Olá! Você foi convidado(a) para acessar o painel de ${input.establishmentName} como ${input.roleLabel.toLowerCase()}.\n\n` +
    `Crie sua senha e entre pelo link abaixo (válido por 7 dias):\n${input.url}`
  );
}
