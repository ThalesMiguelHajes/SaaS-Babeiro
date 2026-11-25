import { readableTextColor } from "../rules";

/** Aplica a cor de destaque do estabelecimento (somente na página pública, DESIGN_SYSTEM §3). */
export function BrandScope({ color, children }: { color: string; children: React.ReactNode }) {
  const safe = /^#[0-9a-f]{6}$/i.test(color) ? color : "#18181b";
  return (
    <div
      className="mx-auto flex w-full max-w-[480px] flex-1 flex-col pb-10"
      style={
        {
          "--brand": safe,
          "--brand-foreground": readableTextColor(safe),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
