import "server-only";
import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  articulos,
  configuracion,
  estadoHistorial,
  jornadaOperarios,
  jornadas,
  mcpUso,
  presupuestoRevisiones,
  presupuestos,
  recordatoriosEnviados,
  registrosCampo,
  stockMovimientos,
  visitaResponsables,
  visitas,
} from "@/db/schema";
import { codigoPresupuesto } from "@/domain/codigos";
import { DEPOSITO } from "@/domain/stock";
import { limpiarPendientes } from "./almacenamiento";
import { situacionDePagos } from "./cobros";
import { destinatarios, enviarResumenDiario, notificar, reintentarEmails } from "./notificaciones";
import { requirePermiso } from "./sesion";
import { auditar } from "./auditoria";

// Cron diario (spec/09 RF-NOT-06): 08:00 hora Argentina. Idempotente: cada recordatorio se
// registra como (tipo, entidad, fecha) y no se repite el mismo día.

const TZ = "America/Argentina/Buenos_Aires";
const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const hora = new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone: TZ });
const cod = (p: { anio: number | null; numero: number | null }) => (p.anio && p.numero ? codigoPresupuesto(p.anio, p.numero) : "sin numerar");
const DIA_MS = 86_400_000;

export type ConfigRecordatorios = { enEsperaDias: number; anticipoDias: number; liquidacionDias: number };
const DEFAULTS: ConfigRecordatorios = { enEsperaDias: 7, anticipoDias: 7, liquidacionDias: 15 };
const CLAVE = "recordatorios";

export async function configRecordatorios(): Promise<ConfigRecordatorios> {
  const [r] = await db.select().from(configuracion).where(eq(configuracion.clave, CLAVE));
  return { ...DEFAULTS, ...(r?.valor as Partial<ConfigRecordatorios> | undefined) };
}

export async function guardarConfigRecordatorios(c: ConfigRecordatorios) {
  const { usuario } = await requirePermiso("configuracion", "escribir");
  await db.insert(configuracion).values({ clave: CLAVE, valor: c }).onConflictDoUpdate({ target: configuracion.clave, set: { valor: c, updatedAt: new Date() } });
  await auditar({ actorUserId: usuario.id, action: "configuracion.recordatorios", entityType: "configuracion", entityId: CLAVE, diff: c });
}

/** true la primera vez en el día para (tipo, entidad). */
async function primeraVez(tipo: string, entidadId: string, fecha: string) {
  const r = await db.insert(recordatoriosEnviados).values({ tipo, entidadId, fecha }).onConflictDoNothing().returning({ tipo: recordatoriosEnviados.tipo });
  return r.length > 0;
}

/** Días transcurridos (hora Argentina) desde `desde`. Se recuerda cada N días: N, 2N, 3N… */
const cadaN = (desde: Date, ahora: Date, n: number) => {
  const dias = Math.floor((new Date(dia(ahora)).getTime() - new Date(dia(desde)).getTime()) / DIA_MS);
  return { dias, toca: n > 0 && dias > 0 && dias % n === 0 };
};

