import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { todayInTimeZone } from "@/modules/availability/rules";

import {
  invoiceDueBanner,
  modeBanner,
  type EstablishmentMode,
  type SubscriptionStatus,
} from "../rules";

/** Aviso do painel conforme o modo efetivo (BILLING §12). */
export function BillingBanner({
  mode,
  status,
  href,
  nextInvoice = null,
}: {
  mode: EstablishmentMode;
  status: SubscriptionStatus | null;
  href: string | null;
  nextInvoice?: { due_date: string; status: string } | null;
}) {
  // Régua in-app (BILLING §11.2): situação da conta primeiro; senão, vencimento próximo.
  const banner =
    modeBanner(mode, status) ?? invoiceDueBanner(nextInvoice, todayInTimeZone("America/Sao_Paulo"));
  if (!banner) return null;
  const Icon = banner.tone === "info" ? InfoIcon : TriangleAlertIcon;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 border-b px-4 py-3 text-sm",
        banner.tone === "info" && "border-sky-500/30 bg-sky-500/10",
        banner.tone === "warning" && "border-amber-500/30 bg-amber-500/10",
        banner.tone === "danger" && "border-red-500/30 bg-red-500/10",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        {banner.text}
        {href && (
          <>
            {" "}
            <Link href={href} className="font-medium underline underline-offset-4">
              Ver assinatura
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
