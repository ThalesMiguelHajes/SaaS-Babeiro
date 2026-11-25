import { cn } from "@/lib/utils";

import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, type InvoiceStatus } from "../rules";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium",
        INVOICE_STATUS_TONE[status],
      )}
    >
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
