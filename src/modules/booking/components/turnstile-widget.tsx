"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile (anti-bot). Só aparece quando NEXT_PUBLIC_TURNSTILE_SITE_KEY está
 * configurada; a validação acontece no servidor (src/lib/turnstile).
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const el = ref.current;
    let widgetId: string | null = null;

    function render() {
      if (!window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(el, {
        sitekey: siteKey,
        language: "pt-br",
        callback: (t: string) => callback.current(t),
        "expired-callback": () => callback.current(null),
        "error-callback": () => callback.current(null),
      });
    }

    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="min-h-16" />;
}
