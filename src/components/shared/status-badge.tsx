import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ESTABLISHMENT_STATUS_LABEL } from "@/modules/platform/rules";
import type { Database } from "@/types/database";

const TONE: Record<Database["public"]["Enums"]["establishment_status"], string> = {
  active: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  suspended: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  deactivated: "border-border bg-muted text-muted-foreground",
};

export function EstablishmentStatusBadge({
  status,
}: {
  status: Database["public"]["Enums"]["establishment_status"];
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE[status])}>
      {ESTABLISHMENT_STATUS_LABEL[status]}
    </Badge>
  );
}
