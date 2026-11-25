import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/authz";
import { formatCents } from "@/lib/money";
import { CouponForm, CouponToggle } from "@/modules/billing/components/coupon-form";
import { listCoupons } from "@/modules/billing/queries";

export const metadata: Metadata = { title: "Cupons" };

const DURATION: Record<string, string> = { once: "1 fatura", forever: "sempre" };

export default async function CouponsPage() {
  await requirePlatformAdmin();
  const coupons = await listCoupons();
  return (
    <>
      <PageHeader
        title="Cupons"
        description="Descontos reutilizáveis aplicados pela equipe na assinatura de cada estabelecimento."
      />
      <Card>
        <CardHeader>
          <CardTitle>Novo cupom</CardTitle>
        </CardHeader>
        <CardContent>
          <CouponForm />
        </CardContent>
      </Card>
      <ul className="flex flex-col divide-y rounded-lg border text-sm">
        {coupons.length === 0 && <li className="px-3 py-4 text-muted-foreground">Nenhum cupom.</li>}
        {coupons.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <span className="w-32 font-mono font-medium">{c.code}</span>
            <span className="flex-1">
              {c.name} ·{" "}
              {c.kind === "percent"
                ? `${c.value / 100}%`
                : c.kind === "fixed"
                  ? formatCents(c.value)
                  : "gratuito"}{" "}
              · {c.duration === "repeating" ? `${c.cycles} faturas` : DURATION[c.duration]}
              {c.valid_until && ` · até ${c.valid_until.split("-").reverse().join("/")}`}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {c.redemptions}
              {c.max_redemptions ? ` / ${c.max_redemptions}` : ""} uso(s)
            </span>
            <span
              className={
                c.is_active ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
              }
            >
              {c.is_active ? "Ativo" : "Inativo"}
            </span>
            <CouponToggle couponId={c.id} active={c.is_active} />
          </li>
        ))}
      </ul>
    </>
  );
}
