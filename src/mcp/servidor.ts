import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MEDIOS } from "@/domain/cobros";
import { ELEMENTOS, TIPOS_SERVICIO, UNIDADES } from "@/domain/items";
import { ESTADOS, esFinal, type Estado } from "@/domain/workflow";
import { crearAdicional, emitirAdicional, guardarItemsAdicional, obtenerAdicional } from "@/services/adicionales";
import { agendarVisita, listarAgenda, listarJornadas } from "@/services/agenda";
import { buscar } from "@/services/busqueda";
import { balancePresupuesto, registrar } from "@/services/campo";
import { actualizarCliente, crearCliente, listarClientes, obtenerCliente } from "@/services/clientes";
import { listarCobros, registrarCobro } from "@/services/cobros";
import { crearDirector } from "@/services/directores";
import { documentoActual, documentoAdicional, guardarBloques } from "@/services/documentos";
import { ErrorNegocio } from "@/services/errores";
import { finanzasEmpresa, resumenPresupuesto } from "@/services/finanzas";
import { categorias, registrarGasto } from "@/services/gastos";
import { misNotificaciones } from "@/services/notificaciones";
import { crearObra, obtenerObra } from "@/services/obras";
import { presupuestoPorRef } from "@/services/presupuesto-acceso";
import { cambiarEstado, crearPresupuesto, emitirRevision, guardarComerciales, guardarItems, listarPresupuestos, nuevaRevision, obtenerPresupuesto } from "@/services/presupuestos";
import { ajustarStock, asignarMateriales, cerrarMateriales, devolverMateriales, listarArticulos, obtenerArticulo, registrarCompra, registrarConsumo } from "@/services/stock";

// Servidor MCP (spec/11). Cada tool es un envoltorio fino de services/: mismos permisos, mismas
// reglas y misma auditoría (source = mcp). No hay tools de eliminación (RF-MCP-07).

const app = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const linkPresupuesto = (id: string) => `${app()}/presupuestos/${id}`;

type Resultado = { content: { type: "text"; text: string }[]; isError?: boolean };

