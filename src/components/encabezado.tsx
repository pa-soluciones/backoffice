/** Encabezado de página: título, bajada opcional y acciones. En mobile las acciones bajan. */
export function Encabezado({ titulo, bajada, children }: { titulo: React.ReactNode; bajada?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold text-balance md:text-3xl">{titulo}</h1>
        {bajada && <p className="max-w-prose text-sm text-muted-foreground">{bajada}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
