/** Destino após aceitar um convite. */
export function homeAfterAccept(input: { slug: string; role: "owner" | "admin" | "staff" }) {
  return input.role === "staff" ? `/profissional/${input.slug}` : `/painel/${input.slug}`;
}
