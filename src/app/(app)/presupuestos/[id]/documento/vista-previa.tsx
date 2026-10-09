import Image from "next/image";
import type { Parrafo } from "@/domain/bloques";
import type { DocAdicional } from "@/documents/adicional";
import type { DocPresupuesto } from "@/documents/presupuesto";
import { cn } from "@/lib/utils";

// Vista previa HTML de los documentos: replica los Word de PAS (spec/06 RF-PRV-01). Los colores son
// los del documento impreso (no los tokens de la app) para que se vea igual que el PDF.
const GRIS = "#5f5e5e";
const NARANJA = "#f49600";
const NARANJA_TABLA = "#E97132";
const DURAZNO = "#FFE2B3";

type Editable = { activo?: string | null; onElegir?: (id: string) => void };
type Item = { nro: string; descripcion: string; cantidad: string; precio: string; subtotal: string };

const bloquesDe = (d: object) => (id: string) => (d as Record<string, Parrafo[] | undefined>)[id] ?? [];

function Texto({ ps, className, lista }: { ps: Parrafo[]; className?: string; lista?: boolean }) {
  const contenido = ps.map((p, i) => {
    const runs = p.runs.map((r, j) => (r.b ? <strong key={j}>{r.t}</strong> : <span key={j}>{r.t}</span>));
    return lista ? <li key={i}>{runs}</li> : <p key={i} className={className}>{runs}</p>;
  });
  return lista ? <ul className="list-disc space-y-0.5 pl-8">{contenido}</ul> : <>{contenido}</>;
}

/** Bloque editable: clic → enfoca su campo en el editor. */
function Bloque({ id, activo, onElegir, children }: Editable & { id: string; children: React.ReactNode }) {
  if (!onElegir) return <div>{children}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onElegir(id)}
      onKeyDown={(e) => e.key === "Enter" && onElegir(id)}
      className={cn("-mx-2 cursor-text rounded px-2 outline-offset-2 hover:bg-[#f4960014] focus-visible:outline-2", activo === id && "bg-[#f496001f] ring-1 ring-[#f49600]")}
    >
      {children}
    </div>
  );
}

function Titulo({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <h3 className="mt-4 mb-1 text-[15px]" style={{ color: NARANJA }}>
      {n ? `${n}. ` : ""}
      {children}
    </h3>
  );
}

