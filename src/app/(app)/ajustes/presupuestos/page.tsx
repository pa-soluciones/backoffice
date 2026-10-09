import type { Metadata } from "next";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { defaultsPresupuesto, listarNumeracion } from "@/services/configuracion";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { verFirma } from "@/services/firma";
import { configRecordatorios } from "@/services/recordatorios";
import { FilaNumeracion, FormDefaults, FormFirma, FormRecordatorios } from "./formularios";

export const metadata: Metadata = { title: "Ajustes de presupuestos" };

async function Contenido() {
  const { usuario } = await requirePermiso("configuracion", "leer");
  const [numeracion, defaults, permisos, firma, recordatorios] = await Promise.all([listarNumeracion(), defaultsPresupuesto(), getPermisos(usuario.id), verFirma().catch(() => null), configRecordatorios()]);
  const editable = !!alcanceDe(permisos, "configuracion", "escribir");
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Numeración</h2>
        <p className="text-sm text-muted-foreground">
          Los números reinician cada año. Podés definir desde qué número arranca el año actual (por ejemplo, para seguir la numeración que ya venías usando) o el
          próximo.
        </p>
        <ul className="divide-y rounded-xl border bg-card">
          {numeracion.map((n) => (
            <li key={n.anio}>
              <FilaNumeracion {...n} editable={editable} />
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Valores por defecto</h2>
        <p className="text-sm text-muted-foreground">Se aplican a los presupuestos nuevos; cada presupuesto los puede cambiar.</p>
        <FormDefaults d={defaults} editable={editable} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recordatorios</h2>
        <p className="text-sm text-muted-foreground">Cada cuántos días se avisa (todos los días a las 8). 0 = no avisar.</p>
        <FormRecordatorios c={recordatorios} editable={editable} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Firma de los documentos</h2>
        <p className="text-sm text-muted-foreground">Va debajo de &quot;Atentamente.&quot; en presupuestos y adicionales que se emitan a partir de ahora.</p>
        <FormFirma url={firma?.url ?? null} editable={editable} />
      </section>
    </>
  );
}

export default function AjustesPresupuestosPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Migas items={[{ href: "/ajustes", label: "Ajustes" }, { label: "Presupuestos" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Presupuestos</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}
