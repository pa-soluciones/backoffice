import Image from "next/image";
import type { Parrafo } from "@/domain/bloques";
import type { DocPresupuesto } from "@/documents/presupuesto";
import { cn } from "@/lib/utils";

// Vista previa HTML del documento: replica el Word de PAS (spec/06 RF-PRV-01). Los colores son
// los del documento impreso (no los tokens de la app) para que se vea igual que el PDF.
const GRIS = "#5f5e5e";
const NARANJA = "#f49600";
const NARANJA_TABLA = "#E97132";
const DURAZNO = "#FFE2B3";

function Texto({ ps, className, lista }: { ps: Parrafo[]; className?: string; lista?: boolean }) {
  const contenido = ps.map((p, i) => {
    const runs = p.runs.map((r, j) => (r.b ? <strong key={j}>{r.t}</strong> : <span key={j}>{r.t}</span>));
    return lista ? <li key={i}>{runs}</li> : <p key={i} className={className}>{runs}</p>;
  });
  return lista ? <ul className="list-disc space-y-0.5 pl-8">{contenido}</ul> : <>{contenido}</>;
}

/** Bloque editable: clic → enfoca su campo en el editor. */
function Bloque({ id, activo, onElegir, children }: { id: string; activo?: string | null; onElegir?: (id: string) => void; children: React.ReactNode }) {
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

function Titulo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="mt-4 mb-1 text-[15px]" style={{ color: NARANJA }}>
      {n}. {children}
    </h3>
  );
}

export function VistaPrevia({ d, activo, onElegir }: { d: DocPresupuesto; activo?: string | null; onElegir?: (id: string) => void }) {
  const b = (id: string) => ((d as unknown as Record<string, Parrafo[] | undefined>)[id] ?? []);
  const campo = (k: string, v: string) => (
    <div className="flex gap-2">
      <dt className="w-40 text-right font-semibold">{k}</dt>
      <dd>{v}</dd>
    </div>
  );

  return (
    <article className="mx-auto w-full max-w-[794px] bg-white font-[family-name:var(--font-poppins)] font-normal text-[12.5px] leading-relaxed text-[#1a1a1a] shadow-lg" aria-label="Vista previa del documento">
      <header className="px-8 pt-6 pb-4 text-white" style={{ background: GRIS }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Image src="/logo-alt.svg" alt="PAS" width={150} height={82} />
          <dl className="space-y-0.5 text-[11.5px]">
            {campo("Presupuesto Nro.", d.codigo)}
            {campo("En la fecha:", d.fecha)}
            {campo("Moneda:", d.moneda)}
            {campo("Validez de la oferta:", d.validez)}
            {campo("Base de ajuste:", d.base_ajuste)}
            {campo("Forma de contratación:", d.forma_contratacion)}
          </dl>
        </div>
        <div className="mt-3 text-[11.5px]">
          <p className="font-semibold" style={{ color: NARANJA }}>
            Información del cliente
          </p>
          <p>
            <span style={{ color: NARANJA }}>Director de Obra:</span> {d.director}
          </p>
          <p>
            <span style={{ color: NARANJA }}>Contratista:</span> {d.cliente}
          </p>
          <p>
            <span style={{ color: NARANJA }}>Dirección de Obra:</span> {d.direccion}
          </p>
        </div>
      </header>

      <div className="space-y-3 px-10 py-6 text-justify">
        <h2 className="text-center text-base font-bold" style={{ color: NARANJA }}>
          PRESUPUESTO ECONOMICO DETALLADO
        </h2>
        <Bloque id="introduccion" activo={activo} onElegir={onElegir}>
          <Texto ps={b("introduccion")} className="indent-10" />
        </Bloque>
        <Bloque id="descripcion" activo={activo} onElegir={onElegir}>
          <Texto ps={b("descripcion")} className="indent-10" />
        </Bloque>

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
            {d.items.map((i) => (
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
                TOTAL NETO:
              </td>
              <td colSpan={2} className="p-3 text-center text-base font-bold">
                {d.total}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="py-2 text-center text-base">
          <Texto ps={b("leyenda")} />
        </div>

        <h2 className="text-center text-base font-bold" style={{ color: NARANJA }}>
          CONDICIONES GENERALES Y ALCANCE DE LA PROPUESTA
        </h2>
        <Titulo n={1}>COTIZACIÓN</Titulo>
        <Bloque id="cotizacion" activo={activo} onElegir={onElegir}>
          <Texto ps={b("cotizacion")} className="indent-10" />
        </Bloque>
        <Titulo n={2}>RESPONSABILIDADES DEL CLIENTE</Titulo>
        <Bloque id="responsabilidades_intro" activo={activo} onElegir={onElegir}>
          <Texto ps={b("responsabilidades_intro")} />
        </Bloque>
        <Bloque id="responsabilidades" activo={activo} onElegir={onElegir}>
          <Texto ps={b("responsabilidades")} lista />
        </Bloque>
        <Titulo n={3}>PLAZOS DE EJECUCIÓN</Titulo>
        <Bloque id="plazos" activo={activo} onElegir={onElegir}>
          <Texto ps={b("plazos")} />
        </Bloque>
        <Titulo n={4}>FORMA DE PAGO</Titulo>
        <Bloque id="forma_pago" activo={activo} onElegir={onElegir}>
          <Texto ps={b("forma_pago")} />
        </Bloque>
        <Titulo n={5}>GARANTÍA</Titulo>
        <Bloque id="garantia" activo={activo} onElegir={onElegir}>
          <Texto ps={b("garantia")} />
        </Bloque>
        <Titulo n={6}>NOTAS ADICIONALES</Titulo>
        <Bloque id="notas" activo={activo} onElegir={onElegir}>
          <Texto ps={b("notas")} />
        </Bloque>
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
