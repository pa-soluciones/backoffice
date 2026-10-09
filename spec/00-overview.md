# PAS Backoffice — Visión general

> Aplicación web (mobile + desktop) para gestionar de punta a punta los trabajos de **PAS – Piedra Angular Solutions**: prospectos, presupuestos, adicionales, documentación de obra, stock, gastos, cobros y seguimiento. Incluye asistencia de IA para redactar y un servidor MCP para que una IA externa opere la aplicación.

## 1. Contexto

PAS realiza cortes y perforaciones en hormigón armado con tecnología diamantada (CABA y GBA). Hoy los documentos se arman a mano en Word, copiando datos sensibles (ID de presupuesto, cliente, dirección, montos) entre archivos. Eso genera errores y la información queda dispersa.

**Objetivo:** cargar los datos una sola vez y que todos los documentos se generen a partir de ellos, con vista previa editable (asistida por IA), historial de versiones y todo centralizado.

## 2. Índice de specs

| # | Archivo | Contenido |
|---|---|---|
| 00 | `00-overview.md` | Este documento: alcance, glosario, decisiones |
| 01 | `01-arquitectura.md` | Stack, infraestructura, límites del free tier, estructura del código |
| 02 | `02-diseno-ui.md` | Design tokens, layout mobile/desktop, navegación, componentes |
| 03 | `03-auth-permisos.md` | Admin inicial, login, 2FA, recuperación, roles, permisos, auditoría |
| 04 | `04-clientes-obras.md` | Clientes, directores de obra, obras, explorador, buscador |
| 05 | `05-presupuestos-workflow.md` | Presupuesto, numeración, revisiones, adicionales, estados, agenda |
| 06 | `06-documentos.md` | Generación DOCX/PDF, plantillas, vista previa, versiones, firmas, anexos |
| 07 | `07-control-perforaciones.md` | Registro de campo, fotos, balance cotizado vs ejecutado |
| 08 | `08-stock-gastos-cobros.md` | Inventario, compras, consumos, gastos, cobros, resumen ingresos/egresos |
| 09 | `09-notificaciones.md` | In-app, push, email (Resend), recordatorios |
| 10 | `10-ia.md` | Proveedores, casos de uso, límites |
| 11 | `11-mcp.md` | Servidor MCP: auth, tools, reglas |
| 12 | `12-no-funcionales.md` | Offline/PWA, seguridad, performance, backups, i18n |
| 13 | `13-modelo-datos.md` | Tablas y relaciones |
| 14 | `14-roadmap.md` | Fases de entrega y criterios de aceptación |
| — | `email/` | Plantillas HTML de email con diseño PAS |
| — | `templates/` | Word originales (fuente de las plantillas de documentos) |
| — | `assets/` | Logos oficiales extraídos de pasoluciones.com.ar |

Convención de requisitos: `RF-<MÓDULO>-<nn>` (funcional), `RNF-<nn>` (no funcional). Prioridad: **[M]** must (v1), **[S]** should (v1 si da el tiempo), **[C]** could (posterior).

## 3. Glosario

| Término | Definición |
|---|---|
| **Cliente / Contratista** | Empresa que contrata a PAS. Se identifica por razón social. En la app, cliente = contratista. |
| **Director de Obra** | Persona responsable de la obra del lado del cliente. Entidad reutilizable entre obras. |
| **Obra** | Lugar físico (dirección) de un cliente donde se ejecutan trabajos. Contiene 1..n presupuestos. |
| **Prospecto** | Presupuesto en su estado inicial: alguien pidió cotización. Puede ser anónimo (sin cliente). |
| **Presupuesto** | Unidad de trabajo y de seguimiento. Tiene ID `AAAA/NNNN`, ítems, estado, documentos, gastos y cobros. |
| **Revisión** | Re-emisión de un presupuesto con cambios: `2026/0105 R1`, `R2`… |
| **Adicional** | Trabajo extra cotizado sobre un presupuesto: `2026/0105-AD1`, `AD2`… |
| **Certificación** | Documento que certifica avance (parcial) o final de trabajos y situación de pagos. |
| **Control de Perforaciones** | Registro de lo ejecutado (con fotos) y balance contra lo cotizado. |
| **Reporte Mensual Estadístico** | Reporte de Higiene y Seguridad por obra y mes (trabajadores, accidentes, días). |
| **Bonificación** | Descuento comercial aplicado a un presupuesto (marca "Bonificado"). |
| **Anticipo** | Pago inicial (40% por defecto) al confirmar el trabajo. |
| **Saldo** | Resto del pago, contra finalización. |
| **Anexo** | Archivo adjunto (foto, PDF, plano) asociado a un presupuesto/obra. |

