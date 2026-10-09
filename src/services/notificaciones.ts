import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificaciones, preferenciasUsuario, presupuestoAsignados, pushSuscripciones, roles, user, userRoles } from "@/db/schema";
import { AGRUPAR_MS, canales, CATEGORIAS, tituloAgrupado, type Preferencias, type TipoEvento } from "@/domain/notificaciones";
import { enviarEmail } from "@/lib/email";
import { enviarPush } from "@/lib/push";
import { requireUsuario } from "./sesion";

// Notificaciones (spec/09). In-app siempre; push y email según preferencias. Nunca rompe el flujo
// que la dispara: los errores se registran y el email se reintenta en el cron.

const appUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export type Aviso = {
  tipo: TipoEvento;
  titulo: string;
  cuerpo?: string | null;
  link?: string | null;
  entidadTipo?: string;
  entidadId?: string;
};

/** Destinatarios de un evento de presupuesto: asignados + administradores (+ roles extra), sin el autor (RF-NOT-02). */
export async function destinatarios(o: { presupuestoId?: string; usuarios?: string[]; roles?: string[]; actorId?: string | null; sinAdmins?: boolean }) {
  const ids = new Set(o.usuarios ?? []);
  if (o.presupuestoId) {
    for (const a of await db.select({ id: presupuestoAsignados.userId }).from(presupuestoAsignados).where(eq(presupuestoAsignados.presupuestoId, o.presupuestoId))) ids.add(a.id);
  }
  if (!o.sinAdmins || o.roles?.length) {
    const filas = await db
      .select({ id: user.id, sistema: roles.esSistema, rol: roles.nombre })
      .from(user)
      .innerJoin(userRoles, eq(userRoles.userId, user.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(user.activo, true));
    for (const f of filas) if ((!o.sinAdmins && f.sistema) || o.roles?.includes(f.rol)) ids.add(f.id);
  }
  if (o.actorId) ids.delete(o.actorId);
  return [...ids];
}

/** Crea la notificación para cada usuario (agrupando repetidas en 10 min) y la envía por sus canales. */
export async function notificar(usuarios: string[], aviso: Aviso, opciones: { emailEnResumen?: boolean } = {}) {
  if (!usuarios.length) return;
  try {
    const [prefs, activos] = await Promise.all([
      db.select().from(preferenciasUsuario).where(inArray(preferenciasUsuario.userId, usuarios)),
      db.select({ id: user.id }).from(user).where(and(inArray(user.id, usuarios), eq(user.activo, true))),
    ]);
    const desde = new Date(Date.now() - AGRUPAR_MS);
    for (const { id: userId } of activos) {
      const extra = canales(aviso.tipo, prefs.find((p) => p.userId === userId)?.notificaciones as Preferencias | undefined);
      const [previa] = aviso.entidadId
        ? await db
            .select()
            .from(notificaciones)
            .where(
              and(
                eq(notificaciones.userId, userId),
                eq(notificaciones.tipo, aviso.tipo),
                eq(notificaciones.entidadId, aviso.entidadId),
                isNull(notificaciones.leidaAt),
                gte(notificaciones.updatedAt, desde),
              ),
            )
            .limit(1)
        : [];
      if (previa) {
        // Agrupada: no se vuelve a mandar push ni email.
        await db.update(notificaciones).set({ agrupadaCount: previa.agrupadaCount + 1, cuerpo: aviso.cuerpo ?? previa.cuerpo, updatedAt: new Date() }).where(eq(notificaciones.id, previa.id));
        continue;
      }
      const [n] = await db
        .insert(notificaciones)
        .values({ userId, ...aviso, emailEstado: extra.includes("email") ? "pendiente" : null })
        .returning();
      if (extra.includes("push")) await pushA(userId, aviso);
      // Los recordatorios del cron van juntos en un email por usuario (spec/09 §4.6).
      if (extra.includes("email") && !opciones.emailEnResumen) await enviarPorEmail(n.id);
    }
  } catch (e) {
    console.error("[notificaciones] no se pudo notificar", aviso.tipo, e);
  }
}

/** Atajo: evento de un presupuesto para asignados + admins. */
export async function notificarPresupuesto(presupuestoId: string, actorId: string | null, aviso: Aviso, extra: { roles?: string[] } = {}) {
  await notificar(await destinatarios({ presupuestoId, actorId, roles: extra.roles }), { entidadTipo: "presupuesto", entidadId: presupuestoId, link: `/presupuestos/${presupuestoId}`, ...aviso });
}

async function pushA(userId: string, aviso: Aviso) {
  const subs = await db.select().from(pushSuscripciones).where(eq(pushSuscripciones.userId, userId));
  for (const s of subs) {
    const r = await enviarPush(s, { titulo: aviso.titulo, cuerpo: aviso.cuerpo, link: aviso.link });
    if (r === "vencida") await db.delete(pushSuscripciones).where(eq(pushSuscripciones.id, s.id));
  }
}

async function enviarPorEmail(notificacionId: string) {
  const [n] = await db.select({ n: notificaciones, email: user.email }).from(notificaciones).innerJoin(user, eq(user.id, notificaciones.userId)).where(eq(notificaciones.id, notificacionId));
  if (!n) return;
  try {
    await enviarEmail(n.email, n.n.titulo, {
      categoria: "Notificación",
      titulo: n.n.titulo,
      parrafos: n.n.cuerpo ? [n.n.cuerpo] : [],
      ...(n.n.link ? { boton: { texto: "Ver en PAS Backoffice", url: `${appUrl()}${n.n.link}` } } : {}),
    });
    await db.update(notificaciones).set({ emailEstado: "enviado", emailIntentos: n.n.emailIntentos + 1 }).where(eq(notificaciones.id, notificacionId));
  } catch (e) {
    console.error("[notificaciones] email falló", e);
    await db.update(notificaciones).set({ emailEstado: "error", emailIntentos: n.n.emailIntentos + 1 }).where(eq(notificaciones.id, notificacionId));
  }
}

/** Un email por usuario con sus recordatorios pendientes del día (los del cron). */
export async function enviarResumenDiario(desde: Date) {
  const pendientes = await db
    .select({ n: notificaciones, email: user.email, nombre: user.name })
    .from(notificaciones)
    .innerJoin(user, eq(user.id, notificaciones.userId))
    .where(and(eq(notificaciones.emailEstado, "pendiente"), gte(notificaciones.createdAt, desde)));
  const porUsuario = Map.groupBy(pendientes, (p) => p.n.userId);
  for (const lista of porUsuario.values()) {
    const ids = lista.map((x) => x.n.id);
    try {
      await enviarEmail(lista[0].email, `Tus recordatorios de hoy (${lista.length})`, {
        categoria: "Resumen diario",
        titulo: "Recordatorios de hoy",
        parrafos: lista.map((x) => `• ${x.n.titulo}${x.n.cuerpo ? ` — ${x.n.cuerpo}` : ""}`),
        boton: { texto: "Ver en PAS Backoffice", url: `${appUrl()}/notificaciones` },
      });
      await db.update(notificaciones).set({ emailEstado: "enviado", emailIntentos: sql`${notificaciones.emailIntentos} + 1` }).where(inArray(notificaciones.id, ids));
    } catch (e) {
      console.error("[notificaciones] resumen diario falló", e);
      await db.update(notificaciones).set({ emailEstado: "error", emailIntentos: sql`${notificaciones.emailIntentos} + 1` }).where(inArray(notificaciones.id, ids));
    }
  }
  return porUsuario.size;
}

/** RF-NOT-07: reintenta emails fallidos (máximo 3 intentos). Lo llama el cron. */
export async function reintentarEmails() {
  const pendientes = await db
    .select({ id: notificaciones.id })
    .from(notificaciones)
    .where(and(inArray(notificaciones.emailEstado, ["pendiente", "error"]), lt(notificaciones.emailIntentos, 3)));
  for (const p of pendientes) await enviarPorEmail(p.id);
  return pendientes.length;
}

// ── Del usuario ───────────────────────────────────────────────────────────────

export async function noLeidas() {
  const u = await requireUsuario();
  const [r] = await db.select({ n: count() }).from(notificaciones).where(and(eq(notificaciones.userId, u.id), isNull(notificaciones.leidaAt)));
  return r.n;
}

export async function misNotificaciones(soloNoLeidas = false, rango: { limite?: number; desde?: number } = {}) {
  const u = await requireUsuario();
  return db
    .select()
    .from(notificaciones)
    .where(and(eq(notificaciones.userId, u.id), soloNoLeidas ? isNull(notificaciones.leidaAt) : undefined))
    .orderBy(desc(notificaciones.updatedAt))
    .limit(rango.limite ?? 100)
    .offset(rango.desde ?? 0)
    .then((ns) => ns.map((n) => ({ ...n, titulo: tituloAgrupado(n.titulo, n.agrupadaCount) })));
}

export async function marcarLeidas(ids: string[] | "todas") {
  const u = await requireUsuario();
  await db
    .update(notificaciones)
    .set({ leidaAt: new Date() })
    .where(and(eq(notificaciones.userId, u.id), isNull(notificaciones.leidaAt), ids === "todas" ? undefined : inArray(notificaciones.id, ids)));
}

export async function misPreferencias(): Promise<Preferencias> {
  const u = await requireUsuario();
  const [p] = await db.select().from(preferenciasUsuario).where(eq(preferenciasUsuario.userId, u.id));
  return (p?.notificaciones as Preferencias | undefined) ?? {};
}

export async function guardarPreferencias(p: Preferencias) {
  const u = await requireUsuario();
  const limpias = Object.fromEntries(Object.entries(p).filter(([k]) => k in CATEGORIAS));
  await db.insert(preferenciasUsuario).values({ userId: u.id, notificaciones: limpias }).onConflictDoUpdate({ target: preferenciasUsuario.userId, set: { notificaciones: limpias } });
}

export async function suscribirPush(s: { endpoint: string; p256dh: string; auth: string; userAgent: string | null }) {
  const u = await requireUsuario();
  await db
    .insert(pushSuscripciones)
    .values({ userId: u.id, ...s })
    .onConflictDoUpdate({ target: pushSuscripciones.endpoint, set: { userId: u.id, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent } });
}

export async function desuscribirPush(endpoint: string) {
  const u = await requireUsuario();
  await db.delete(pushSuscripciones).where(and(eq(pushSuscripciones.endpoint, endpoint), eq(pushSuscripciones.userId, u.id)));
}

