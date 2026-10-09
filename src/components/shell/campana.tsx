import { Bell } from "lucide-react";
import Link from "next/link";
import { noLeidas } from "@/services/notificaciones";

/** Campana con contador de no leídas (spec/09). */
export async function Campana() {
  const n = await noLeidas().catch(() => 0);
  return (
    <Link
      href="/notificaciones"
      aria-label={n ? `Notificaciones: ${n} sin leer` : "Notificaciones"}
      className="relative flex size-10 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2"
    >
      <Bell className="size-5" aria-hidden />
      {n > 0 && (
        <span className="absolute top-0.5 right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-5 font-bold text-primary-foreground" aria-hidden>
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
