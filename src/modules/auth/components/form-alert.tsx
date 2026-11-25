import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormAlert({
  message,
  tone = "error",
}: {
  message: string | null;
  tone?: "error" | "success";
}) {
  if (!message) return null;
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"} aria-live="polite">
      {tone === "error" ? <CircleAlertIcon aria-hidden /> : <CircleCheckIcon aria-hidden />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
