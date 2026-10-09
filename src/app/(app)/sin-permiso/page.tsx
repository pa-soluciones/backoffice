import { ShieldX } from "lucide-react";
import Link from "next/link";

export default function SinPermisoPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <ShieldX className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">No tenés permiso</h1>
      <p className="mt-2 text-muted-foreground">
        Tu usuario no tiene acceso a esta sección. Si lo necesitás, pedíselo a un administrador.
      </p>
      <Link href="/" className="mt-6 text-primary-text hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
