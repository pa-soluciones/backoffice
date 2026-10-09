import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Migas } from "@/components/migas";
import { alcanceDe } from "@/domain/permisos";
import { obtenerCliente } from "@/services/clientes";
import { getPermisos, requirePermiso } from "@/services/sesion";
import { accionArchivarCliente, accionEliminarCliente } from "../../actions";
import { BotonConfirmar } from "../../_componentes/boton-confirmar";
import { ClienteForm } from "../../_componentes/cliente-form";

export const metadata: Metadata = { title: "Editar cliente" };

async function Contenido({ params }: { params: Promise<{ clienteId: string }> }) {
  const { usuario } = await requirePermiso("clientes", "escribir");
  const { clienteId } = await params;
  const [c, permisos] = await Promise.all([obtenerCliente(clienteId), getPermisos(usuario.id)]);
  if (!c) notFound();

  return (
    <>
      <Migas items={[{ href: "/explorador", label: "Clientes" }, { href: `/explorador/${c.id}`, label: c.razonSocial }, { label: "Editar" }]} />
      <h1 className="text-2xl font-bold md:text-3xl">Editar cliente</h1>
      <ClienteForm cliente={c} />
      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Más acciones</h2>
        <div className="flex flex-wrap gap-2">
          <BotonConfirmar
            accion={accionArchivarCliente.bind(null, c.id, !c.archivado)}
            confirmacion={c.archivado ? `¿Desarchivar "${c.razonSocial}"?` : `¿Archivar "${c.razonSocial}"? Deja de aparecer en el listado.`}
          >
            {c.archivado ? "Desarchivar" : "Archivar"}
          </BotonConfirmar>
          {alcanceDe(permisos, "clientes", "eliminar") && (
            <BotonConfirmar
              variant="destructive"
              accion={accionEliminarCliente.bind(null, c.id)}
              confirmacion={`¿Eliminar "${c.razonSocial}"? Solo es posible si no tiene obras.`}
            >
              Eliminar
            </BotonConfirmar>
          )}
        </div>
      </section>
    </>
  );
}

export default function EditarClientePage({ params }: PageProps<"/explorador/[clienteId]/editar">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
