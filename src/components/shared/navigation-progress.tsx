"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Barra de progresso no topo durante a navegação entre páginas.
 * Começa no clique em um link interno e termina quando a nova URL é renderizada.
 */
type State = "idle" | "loading" | "done";

let state: State = "idle";
let doneTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  for (const l of listeners) l();
}

function start() {
  clearTimeout(doneTimer);
  setState("loading");
}

function finish() {
  if (state !== "loading") return;
  setState("done");
  doneTimer = setTimeout(() => setState("idle"), 400);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => "idle" as State,
  );

  // Nova URL renderizada → conclui a barra.
  useEffect(() => {
    finish();
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) start();
    };
    // Envio de formulários GET (filtros e buscas) também navega.
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!event.defaultPrevented && form?.method?.toLowerCase() === "get") start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return (
    <div
      aria-hidden
      data-state={current}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left bg-primary opacity-0 transition-[transform,opacity] ease-out data-[state=done]:scale-x-100 data-[state=done]:opacity-100 data-[state=done]:duration-300 data-[state=idle]:scale-x-0 data-[state=idle]:duration-0 data-[state=loading]:scale-x-[0.85] data-[state=loading]:opacity-100 data-[state=loading]:duration-[8000ms] motion-reduce:transition-none"
    />
  );
}
