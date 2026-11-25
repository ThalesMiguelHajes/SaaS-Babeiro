import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Normaliza um telefone (padrão Brasil) para E.164. Retorna null se inválido. */
export function toE164(input: string, defaultCountry: "BR" = "BR"): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

/** Exibe um número E.164 no formato nacional: (11) 91234-5678. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "BR" ? parsed.formatNational() : parsed.formatInternational();
}

/** Link wa.me para envio manual (sem integração automática). */
export function whatsappLink(e164: string | null, text: string): string {
  const base = e164 ? `https://wa.me/${e164.replace(/^\+/, "")}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
