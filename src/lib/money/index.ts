/** Valores monetários sempre em centavos inteiros (CLAUDE.md §3.7). */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new TypeError("O valor deve ser um inteiro em centavos.");
  return brl.format(cents / 100);
}

/**
 * Converte texto digitado ("1.234,56", "R$ 40", "40,5") em centavos.
 * Retorna null se o texto não representar um valor válido.
 */
export function parseBrlToCents(input: string): number | null {
  const cleaned = input.replace(/R\$/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null;
  const [intPart = "0", decPart = ""] = cleaned.replace(/\./g, "").split(",");
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
