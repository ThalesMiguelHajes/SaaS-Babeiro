/** Rótulos em pt-BR para as ações registradas em audit_logs. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "establishment.created": "Estabelecimento criado",
  "establishment.updated": "Dados do estabelecimento alterados",
  "establishment.status_changed": "Status do estabelecimento alterado",
  "establishment.image_updated": "Imagem do estabelecimento alterada",
  "member.invited": "Convite enviado",
  "member.invitation_revoked": "Convite revogado",
  "member.invitation_accepted": "Convite aceito",
  "platform.super_admin_created": "Super Administrador criado",
  "platform.password_link_generated": "Link de nova senha gerado",
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

const STATUS_LABEL: Record<string, string> = {
  active: "ativo",
  suspended: "suspenso",
  deactivated: "desativado",
};
const ROLE_LABEL: Record<string, string> = {
  owner: "responsável",
  admin: "administrador",
  staff: "profissional",
};

/** Resumo legível dos detalhes da ação (nunca exibe dados pessoais). */
export function auditDetail(action: string, metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  switch (action) {
    case "establishment.status_changed":
      return `${STATUS_LABEL[str(m.from)] ?? str(m.from)} → ${STATUS_LABEL[str(m.to)] ?? str(m.to)}${m.reason ? ` · ${str(m.reason)}` : ""}`;
    case "establishment.updated":
      return m.slug_from ? `endereço: ${str(m.slug_from)} → ${str(m.slug_to)}` : null;
    case "establishment.created":
      return str(m.slug) ? `/${str(m.slug)}` : null;
    case "member.invited":
    case "member.invitation_revoked":
    case "member.invitation_accepted":
      return ROLE_LABEL[str(m.role)] ?? null;
    case "establishment.image_updated":
      return `${m.kind === "logo" ? "logo" : "capa"}${m.removed ? " removida" : ""}`;
    default:
      return null;
  }
}
