import { HistoryIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";

import { auditActionLabel, auditDetail } from "../labels";

type Row = {
  id: number;
  action: string;
  metadata: unknown;
  created_at: string;
  actorName: string;
  establishmentName: string | null;
};

export function AuditTable({
  rows,
  showEstablishment = true,
}: {
  rows: Row[];
  showEstablishment?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={HistoryIcon} title="Nenhuma atividade registrada" />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Quando</TableHead>
            <TableHead>Ação</TableHead>
            {showEstablishment && <TableHead>Estabelecimento</TableHead>}
            <TableHead>Quem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const detail = auditDetail(row.action, row.metadata);
            return (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatDateTime(row.created_at)}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{auditActionLabel(row.action)}</span>
                  {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                </TableCell>
                {showEstablishment && (
                  <TableCell>{row.establishmentName ?? "Plataforma"}</TableCell>
                )}
                <TableCell>{row.actorName}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
