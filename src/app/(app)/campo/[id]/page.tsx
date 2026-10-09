import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { contextoCarga, presupuestosParaCampo } from "@/services/campo";
import { ErrorNegocio } from "@/services/errores";
import { alcanceDe } from "@/domain/permisos";
import { categorias } from "@/services/gastos";
import { getPermisos, requireUsuario } from "@/services/sesion";
import { materialesDelPresupuesto } from "@/services/stock";
import { ConsumoRapido, FormGasto } from "../_componentes/form-gasto";
import { FormRegistro } from "../_componentes/form-registro";

export const metadata: Metadata = { title: "Registrar perforaciones" };

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = (await presupuestosParaCampo()).find((x) => x.id === id);
  if (!p) notFound();
  let ctx;
  try {
    ctx = await contextoCarga(id);
  } catch (e) {
    if (e instanceof ErrorNegocio) notFound();
    throw e;
  }
  const codigo = p.codigo ?? "Sin numerar";
  const permisos = await getPermisos((await requireUsuario()).id);
  const [cats, materiales] = await Promise.all([
    alcanceDe(permisos, "gastos", "escribir") ? categorias() : [],
    alcanceDe(permisos, "stock", "escribir") && p.estado === "en_progreso" ? materialesDelPresupuesto(id).then((m) => m.enObra) : [],
  ]);
  return (
    <>
      <Migas items={[{ href: "/campo", label: "Campo" }, { label: codigo }]} />
      <div>
        <h1 className="text-2xl font-bold">{codigo}</h1>
        <p className="text-sm text-muted-foreground">{[p.cliente, p.direccion].filter(Boolean).join(" · ")}</p>
      </div>
      <FormRegistro presupuestoId={id} codigo={codigo} items={ctx.items} usuarios={ctx.usuarios} yo={ctx.yo} inicial={ctx.ultimo} />
      {materiales.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold">Consumo de material</summary>
          <ConsumoRapido presupuestoId={id} codigo={codigo} materiales={materiales} />
        </details>
      )}
      {cats.length > 0 && (
        <details>
          <summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold">Cargar gasto</summary>
          <FormGasto presupuestoId={id} categorias={cats} codigo={codigo} />
        </details>
      )}
      <Link href={`/presupuestos/${id}/campo`} className="block text-center text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
        Ver registros, fotos y balance
      </Link>
    </>
  );
}

export default function RegistrarPage({ params }: PageProps<"/campo/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Contenido params={params} />
    </Suspense>
  );
}