/** Hoja con encabezado gris (logo, datos, cliente) y pie de contacto. */
function Hoja({ campos, cliente, director, direccion, children }: { campos: [string, string][]; cliente: string; director: string; direccion: string; children: React.ReactNode }) {
  return (
    <article
      className="mx-auto w-full max-w-[794px] bg-white font-[family-name:var(--font-poppins)] text-[12.5px] leading-relaxed font-normal text-[#1a1a1a] shadow-lg"
      aria-label="Vista previa del documento"
    >
      <header className="px-8 pt-6 pb-4 text-white" style={{ background: GRIS }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Image src="/logo-alt.svg" alt="PAS" width={150} height={82} />
          <dl className="space-y-0.5 text-[11.5px]">
            {campos.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-44 text-right font-semibold">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-3 text-[11.5px]">
          <p className="font-semibold" style={{ color: NARANJA }}>
            Información del cliente
          </p>
          <p>
            <span style={{ color: NARANJA }}>Director de Obra:</span> {director}
          </p>
          <p>
            <span style={{ color: NARANJA }}>Contratista:</span> {cliente}
          </p>
          <p>
            <span style={{ color: NARANJA }}>Dirección de Obra:</span> {direccion}
          </p>
        </div>
      </header>
      <div className="space-y-3 px-10 py-6 text-justify">
        {children}
        <p className="pt-4">Sin otro particular,</p>
        <p>Saludamos a Uds.</p>
        <p className="pt-6 text-right">Atentamente.</p>
      </div>
      <footer className="flex flex-wrap items-end justify-between gap-2 px-8 py-4 text-[10.5px] text-white" style={{ background: GRIS }}>
        <div>
          <p>
            <strong>WhatsApp:</strong> +54 9 11 3014-4852
          </p>
          <p>
            <strong>Mail:</strong> ventas@pasoluciones.com.ar
          </p>
          <p>
            <strong>Web:</strong> www.pasoluciones.com.ar
          </p>
        </div>
        <p className="text-right font-heading text-base leading-tight font-bold">
          SOLUCIONES QUE
          <br />
          <span style={{ color: NARANJA }}>SOSTIENEN</span> ESTRUCTURAS
        </p>
      </footer>
    </article>
  );
}

function TablaItems({ items, etiquetaTotal, total }: { items: Item[]; etiquetaTotal: string; total: string }) {
  return (
    <table className="w-full border-collapse text-left text-[11.5px]">
      <thead>
        <tr className="font-semibold">
          <th className="p-2">Ítem</th>
          <th className="p-2">Descripción Del Servicio Comercial</th>
          <th className="p-2 text-center">Cant.</th>
          <th className="p-2 text-center">Valor Unidad</th>
          <th className="p-2 text-center">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.nro} style={{ background: DURAZNO }}>
            {[i.nro, i.descripcion, i.cantidad, i.precio, i.subtotal].map((v, k) => (
              <td key={k} className={cn("border p-2", k === 1 ? "font-semibold" : "text-center", k === 0 && "font-semibold")} style={{ borderColor: NARANJA_TABLA }}>
                {v}
              </td>
            ))}
          </tr>
        ))}
        <tr className="text-white" style={{ background: NARANJA_TABLA }}>
          <td colSpan={3} className="p-3 text-right text-base font-bold">
            {etiquetaTotal}
          </td>
          <td colSpan={2} className="p-3 text-center text-base font-bold">
            {total}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function VistaPrevia({ d, activo, onElegir }: Editable & { d: DocPresupuesto }) {
  const b = bloquesDe(d);
  const e = { activo, onElegir };
  return (
    <Hoja
      campos={[
        ["Presupuesto Nro.", d.codigo],
        ["En la fecha:", d.fecha],
        ["Moneda:", d.moneda],
        ["Validez de la oferta:", d.validez],
        ["Base de ajuste:", d.base_ajuste],
        ["Forma de contratación:", d.forma_contratacion],
      ]}
      cliente={d.cliente}
      director={d.director}
      direccion={d.direccion}
    >
      <h2 className="text-center text-base font-bold" style={{ color: NARANJA }}>
        PRESUPUESTO ECONOMICO DETALLADO
      </h2>
      <Bloque id="introduccion" {...e}>
        <Texto ps={b("introduccion")} className="indent-10" />
      </Bloque>
      <Bloque id="descripcion" {...e}>
        <Texto ps={b("descripcion")} className="indent-10" />
      </Bloque>
      <TablaItems items={d.items} etiquetaTotal="TOTAL NETO:" total={d.total} />
      <div className="py-2 text-center text-base">
        <Texto ps={b("leyenda")} />
      </div>
      <h2 className="text-center text-base font-bold" style={{ color: NARANJA }}>
        CONDICIONES GENERALES Y ALCANCE DE LA PROPUESTA
      </h2>
      <Titulo n={1}>COTIZACIÓN</Titulo>
      <Bloque id="cotizacion" {...e}>
        <Texto ps={b("cotizacion")} className="indent-10" />
      </Bloque>
      <Titulo n={2}>RESPONSABILIDADES DEL CLIENTE</Titulo>
      <Bloque id="responsabilidades_intro" {...e}>
        <Texto ps={b("responsabilidades_intro")} />
      </Bloque>
      <Bloque id="responsabilidades" {...e}>
        <Texto ps={b("responsabilidades")} lista />
      </Bloque>
      <Titulo n={3}>PLAZOS DE EJECUCIÓN</Titulo>
      <Bloque id="plazos" {...e}>
        <Texto ps={b("plazos")} />
      </Bloque>
      <Titulo n={4}>FORMA DE PAGO</Titulo>
      <Bloque id="forma_pago" {...e}>
        <Texto ps={b("forma_pago")} />
      </Bloque>
      <Titulo n={5}>GARANTÍA</Titulo>
      <Bloque id="garantia" {...e}>
        <Texto ps={b("garantia")} />
      </Bloque>
      <Titulo n={6}>NOTAS ADICIONALES</Titulo>
      <Bloque id="notas" {...e}>
        <Texto ps={b("notas")} />
      </Bloque>
    </Hoja>
  );
}

export function VistaPreviaAdicional({ d, activo, onElegir }: Editable & { d: DocAdicional }) {
  const b = bloquesDe(d);
  const e = { activo, onElegir };
  return (
    <Hoja
      campos={[
        ["Cotización Nro.", d.codigo],
        ["Fecha de Emisión:", d.fecha],
        ["Presupuesto de Referencia:", `Nro. ${d.presupuesto_codigo} — ${d.presupuesto_fecha}`],
      ]}
      cliente={d.cliente}
      director={d.director}
      direccion={d.direccion}
    >
      <h2 className="text-center text-base font-bold" style={{ color: NARANJA }}>
        COTIZACIÓN DE TRABAJOS ADICIONALES
      </h2>
      <Titulo>OBJETO</Titulo>
      <Bloque id="objeto" {...e}>
        <Texto ps={b("objeto")} className="indent-10" />
      </Bloque>
      <Titulo>DESCRIPCIÓN DEL SERVICIO</Titulo>
      <Bloque id="descripcion" {...e}>
        <Texto ps={b("descripcion")} className="indent-10" />
      </Bloque>
      <TablaItems items={d.items} etiquetaTotal="Subtotal trabajos adicionales" total={d.total} />
      <Titulo>OBSERVACIONES</Titulo>
      <Bloque id="observaciones" {...e}>
        <Texto ps={b("observaciones")} lista />
      </Bloque>
    </Hoja>
  );
}
