/** Páginas abertas ao cliente final (sem login): mobile-first, largura máxima de 480 px. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-svh flex-col bg-background">{children}</div>;
}
