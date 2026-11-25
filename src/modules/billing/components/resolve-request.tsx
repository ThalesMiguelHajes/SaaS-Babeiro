"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { resolveRequestAction } from "../actions";

export function ResolveRequest({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (status: "done" | "dismissed") =>
    start(async () => {
      const r = await resolveRequestAction(requestId, status, "");
      if (!r.ok) toast.error(r.error.message);
      else router.refresh();
    });
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => go("done")}>
        Concluída
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("dismissed")}>
        Dispensar
      </Button>
    </div>
  );
}