/** JSON compacto; errores de negocio en español para que la IA los explique (RF-MCP-08). */
async function responder(fn: () => Promise<unknown>): Promise<Resultado> {
  try {
    const r = await fn();
    return { content: [{ type: "text", text: JSON.stringify(r ?? { ok: true }) }] };
  } catch (e) {
    if (e instanceof ErrorNegocio || e instanceof z.ZodError) return { isError: true, content: [{ type: "text", text: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Datos inválidos.") : e.message }] };
    console.error("[mcp] error", e);
    return { isError: true, content: [{ type: "text", text: "Error inesperado del servidor. Probá de nuevo o usá la app." }] };
  }
}

const ref = z.string().describe('Presupuesto: código legible ("2026/0105") o id.');
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato AAAA-MM-DD.");
const item = z.object({
  tipoServicio: z.enum(Object.keys(TIPOS_SERVICIO) as [keyof typeof TIPOS_SERVICIO]).describe("perforacion, corte, sellado_juntas, boca_ataque, anclaje, mano_obra u otro"),
  elemento: z.enum(ELEMENTOS).nullable().default(null),
  diametroMm: z.number().positive().nullable().default(null),
  espesorCm: z.number().positive().nullable().default(null),
  unidad: z.enum(Object.keys(UNIDADES) as [keyof typeof UNIDADES]).default("u"),
  cantidad: z.number().positive(),
  precioUnitario: z.number().min(0),
  descripcion: z.string().max(300).nullable().default(null).describe("Vacío = se arma sola desde los datos del ítem."),
});
const confirmar = z.boolean().default(false).describe("true para ejecutar; sin true solo muestra qué haría.");

export function registrarHerramientas(s: McpServer) {
  // ── Consulta ────────────────────────────────────────────────────────────────
  s.registerTool("buscar", { description: "Búsqueda global por código, dirección, cliente o director.", inputSchema: z.object({ texto: z.string().min(2) }), annotations: { readOnlyHint: true } }, ({ texto }) =>
    responder(async () => (await buscar(texto)).map((r) => ({ ...r, url: `${app()}${r.href}` }))),
  );

  s.registerTool("listar_clientes", { description: "Clientes (constructoras) con su actividad.", inputSchema: z.object({}), annotations: { readOnlyHint: true } }, () => responder(() => listarClientes({ orden: "actividad" })));

  s.registerTool("obtener_cliente", { description: "Cliente con sus obras.", inputSchema: z.object({ id: z.string().uuid() }), annotations: { readOnlyHint: true } }, ({ id }) => responder(() => obtenerCliente(id)));

  s.registerTool("obtener_obra", { description: "Obra con sus presupuestos y estado.", inputSchema: z.object({ id: z.string().uuid() }), annotations: { readOnlyHint: true } }, ({ id }) => responder(() => obtenerObra(id)));

  s.registerTool(
    "listar_presupuestos",
    {
      description: "Presupuestos con filtros. Respeta el alcance del usuario (asignados) y oculta montos sin permiso.",
      inputSchema: z.object({
        estado: z.enum(Object.keys(ESTADOS) as [Estado]).optional(),
        clienteId: z.string().uuid().optional(),
        obraId: z.string().uuid().optional(),
        bonificado: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    (f) => responder(async () => (await listarPresupuestos(f)).map((p) => ({ ...p, url: linkPresupuesto(p.id) }))),
  );

  s.registerTool("obtener_presupuesto", { description: "Detalle: ítems, estado, historial, revisiones, visitas.", inputSchema: z.object({ presupuesto: ref }), annotations: { readOnlyHint: true } }, ({ presupuesto }) =>
    responder(async () => {
      const id = await presupuestoPorRef(presupuesto);
      return { ...(await obtenerPresupuesto(id)), url: linkPresupuesto(id) };
    }),
  );

  s.registerTool("obtener_balance_perforaciones", { description: "Cotizado vs ejecutado por diámetro.", inputSchema: z.object({ presupuesto: ref }), annotations: { readOnlyHint: true } }, ({ presupuesto }) =>
    responder(async () => balancePresupuesto(await presupuestoPorRef(presupuesto))),
  );

  s.registerTool(
    "obtener_resumen_economico",
    {
      description: "Resumen económico de un presupuesto, o finanzas de la empresa en un período (desde/hasta).",
      inputSchema: z.object({ presupuesto: ref.optional(), desde: fecha.optional(), hasta: fecha.optional() }),
      annotations: { readOnlyHint: true },
    },
    ({ presupuesto, desde, hasta }) =>
      responder(async () => {
        if (presupuesto) return resumenPresupuesto(await presupuestoPorRef(presupuesto));
        if (!desde || !hasta) throw new ErrorNegocio("Indicá un presupuesto, o un período con desde y hasta.");
        return finanzasEmpresa(desde, hasta);
      }),
  );

  s.registerTool("listar_cobros", { description: "Cobros esperados y recibidos de un presupuesto.", inputSchema: z.object({ presupuesto: ref }), annotations: { readOnlyHint: true } }, ({ presupuesto }) =>
    responder(async () => listarCobros(await presupuestoPorRef(presupuesto))),
  );

  s.registerTool("listar_agenda", { description: "Visitas técnicas y jornadas de trabajo entre dos fechas.", inputSchema: z.object({ desde: fecha, hasta: fecha }), annotations: { readOnlyHint: true } }, ({ desde, hasta }) =>
    responder(async () => ({
      visitas: await listarAgenda(new Date(`${desde}T00:00:00-03:00`), new Date(new Date(`${hasta}T00:00:00-03:00`).getTime() + 86_400_000)),
      jornadas: await listarJornadas(desde, hasta),
    })),
  );

  s.registerTool("listar_stock", { description: "Artículos con stock del depósito (y costo si hay permiso).", inputSchema: z.object({ texto: z.string().optional() }), annotations: { readOnlyHint: true } }, ({ texto }) =>
    responder(() => listarArticulos(texto)),
  );

  s.registerTool("obtener_articulo", { description: "Artículo con su stock en el depósito.", inputSchema: z.object({ id: z.string().uuid() }), annotations: { readOnlyHint: true } }, ({ id }) => responder(() => obtenerArticulo(id)));

  s.registerTool(
    "obtener_documento",
    { description: "Documento en borrador o emitido de un presupuesto (o de un adicional): bloques de texto editables y versión.", inputSchema: z.object({ presupuesto: ref, adicionalId: z.string().uuid().optional() }), annotations: { readOnlyHint: true } },
    ({ presupuesto, adicionalId }) =>
      responder(async () => {
        const id = await presupuestoPorRef(presupuesto);
        const r = adicionalId ? await documentoAdicional(adicionalId) : await documentoActual(id);
        return { documentoId: r.doc.id, tipo: r.doc.tipo, estado: r.doc.estado, version: r.doc.version, editable: r.editable, bloques: r.doc.bloques, url: `${linkPresupuesto(id)}/documento` };
      }),
  );

  s.registerTool("listar_notificaciones", { description: "Notificaciones del usuario (las más recientes).", inputSchema: z.object({ soloNoLeidas: z.boolean().default(true) }), annotations: { readOnlyHint: true } }, ({ soloNoLeidas }) =>
    responder(async () => (await misNotificaciones(soloNoLeidas)).map((n) => ({ titulo: n.titulo, cuerpo: n.cuerpo, fecha: n.updatedAt, url: n.link ? `${app()}${n.link}` : null }))),
  );

  // ── Escritura (sin eliminar) ────────────────────────────────────────────────
  const datosCliente = z.object({ razonSocial: z.string().min(1).max(200), cuit: z.string().nullable().default(null), telefono: z.string().nullable().default(null), email: z.string().email().nullable().default(null), notas: z.string().nullable().default(null) });
  s.registerTool("crear_cliente", { description: "Alta de cliente (constructora).", inputSchema: datosCliente }, (d) => responder(async () => ({ id: await crearCliente(d) })));
  s.registerTool("actualizar_cliente", { description: "Modifica un cliente (todos los campos).", inputSchema: datosCliente.extend({ id: z.string().uuid() }) }, ({ id, ...d }) => responder(() => actualizarCliente(id, d)));

  s.registerTool(
    "crear_director",
    { description: "Alta de director de obra.", inputSchema: z.object({ nombre: z.string().min(1), telefono: z.string().nullable().default(null), email: z.string().email().nullable().default(null), empresa: z.string().nullable().default(null), notas: z.string().nullable().default(null) }) },
    (d) => responder(async () => ({ id: await crearDirector(d) })),
  );

  s.registerTool(
    "crear_obra",
    {
      description: "Alta de obra de un cliente.",
      inputSchema: z.object({
        clienteId: z.string().uuid(),
        direccion: z.string().min(1).describe('Como se imprime: "Av. Córdoba 1234, CABA"'),
        nombre: z.string().nullable().default(null),
        localidad: z.string().nullable().default(null),
        provincia: z.string().nullable().default(null),
        directorId: z.string().uuid().nullable().default(null),
        nuevoDirector: z.string().nullable().default(null),
        hysNombre: z.string().nullable().default(null),
        notas: z.string().nullable().default(null),
      }),
    },
    ({ clienteId, ...d }) => responder(async () => ({ id: await crearObra(clienteId, d) })),
  );

  s.registerTool(
    "crear_prospecto",
    {
      description: "Nuevo presupuesto (prospecto), con o sin cliente. Con cliente se numera al crear.",
      inputSchema: z.object({
        clienteId: z.string().uuid().nullable().default(null),
        obraId: z.string().uuid().nullable().default(null),
        contactoNombre: z.string().nullable().default(null),
        contactoTelefono: z.string().nullable().default(null),
        contactoEmail: z.string().email().nullable().default(null),
        origen: z.string().nullable().default(null),
        pedido: z.string().nullable().default(null),
        requiereVisita: z.boolean().default(false),
        asignados: z.array(z.string().uuid()).default([]),
      }),
    },
    (d) =>
      responder(async () => {
        const id = await crearPresupuesto(d);
        const p = await obtenerPresupuesto(id);
        return { id, codigo: p.codigo, url: linkPresupuesto(id) };
      }),
  );

  s.registerTool(
    "actualizar_condiciones",
    {
      description: "Condiciones comerciales del borrador vigente: moneda, IVA, validez, anticipo, bonificación.",
      inputSchema: z.object({
        presupuesto: ref,
        moneda: z.enum(["ARS", "USD"]),
        tipoCambioRef: z.number().positive().nullable().default(null),
        incluyeIva: z.boolean(),
        ivaPct: z.number().min(0).max(100).default(21),
        validezDias: z.number().int().min(1),
        formaContratacion: z.string(),
        baseAjuste: z.string(),
        anticipoPct: z.number().min(0).max(100),
        bonificacion: z.object({ tipo: z.enum(["pct", "monto"]), valor: z.number().positive() }).nullable().default(null),
      }),
    },
    ({ presupuesto, ...d }) => responder(async () => guardarComerciales(await presupuestoPorRef(presupuesto), d)),
  );

  s.registerTool("guardar_items", { description: "Reemplaza los ítems del borrador vigente del presupuesto.", inputSchema: z.object({ presupuesto: ref, items: z.array(item).min(1).max(200) }) }, ({ presupuesto, items }) =>
    responder(async () => guardarItems(await presupuestoPorRef(presupuesto), items)),
  );

  s.registerTool(
    "cambiar_estado",
    {
      description: `Cambia el estado con el workflow. Estados: ${Object.keys(ESTADOS).join(", ")}. En progreso pide fechaConfirmacion; rechazo/cancelación piden motivo. A un estado final pide confirmar: true.`,
      inputSchema: z.object({ presupuesto: ref, hasta: z.enum(Object.keys(ESTADOS) as [Estado]), motivo: z.string().nullable().default(null), fechaConfirmacion: fecha.nullable().default(null), confirmar }),
    },
    ({ presupuesto, hasta, motivo, fechaConfirmacion, confirmar }) =>
      responder(async () => {
        const id = await presupuestoPorRef(presupuesto);
        const p = await obtenerPresupuesto(id);
        if (esFinal(hasta) && !confirmar) return { simulacion: true, haria: `Pasar ${p.codigo ?? "el presupuesto"} de ${ESTADOS[p.estado]} a ${ESTADOS[hasta]} (estado final).`, siguiente: "Repetí con confirmar: true." };
        await cambiarEstado(id, hasta, { motivo, fechaConfirmacion });
        return { codigo: p.codigo, estado: ESTADOS[hasta], url: linkPresupuesto(id) };
      }),
  );

  s.registerTool("crear_revision", { description: "Nueva revisión (borrador R+1) copiando los ítems de la emitida.", inputSchema: z.object({ presupuesto: ref }) }, ({ presupuesto }) =>
    responder(async () => nuevaRevision(await presupuestoPorRef(presupuesto))),
  );

  s.registerTool(
    "crear_adicional",
    { description: "Nuevo trabajo adicional (ADn) de un presupuesto En progreso, opcionalmente con ítems.", inputSchema: z.object({ presupuesto: ref, items: z.array(item).max(200).default([]) }) },
    ({ presupuesto, items }) =>
      responder(async () => {
        const id = await crearAdicional(await presupuestoPorRef(presupuesto));
        if (items.length) await guardarItemsAdicional(id, items);
        const a = await obtenerAdicional(id);
        return { adicionalId: id, codigo: a.codigo };
      }),
  );

  s.registerTool(
    "agendar_visita",
    {
      description: "Agenda una visita técnica.",
      inputSchema: z.object({
        presupuesto: ref,
        inicio: z.string().datetime({ offset: true }).nullable().default(null).describe("ISO con zona, ej. 2026-10-14T10:00:00-03:00; null = pendiente de fecha"),
        duracionMin: z.number().int().min(15).default(60),
        direccion: z.string().nullable().default(null),
        contactoSitio: z.string().nullable().default(null),
        notasPrevias: z.string().nullable().default(null),
        responsables: z.array(z.string().uuid()).default([]),
      }),
    },
    ({ presupuesto, inicio, ...d }) => responder(async () => ({ visitaId: await agendarVisita(await presupuestoPorRef(presupuesto), { ...d, inicio: inicio ? new Date(inicio) : null }) })),
  );

  s.registerTool(
    "editar_bloque_documento",
    { description: "Reemplaza el texto de un bloque del documento en borrador (crea una versión con origen mcp). Usá **negrita** y una línea por párrafo.", inputSchema: z.object({ documentoId: z.string().uuid(), bloque: z.string(), texto: z.string().max(10_000) }) },
    ({ documentoId, bloque, texto }) => responder(async () => ({ version: await guardarBloques(documentoId, { [bloque]: texto }, "mcp") })),
  );

  s.registerTool(
    "emitir_documento",
    {
      description: "Emite el presupuesto (revisión vigente) o un adicional: numera, genera DOCX y PDF. Requiere confirmar: true.",
      inputSchema: z.object({ presupuesto: ref, adicionalId: z.string().uuid().optional(), confirmar }),
    },
    ({ presupuesto, adicionalId, confirmar }) =>
      responder(async () => {
        const id = await presupuestoPorRef(presupuesto);
        if (!confirmar) {
          const p = await obtenerPresupuesto(id);
          return { simulacion: true, haria: adicionalId ? "Emitir el adicional (pasa a Enviado y queda inmutable)." : `Emitir ${p.codigo ?? "el presupuesto"} con ${p.items.length} ítems (queda inmutable).`, siguiente: "Repetí con confirmar: true." };
        }
        return { emitido: adicionalId ? await emitirAdicional(adicionalId) : await emitirRevision(id), url: linkPresupuesto(id) };
      }),
  );

  s.registerTool(
    "registrar_perforacion",
    {
      description: "Registro de campo (sin fotos; las fotos se suben desde la app).",
      inputSchema: z.object({
        presupuesto: ref,
        fecha,
        operarios: z.array(z.string().uuid()).min(1),
        piso: z.string().min(1),
        elemento: z.enum(ELEMENTOS),
        diametroMm: z.number().positive(),
        espesorCm: z.number().positive().nullable().default(null),
        cantidad: z.number().int().min(1),
        estado: z.enum(["finalizado", "parcial", "con_observacion"]).default("finalizado"),
        observacion: z.string().nullable().default(null),
      }),
    },
    ({ presupuesto, ...d }) => responder(async () => registrar(await presupuestoPorRef(presupuesto), crypto.randomUUID(), { ...d, itemId: null })),
  );

  s.registerTool(
    "registrar_gasto",
    {
      description: `Gasto de un presupuesto o general (presupuesto: null). Categorías: se listan con categoriaNombre.`,
      inputSchema: z.object({ presupuesto: ref.nullable().default(null), fecha, categoria: z.string().describe("Nombre de la categoría, ej. Combustible"), descripcion: z.string().min(1), importe: z.number().positive(), moneda: z.enum(["ARS", "USD"]).default("ARS"), tipoCambio: z.number().positive().nullable().default(null) }),
    },
    ({ presupuesto, categoria, ...d }) =>
      responder(async () => {
        const cats = await categorias();
        const c = cats.find((x) => x.nombre.toLowerCase() === categoria.toLowerCase());
        if (!c) throw new ErrorNegocio(`Categoría desconocida. Opciones: ${cats.map((x) => x.nombre).join(", ")}.`);
        return { gastoId: await registrarGasto({ ...d, presupuestoId: presupuesto ? await presupuestoPorRef(presupuesto) : null, categoriaId: c.id }) };
      }),
  );

  s.registerTool(
    "registrar_cobro",
    {
      description: "Cobro recibido, imputado a un cobro esperado (ver listar_cobros) u 'otro concepto'.",
      inputSchema: z.object({
        presupuesto: ref,
        cobroEsperadoId: z.string().uuid().nullable().default(null),
        descripcionOtro: z.string().nullable().default(null),
        fecha,
        importe: z.number().positive(),
        monedaRecibida: z.enum(["ARS", "USD"]),
        tipoCambio: z.number().positive().nullable().default(null),
        medio: z.enum(Object.keys(MEDIOS) as [keyof typeof MEDIOS]),
        referencia: z.string().nullable().default(null),
      }),
    },
    ({ presupuesto, ...d }) => responder(async () => registrarCobro(await presupuestoPorRef(presupuesto), d)),
  );

  s.registerTool(
    "registrar_compra",
    {
      description: "Compra de stock al depósito o directa a una obra (destinoPresupuesto). Líneas con artículo existente o nuevo.",
      inputSchema: z.object({
        fecha,
        proveedorNuevo: z.string().nullable().default(null),
        proveedorId: z.string().uuid().nullable().default(null),
        destinoPresupuesto: ref.nullable().default(null),
        moneda: z.enum(["ARS", "USD"]).default("ARS"),
        tipoCambio: z.number().positive().nullable().default(null),
        lineas: z
          .array(
            z.object({
              articuloId: z.string().uuid().nullable().default(null),
              nuevo: z.object({ nombre: z.string(), categoria: z.string(), unidad: z.string().default("u") }).nullable().default(null),
              cantidad: z.number().positive(),
              precioUnitario: z.number().min(0),
            }),
          )
          .min(1),
      }),
    },
    ({ destinoPresupuesto, ...d }) => responder(async () => ({ compraId: await registrarCompra({ ...d, destinoPresupuestoId: destinoPresupuesto ? await presupuestoPorRef(destinoPresupuesto) : null }) })),
  );

  s.registerTool(
    "mover_stock",
    {
      description: "Asignación (depósito → obra), devolución (obra → depósito), consumo (en obra) o ajuste del depósito (± con motivo).",
      inputSchema: z.object({ tipo: z.enum(["asignacion", "devolucion", "consumo", "ajuste"]), articuloId: z.string().uuid(), cantidad: z.number().refine((n) => n !== 0), presupuesto: ref.nullable().default(null), motivo: z.string().nullable().default(null) }),
    },
    ({ tipo, articuloId, cantidad, presupuesto, motivo }) =>
      responder(async () => {
        if (tipo === "ajuste") return ajustarStock(articuloId, "ajuste", cantidad, motivo ?? "");
        if (!presupuesto) throw new ErrorNegocio("Indicá el presupuesto.");
        const id = await presupuestoPorRef(presupuesto);
        const linea = { articuloId, cantidad: Math.abs(cantidad) };
        if (tipo === "asignacion") return asignarMateriales(id, [linea]);
        if (tipo === "devolucion") return devolverMateriales(id, [linea], motivo);
        return registrarConsumo(id, linea);
      }),
  );

  s.registerTool(
    "cerrar_materiales",
    { description: "Cierre de materiales: por artículo en obra, cuánto se consumió y cuánto vuelve al depósito (suman el saldo).", inputSchema: z.object({ presupuesto: ref, lineas: z.array(z.object({ articuloId: z.string().uuid(), consumido: z.number().min(0), devuelto: z.number().min(0), nota: z.string().nullable().default(null) })) }) },
    ({ presupuesto, lineas }) => responder(async () => cerrarMateriales(await presupuestoPorRef(presupuesto), lineas)),
  );

  // ── Prompts ─────────────────────────────────────────────────────────────────
  s.registerPrompt("resumen_semanal", { description: "Estado de presupuestos, cobros pendientes y agenda de la semana." }, () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Armame un resumen de la semana de PAS: 1) presupuestos En espera, En progreso y Pendiente liquidación (listar_presupuestos por estado); 2) cobros pendientes por antigüedad (obtener_resumen_economico del mes); 3) visitas y jornadas de los próximos 7 días (listar_agenda). Breve, en viñetas, con los códigos y links.",
        },
      },
    ],
  }));

  s.registerPrompt("preparar_presupuesto", { description: "Guía para crear un prospecto, cargar ítems y dejar el documento listo." }, () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Ayudame a preparar un presupuesto de PAS paso a paso: buscá el cliente y la obra (buscar), creá el prospecto (crear_prospecto), cargá los ítems (guardar_items: perforaciones con Ø, elemento, espesor, cantidad y precio), revisá condiciones (actualizar_condiciones), mostrame los textos del documento (obtener_documento) y proponé mejoras con editar_bloque_documento. No emitas sin que te lo confirme.",
        },
      },
    ],
  }));
}
