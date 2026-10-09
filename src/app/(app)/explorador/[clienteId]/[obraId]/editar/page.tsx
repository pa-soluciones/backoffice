import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { opcionesDirectores } from "@/services/directores";
import { obtenerObra } from "@/services/obras";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { accionEliminarObra } from "../../../actions";
import { BotonConfirmar } from "../../../_componentes/boton-confirmar";
import { ObraForm } from "../../../_componentes/obra-form";

export const metadata: Metadata = { title: "Editar obra" };

async function Contenido({ params }: { params: Promise<{ clienteId: string; obraId: string }> }) {
  const { usuario } = await requirePermiso("obras", "escribir");
  const { obraId } = await params;
  const [r, directores, permisos] = await Promise.all([obtenerObra(obraId), opcionesDirectores(), getPermisos(usuario.id)]);
  if (!r) notFound();
  const { obra, cliente } = r;

  return (
    <>
      <Migas
        items={[
          { href: "/explorador", label: "Clientes" },
          { href: `/explorador/${cliente.id}`, label: cliente.razonSocial },
          { href: `/explorador/${cliente.id}/${obra.id}`, label: obra.direccion },
          { label: "Editar" },
        ]}
      />
      <h1 className="text-2xl font-bold md:text-3xl">Editar obra</h1>
      <ObraForm clienteId={cliente.id} obra={obra} directores={directores} />
      {alcanceDe(permisos, "obras", "eliminar") && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="text-lg font-semibold">Más acciones</h2>
          <BotonConfirmar
            variant="destructive"
            accion={accionEliminarObra.bind(null, cliente.id, obra.id)}
            confirmacion={`¿Eliminar la obra "${obra.direccion}"?`}
          >
            Eliminar obra
          </BotonConfirmar>
        </section>
      )}
    </>
  );
}

export default function EditarObraPage({ params }: PageProps<"/explorador/[clienteId]/[obraId]/editar">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