## 4. Alcance

### v1 (incluido)
- Usuarios, roles, permisos por módulo (leer/escribir/eliminar) con alcance (todos / solo asignados), 2FA, auditoría.
- Clientes, directores de obra, obras, explorador tipo carpetas, buscador global.
- Presupuestos con workflow de estados, numeración anual, revisiones, adicionales, bonificación, agenda de visitas técnicas.
- Documentos: Presupuesto, Adicional, Certificación de Obra, Certificación de Adicional, Control de Perforaciones, Reporte Mensual. Vista previa editable, IA para párrafos, versiones, DOCX + PDF, firma por imagen.
- Anexos con optimización de imágenes.
- Stock general con asignación/consumo por presupuesto, compras, proveedores opcionales, gastos, cobros (anticipo/saldo), resumen ingresos/egresos.
- Notificaciones in-app + push + email (Resend).
- IA multi-proveedor para redacción.
- Servidor MCP (sin eliminar).
- PWA instalable con carga offline de trabajo de campo.

### Fuera de v1 (preparado en el modelo, no construido)
- Portal de clientes (usuarios de consulta del cliente).
- Firma digital certificada (PAdES).
- Lista de precios / catálogo de servicios con precios (el modelo de ítems ya lo admite).
- Facturación electrónica ARCA/AFIP.
- OAuth para MCP (v1 usa token personal).

## 5. Decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | Next.js + TypeScript full-stack, deploy en Vercel **Hobby** (pruebas) → **Pro** en producción | Mismo stack que pasoluciones.com.ar. ⚠️ Hobby es solo para uso no comercial: pasar a Pro antes del uso productivo. |
| D2 | El workflow de estados es **por presupuesto**; la obra muestra un estado resumen | Una obra puede tener varios presupuestos independientes. |
| D3 | "Bonificado" es una **marca** con % o monto, no un estado | Un presupuesto puede estar en progreso y bonificado a la vez. |
| D4 | "Pendiente Liquidación" = trabajo terminado esperando el pago del saldo | Respuesta del negocio. |
| D5 | Cada documento se emite en **una** moneda (ARS o USD) | Respuesta del negocio. |
| D6 | Prospecto con cliente → ID al crearse; prospecto anónimo → ID al emitir | Respuesta del negocio. |
| D7 | Numeración reinicia cada año; el admin define el número inicial de un año | Respuesta del negocio. |
| D8 | Ítems de presupuesto estructurados (tipo, elemento, Ø, espesor, unidad) | Permite calcular balance cotizado vs ejecutado y proponer adicionales. |
| D9 | DOCX desde los Word originales con placeholders; PDF vía Gotenberg (LibreOffice) | PDF idéntico al Word. |
| D10 | La IA solo modifica bloques de texto; nunca datos sensibles ni montos | Evita errores en campos críticos. |
| D11 | Email con Resend; plantillas HTML con diseño PAS | Respuesta del negocio. |
| D12 | Proveedor y comprobante de compra **opcionales** | Respuesta del negocio. |
| D13 | MCP puede hacer todo menos eliminar | Respuesta del negocio. |

## 6. Pendientes / supuestos a confirmar

| # | Tema | Supuesto actual |
|---|---|---|
| P1 | No hay plantilla Word de **Certificación de Trabajo Adicional** | Se deriva de la Certificación de Obra filtrada al adicional (ver `06-documentos.md`). |
| P2 | Sufijos de código para certificaciones y otros documentos | `-C1` (certificación), `-AD1-C1` (cert. adicional), `-CP1` (control perforaciones). Reporte mensual identificado por período. |
| P3 | Formato de revisiones | `2026/0105 R1`; adicional revisado `2026/0105-AD1 R1`. |
| P4 | Responsable de Higiene y Seguridad en el Reporte Mensual | Configurable por obra (nombre + imagen de firma opcional). |
| P5 | Cuenta Google Cloud para Gotenberg (Cloud Run free tier) | Necesaria para generar PDF. Sin ella, solo DOCX. |
| P6 | Datos de empresa en documentos (WhatsApp, mail, web) | Configurables en Ajustes; valores iniciales tomados de los Word. |