export async function ejecutarCronDiario(ahora = new Date()) {
  const hoy = dia(ahora);
  const manana = dia(new Date(ahora.getTime() + DIA_MS));
  const inicio = new Date(ahora.getTime() - 5 * 60_000); // para el resumen por email
  const cfg = await configRecordatorios();
  const hechos: Record<string, number> = {};
  const contar = (k: string) => (hechos[k] = (hechos[k] ?? 0) + 1);
  const opciones = { emailEnResumen: true };

  // Visitas de hoy y de mañana → responsables.
  const vs = await db
    .select({ v: visitas, anio: presupuestos.anio, numero: presupuestos.numero })
    .from(visitas)
    .innerJoin(presupuestos, eq(presupuestos.id, visitas.presupuestoId))
    .where(and(eq(visitas.estado, "agendada"), gte(visitas.inicio, new Date(`${hoy}T00:00:00-03:00`)), lt(visitas.inicio, new Date(new Date(`${manana}T00:00:00-03:00`).getTime() + DIA_MS))));
  for (const { v, ...p } of vs) {
    if (!v.inicio || !(await primeraVez("recordatorio_visita", v.id, hoy))) continue;
    const cuando = dia(v.inicio) === hoy ? "hoy" : "mañana";
    const resp = (await db.select({ id: visitaResponsables.userId }).from(visitaResponsables).where(eq(visitaResponsables.visitaId, v.id))).map((r) => r.id);
    await notificar(resp, { tipo: "recordatorio_visita", titulo: `Visita técnica ${cuando} ${hora.format(v.inicio)} · ${cod(p)}`, cuerpo: v.direccion, link: "/agenda", entidadTipo: "visita", entidadId: v.id }, opciones);
    contar("visitas");
  }

  // Jornadas de mañana → operarios.
  const js = await db
    .select({ j: jornadas, anio: presupuestos.anio, numero: presupuestos.numero })
    .from(jornadas)
    .innerJoin(presupuestos, eq(presupuestos.id, jornadas.presupuestoId))
    .where(eq(jornadas.fecha, manana));
  for (const { j, ...p } of js) {
    if (!(await primeraVez("recordatorio_jornada", j.id, hoy))) continue;
    const ops = (await db.select({ id: jornadaOperarios.userId }).from(jornadaOperarios).where(eq(jornadaOperarios.jornadaId, j.id))).map((o) => o.id);
    await notificar(ops, { tipo: "recordatorio_jornada", titulo: `Mañana: jornada de trabajo en ${cod(p)}`, cuerpo: j.notas, link: `/campo/${j.presupuestoId}`, entidadTipo: "jornada", entidadId: j.id }, opciones);
    contar("jornadas");
  }

  // Presupuestos En espera: oferta vencida y sin respuesta.
  const enEspera = await db.select().from(presupuestos).where(and(eq(presupuestos.estado, "en_espera"), isNull(presupuestos.deletedAt)));
  for (const p of enEspera) {
    const [rev] = await db
      .select({ emitidaAt: presupuestoRevisiones.emitidaAt })
      .from(presupuestoRevisiones)
      .where(and(eq(presupuestoRevisiones.presupuestoId, p.id), eq(presupuestoRevisiones.estado, "emitida")));
    const vence = rev?.emitidaAt ? new Date(rev.emitidaAt.getTime() + p.validezDias * DIA_MS) : null;
    // Una sola vez: el día siguiente al vencimiento.
    if (vence && dia(new Date(vence.getTime() + DIA_MS)) === hoy && (await primeraVez("oferta_vencida", p.id, hoy))) {
      await notificar(await destinatarios({ presupuestoId: p.id }), { tipo: "oferta_vencida", titulo: `Venció la oferta de ${cod(p)}`, link: `/presupuestos/${p.id}`, entidadTipo: "presupuesto", entidadId: p.id }, opciones);
      contar("oferta_vencida");
    }
    const [h] = await db.select({ at: estadoHistorial.at }).from(estadoHistorial).where(and(eq(estadoHistorial.presupuestoId, p.id), eq(estadoHistorial.hasta, "en_espera"))).orderBy(sql`${estadoHistorial.at} desc`).limit(1);
    const t = h ? cadaN(h.at, ahora, cfg.enEsperaDias) : null;
    if (t?.toca && (await primeraVez("en_espera_sin_respuesta", p.id, hoy))) {
      await notificar(await destinatarios({ presupuestoId: p.id }), { tipo: "en_espera_sin_respuesta", titulo: `${cod(p)} lleva ${t.dias} días En espera sin respuesta`, link: `/presupuestos/${p.id}`, entidadTipo: "presupuesto", entidadId: p.id }, opciones);
      contar("en_espera");
    }
  }

  // Cobros: anticipo pendiente (En progreso) y saldo pendiente (Pendiente liquidación).
  const enCobro = await db.select().from(presupuestos).where(and(inArray(presupuestos.estado, ["en_progreso", "pendiente_liquidacion"]), isNull(presupuestos.deletedAt)));
  const administracion = await destinatarios({ roles: ["Administración"] });
  for (const p of enCobro) {
    const sit = await situacionDePagos(p.id);
    if (p.estado === "en_progreso") {
      const anticipo = sit.esperados.find((e) => e.concepto === "anticipo" && !e.adicionalId);
      const desde = p.fechaConfirmacion ? new Date(`${p.fechaConfirmacion}T12:00:00-03:00`) : null;
      const t = desde ? cadaN(desde, ahora, cfg.anticipoDias) : null;
      if (anticipo && anticipo.estado !== "abonado" && t?.toca && (await primeraVez("anticipo_pendiente", p.id, hoy))) {
        await notificar(administracion, { tipo: "anticipo_pendiente", titulo: `Anticipo pendiente en ${cod(p)} (${t.dias} días de iniciado)`, link: `/presupuestos/${p.id}`, entidadTipo: "presupuesto", entidadId: p.id }, opciones);
        contar("anticipo");
      }
    } else {
      const [h] = await db.select({ at: estadoHistorial.at }).from(estadoHistorial).where(and(eq(estadoHistorial.presupuestoId, p.id), eq(estadoHistorial.hasta, "pendiente_liquidacion"))).orderBy(sql`${estadoHistorial.at} desc`).limit(1);
      const t = h ? cadaN(h.at, ahora, cfg.liquidacionDias) : null;
      if (sit.porCobrar > 0 && t?.toca && (await primeraVez("saldo_pendiente", p.id, hoy))) {
        await notificar(administracion, { tipo: "saldo_pendiente", titulo: `${cod(p)}: saldo pendiente hace ${t.dias} días`, link: `/presupuestos/${p.id}`, entidadTipo: "presupuesto", entidadId: p.id }, opciones);
        contar("saldo");
      }
    }
  }

  // Stock bajo mínimo: un aviso diario con todos los artículos.
  const bajos = await db.execute<{ nombre: string; stock: string; minimo: string }>(sql`
    select a.nombre, coalesce(sum(case when m.hacia = ${DEPOSITO} then m.cantidad when m.desde = ${DEPOSITO} then -m.cantidad else 0 end), 0) as stock, a.stock_minimo as minimo
    from ${articulos} a left join ${stockMovimientos} m on m.articulo_id = a.id
    where a.activo and a.stock_minimo is not null
    group by a.id having coalesce(sum(case when m.hacia = ${DEPOSITO} then m.cantidad when m.desde = ${DEPOSITO} then -m.cantidad else 0 end), 0) < a.stock_minimo`);
  if (bajos.length && (await primeraVez("stock_bajo", "deposito", hoy))) {
    await notificar(administracion, { tipo: "stock_bajo", titulo: `${bajos.length} ${bajos.length === 1 ? "artículo" : "artículos"} bajo el stock mínimo`, cuerpo: bajos.map((b) => b.nombre).join(", "), link: "/stock", entidadTipo: "stock", entidadId: "deposito" }, opciones);
    contar("stock");
  }

  // Día 1: emitir el Reporte Mensual de cada obra con actividad el mes anterior (RF-DOC-08).
  if (hoy.endsWith("-01")) {
    const anterior = new Date(`${hoy}T12:00:00-03:00`);
    anterior.setUTCMonth(anterior.getUTCMonth() - 1);
    const mes = dia(anterior).slice(0, 7);
    const activas = await db
      .selectDistinct({ id: presupuestos.id, anio: presupuestos.anio, numero: presupuestos.numero })
      .from(presupuestos)
      .leftJoin(registrosCampo, eq(registrosCampo.presupuestoId, presupuestos.id))
      .leftJoin(jornadas, eq(jornadas.presupuestoId, presupuestos.id))
      .where(sql`to_char(${registrosCampo.fecha}, 'YYYY-MM') = ${mes} or to_char(${jornadas.fecha}, 'YYYY-MM') = ${mes}`);
    for (const p of activas) {
      if (!(await primeraVez("reporte_mensual", p.id, hoy))) continue;
      await notificar(await destinatarios({ presupuestoId: p.id }), { tipo: "reporte_mensual", titulo: `Emitir el Reporte Mensual de ${cod(p)} (${mes})`, link: `/presupuestos/${p.id}/reportes`, entidadTipo: "presupuesto", entidadId: p.id }, opciones);
      contar("reporte_mensual");
    }
  }

  const resumenes = await enviarResumenDiario(inicio);
  const reintentos = await reintentarEmails();
  await db.delete(mcpUso).where(lt(mcpUso.minuto, new Date(ahora.getTime() - DIA_MS))); // contadores del rate limit MCP
  const archivos = await limpiarPendientes().catch((e) => (console.error("[cron] limpiar subidas", e), 0));
  return { fecha: hoy, recordatorios: hechos, resumenes, reintentos, archivosLiberados: archivos };
}
