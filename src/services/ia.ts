import "server-only";
import { eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { configuracion, iaUso } from "@/db/schema";
import { ACCIONES_IA, cifrasNuevas, costoUsd, MODELO_DEFAULT, MODELOS, type AccionIA, type Modelo } from "@/domain/ia";
import { claudeConfigurado, completar, IARechazo } from "@/lib/claude";
import { auditar } from "./auditoria";
import { contextoParaIA } from "./documentos";
import { ErrorNegocio } from "./errores";
import { requirePermiso } from "./sesion";

// Asistente de redacción (spec/10). La IA solo propone texto para un bloque: el usuario acepta o descarta.

export type ConfigIA = { modelo: Modelo; limiteMensualUsd: number };
const CLAVE = "ia";
const DEFAULT: ConfigIA = { modelo: MODELO_DEFAULT, limiteMensualUsd: 5 };

export async function configIA(): Promise<ConfigIA> {
  const [r] = await db.select().from(configuracion).where(eq(configuracion.clave, CLAVE));
  const c = { ...DEFAULT, ...(r?.valor as Partial<ConfigIA> | undefined) };
  return { ...c, modelo: c.modelo in MODELOS ? c.modelo : MODELO_DEFAULT };
}

export async function guardarConfigIA(c: ConfigIA) {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  if (!(c.modelo in MODELOS)) throw new ErrorNegocio("Modelo no válido.");
  if (!(c.limiteMensualUsd >= 0)) throw new ErrorNegocio("El tope tiene que ser 0 o más.");
  await db.insert(configuracion).values({ clave: CLAVE, valor: c }).onConflictDoUpdate({ target: configuracion.clave, set: { valor: c, updatedAt: new Date() } });
  await auditar({ actorUserId: usuario.id, action: "configuracion.ia", entityType: "configuracion", entityId: CLAVE, diff: c });
}

const inicioMes = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

/** Gasto del mes en USD (estimado con los precios publicados). */
export async function gastoDelMes() {
  const [r] = await db
    .select({ usd: sql<string>`coalesce(sum(${iaUso.costoUsd}), 0)`, llamadas: sql<number>`count(*)::int` })
    .from(iaUso)
    .where(gte(iaUso.at, inicioMes()));
  return { usd: Number(r.usd), llamadas: r.llamadas };
}

export async function estadoIA() {
  await requirePermiso("configuracion", "leer");
  return { configurada: claudeConfigurado(), config: await configIA(), mes: await gastoDelMes() };
}

const SYSTEM = `Sos redactor técnico-comercial de PAS (Piedra Angular Solutions), empresa de cortes y perforaciones en hormigón armado con tecnología diamantada en CABA y Gran Buenos Aires. Redactás textos de presupuestos y documentos de obra dirigidos a empresas constructoras.

Estilo: español rioplatense formal, trato de "Uds." hacia el cliente, claro, preciso y profesional, sin adornos ni frases de relleno.
Glosario: H°A° = hormigón armado; Ø = diámetro; "sistema diamantado" / "perforación diamantada"; Ajuste Alzado; Base CAC (índice de la Cámara Argentina de la Construcción).

Reglas:
- Devolvé solo el texto final de la sección pedida, sin comillas, explicaciones ni encabezados.
- Cada línea es un párrafo. Si el texto actual es una lista (una línea por ítem), devolvé una línea por ítem.
- Para resaltar usá **negrita**; no uses ningún otro formato.
- Las variables entre llaves, como {cliente} o {validez_dias}, se completan después: dejalas exactamente como están.
- No inventes cifras, medidas, cantidades, precios, plazos ni nombres que no aparezcan en el texto actual o en los datos.
- No cambies condiciones comerciales ni responsabilidades salvo que la tarea lo pida.`;

const TAREA: Record<Exclude<AccionIA, "instruccion">, string> = {
  mejorar: "Mejorá la redacción para que sea más clara y profesional, sin cambiar el contenido.",
  acortar: "Hacelo más breve conservando la información importante.",
  formal: "Hacelo más formal.",
  ortografia: "Corregí solo ortografía, puntuación y gramática. No cambies nada más.",
  desde_notas: "Redactá esta sección desde cero a partir de los datos del documento (pedido del cliente, ítems y notas de la visita técnica; o, en un control de perforaciones, el balance por diámetro y las observaciones de los registros).",
};

/** Propone un texto nuevo para un bloque. No guarda nada. */
export async function proponerBloque(documentoId: string, bloqueId: string, accion: AccionIA, instruccion: string | null, textoActual: string) {
  await requirePermiso("ia", "escribir");
  if (accion === "instruccion" && !instruccion?.trim()) throw new ErrorNegocio("Escribí qué querés cambiar.");
  if (!claudeConfigurado()) throw new ErrorNegocio("La IA no está configurada (falta ANTHROPIC_API_KEY). Avisale a un administrador.");

  const ctx = await contextoParaIA(documentoId);
  const bloque = ctx.bloquesDef.find((b) => b.id === bloqueId);
  if (!bloque) throw new ErrorNegocio("Sección desconocida.");
  const config = await configIA();
  const mes = await gastoDelMes();
  if (mes.usd >= config.limiteMensualUsd) {
    throw new ErrorNegocio(`Se alcanzó el tope mensual de IA (USD ${config.limiteMensualUsd}). Un administrador puede subirlo en Ajustes → IA.`);
  }

  const datos = ctx.resumen;
  const tarea = accion === "instruccion" ? `Aplicá esta instrucción: ${instruccion!.trim().slice(0, 500)}` : TAREA[accion];
  const prompt = `Datos del documento:\n${datos}\n\nSección: ${bloque.titulo}\nTexto actual:\n<<<\n${textoActual.slice(0, 10_000)}\n>>>\n\nTarea: ${tarea}`;

  let r;
  try {
    r = await completar(config.modelo, SYSTEM, prompt);
  } catch (e) {
    if (e instanceof IARechazo) throw new ErrorNegocio(e.message);
    console.error("[ia] error", e);
    throw new ErrorNegocio("No se pudo contactar a la IA. Probá de nuevo en un momento.");
  }
  const costo = costoUsd(r.modelo, r.tokensEntrada, r.tokensSalida);
  await db.insert(iaUso).values({
    userId: ctx.usuario.id,
    funcion: `bloque.${accion}`,
    modelo: r.modelo,
    tokensEntrada: r.tokensEntrada,
    tokensSalida: r.tokensSalida,
    costoUsd: costo.toFixed(6),
    ms: r.ms,
    documentoId,
  });
  if (!r.texto) throw new ErrorNegocio("La IA no devolvió texto. Probá de nuevo.");
  return {
    texto: r.texto,
    advertencias: cifrasNuevas(r.texto, `${textoActual}\n${datos}`),
    accion: accion === "instruccion" ? "Instrucción" : ACCIONES_IA[accion],
  };
}
