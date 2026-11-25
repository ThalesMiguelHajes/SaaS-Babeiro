import type { PublicEstablishment } from "./types";

export const ANY_PROFESSIONAL = "qualquer";

export type BookingStep = "service" | "professional" | "datetime" | "details";

export type BookingSelection = {
  serviceId: string | null;
  professionalId: string | null; // ANY_PROFESSIONAL ou id
  date: string | null; // yyyy-MM-dd
  startsAt: string | null; // ISO
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Lê a seleção dos parâmetros da URL (?servico=&profissional=&data=&horario=), descartando lixo. */
export function parseSelection(params: URLSearchParams): BookingSelection {
  const serviceId = params.get("servico");
  const professionalId = params.get("profissional");
  const date = params.get("data");
  const startsAt = params.get("horario");
  return {
    serviceId: serviceId && UUID.test(serviceId) ? serviceId : null,
    professionalId:
      professionalId && (professionalId === ANY_PROFESSIONAL || UUID.test(professionalId))
        ? professionalId
        : null,
    date: date && DATE.test(date) ? date : null,
    startsAt: startsAt && !Number.isNaN(Date.parse(startsAt)) ? startsAt : null,
  };
}

export function currentStep(s: BookingSelection): BookingStep {
  if (!s.serviceId) return "service";
  if (!s.professionalId) return "professional";
  if (!s.startsAt) return "datetime";
  return "details";
}

export function toProfessionalParam(professionalId: string | null): string | null {
  return professionalId === ANY_PROFESSIONAL ? null : professionalId;
}

export function formatAddress(e: Partial<PublicEstablishment>): string | null {
  const street = [e.address_street, e.address_number].filter(Boolean).join(", ");
  const parts = [
    street,
    e.address_district,
    [e.address_city, e.address_state].filter(Boolean).join(" - "),
  ]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Cor do texto legível sobre a cor de destaque (WCAG: luminância relativa). */
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1]!, 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  // Contraste com branco (1.05 / (lum + 0.05)) vs. com preto ((lum + 0.05) / 0.05).
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : "#000000";
}

function icsDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

/** Arquivo .ics (iCalendar) para "Adicionar ao calendário". */
export function buildIcs(input: {
  uid: string;
  title: string;
  description: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  now?: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agenda//Reserva//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${icsDate((input.now ?? new Date()).toISOString())}`,
    `DTSTART:${icsDate(input.startsAt)}`,
    `DTEND:${icsDate(input.endsAt)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    ...(input.location ? [`LOCATION:${icsEscape(input.location)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(input.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Texto para o cliente salvar a reserva no próprio WhatsApp (envio manual). */
export function bookingShareText(input: {
  establishmentName: string;
  serviceName: string;
  when: string;
  professionalName: string;
  referenceCode: string;
  url: string;
}): string {
  return (
    `Meu agendamento em ${input.establishmentName}\n` +
    `${input.serviceName} com ${input.professionalName}\n` +
    `${input.when}\n` +
    `Código: ${input.referenceCode}\n\n` +
    `Ver, remarcar ou cancelar: ${input.url}`
  );
}

/** Máscara de digitação para telefone brasileiro: (11) 91234-5678. */
export function maskBrazilPhone(input: string): string {
  const d = input
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "")
    .slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
