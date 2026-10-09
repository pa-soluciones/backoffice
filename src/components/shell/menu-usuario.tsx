import { requireUsuario } from "@/services/sesion";
import { BotonSalir } from "./boton-salir";

// Lee la sesión: además de mostrar el usuario, protege toda la app (redirige a /login o al asistente).
export async function MenuUsuario() {
  const u = await requireUsuario();
  const iniciales = u.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground"
      >
        {iniciales}
      </span>
      <span className="hidden max-w-40 truncate text-sm lg:inline">{u.name}</span>
      <BotonSalir />
    </div>
  );
}
