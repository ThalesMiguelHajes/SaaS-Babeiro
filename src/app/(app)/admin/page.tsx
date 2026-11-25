import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/authz";
import { AuditTable } from "@/modules/audit/components/audit-table";
import { listAuditLogs } from "@/modules/audit/queries";
import { getPlatformStats } from "@/modules/platform/queries";

export const metadata: Metadata = { title: "Visão geral" };

export default async function AdminHomePage() {
  await requirePlatformAdmin();
  const [stats, recent] = await Promise.all([getPlatformStats(), listAuditLogs({ pageSize: 8 })]);

  const cards = [
    { label: "Estabelecimentos", value: stats.total },
    { label: "Ativos", value: stats.active },
    { label: "Suspensos", value: stats.suspended },
    { label: "Novos (30 dias)", value: stats.newLast30 },
  ];

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Situação da plataforma."
        actions={
          <Button asChild>
            <Link href="/admin/estabelecimentos/novo">
              <PlusIcon aria-hidden /> Novo estabelecimento
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{c.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Atividade recente</h2>
          <Button variant="link" asChild className="px-0">
            <Link href="/admin/auditoria">Ver tudo</Link>
          </Button>
        </div>
        <AuditTable rows={recent.rows} />
      </section>
    </>
  );
}
