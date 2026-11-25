import { ScissorsIcon } from "lucide-react";

import { publicEnv } from "@/lib/env";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ScissorsIcon className="size-4" aria-hidden />
          </span>
          {publicEnv.NEXT_PUBLIC_APP_NAME}
        </div>
        {children}
      </div>
    </main>
  );
}
