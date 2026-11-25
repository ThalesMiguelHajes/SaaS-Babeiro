import { StoreIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Visão geral" };

export default async function AdminHomePage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [total, active, suspended] = await Promise.all([
    supabase.from("establishments").select("id", { count: "exact", head: true }),
    supabase
      .from("establishments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("establishments")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
  ]);

  const stats = [
    { label: "Estabelecimentos", value: total.count ?? 0 },
    { label: "Ativos", value: active.count ?? 0 },
    { label: "Suspensos", value: suspended.count ?? 0 },
  ];

  return (
    <>
      <PageHeader title="Visão geral" description="Situação dos estabelecimentos da plataforma." />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {(total.count ?? 0) === 0 && (
        <EmptyState
          icon={StoreIcon}
          title="Nenhum estabelecimento cadastrado"
          description="O cadastro de estabelecimentos chega na Fase 2."
        />
      )}
    </>
  );
}
