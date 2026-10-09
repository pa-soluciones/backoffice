# 14 — Roadmap de entrega

Cada fase termina desplegada en Vercel (preview → main) y usable. Orden pensado para dar valor temprano: primero lo que hoy genera errores manuales (numeración y documentos).

| Fase | Contenido | Specs | Entregable verificable |
|---|---|---|---|
| **F0 — Base** | Repo, Next.js, Tailwind + tokens PAS, Drizzle + Neon, R2, CI, layout desktop/mobile, Gotenberg en Cloud Run | 01, 02, 12 | App vacía desplegada con login placeholder; PDF de prueba generado |
| **F1 — Acceso** | Bootstrap admin, asistente de primer inicio (contraseña, frase, email Resend, 2FA), usuarios, roles, permisos, auditoría, emails base | 03, 09 §4, email/ | Admin completa el setup; crea un operario con alcance `asignados` |
| **F2 — Clientes y obras** | Clientes, directores, obras, explorador, buscador global | 04 | Cargar los clientes reales y encontrarlos por dirección/director |
| **F3 — Presupuestos** | Prospectos, numeración anual + configuración inicial, ítems estructurados, bonificación, workflow, kanban, asignados, visitas + agenda | 05 | Ciclo Prospecto → En progreso con números correctos |
| **F4 — Documentos I** | Plantillas Presupuesto y Adicional, vista previa editable, versiones, emisión DOCX/PDF, firmas, anexos con optimización, IA (IA-1..IA-4, IA-6) | 06, 10 | Emitir `2026/0105` y `2026/0105-AD1` idénticos al Word |
| **F5 — Campo** | Registros de perforación con fotos, balance, PWA + offline, documento Control de Perforaciones, IA-5 | 07, 12 §1 | Cargar registros en modo avión y emitir `-CP1` |
| **F6 — Cobros y certificaciones** | Cobros esperados/recibidos, Certificación de Obra (parcial/final), Certificación de Adicional, montos en letras | 06, 08 §3 | Reproducir la certificación del template con los mismos números |
| **F7 — Stock y finanzas** | Artículos, compras, proveedores, movimientos, cierre de materiales, gastos (offline), resumen económico, finanzas | 08 | Resumen ingresos/egresos de un presupuesto terminado |
| **F8 — Reporte mensual y notificaciones** | Reporte Mensual, push, cron diario, recordatorios, preferencias | 06 §3.6, 09 | Recordatorios del día llegan una sola vez |
| **F9 — MCP** | Tokens personales, tools de consulta y escritura, dry-run/confirmar | 11 | Operar un presupuesto completo desde Claude Desktop |
| **Post v1** | Portal de clientes, catálogo de precios + IA-7, firma digital, OAuth MCP, cron horario (Vercel Pro) | 00 §4 | — |

> F9 puede adelantarse: las tools son wrappers finos de `services/`, que ya existen desde F2.

### Notas de implementación
- **F3:** los adicionales (`-ADn`) pasan a F4 junto con su documento. El tablero no tiene arrastrar y soltar todavía (el cambio de estado se hace desde el detalle). Las jornadas de trabajo (RF-AGE-05) quedan para F5. Hasta F6 (cobros), pasar a Terminado pide motivo porque todavía no se conoce el saldo.
- **F4:** firma de empresa única para todos los documentos (sin elección por tipo, sello ni firma del usuario: RF-FIR-01 parcial).
- **F5:** la galería de evidencia muestra las fotos por registro, agrupables por piso/fecha/diámetro (sin filtros por operario ni ZIP, RF-EVI-02). Las jornadas de trabajo (RF-AGE-05) pasan a F8 junto con los recordatorios. El control lleva las firmas en blanco (sin imagen de firma del operador). Sin aviso de cuota del almacenamiento del navegador (RNF-06).

## Antes de producción (checklist)
- [ ] Migrar a **Vercel Pro** (el plan Hobby no permite uso comercial).
- [ ] DNS de `pasoluciones.com.ar` verificado en Resend (SPF, DKIM) y remitente `notificaciones@pasoluciones.com.ar`.
- [ ] Dominio de la app (ej. `app.pasoluciones.com.ar`).
- [ ] Backup diario funcionando + restore probado.
- [ ] Número inicial de 2026 configurado (continuar desde el último presupuesto real).
- [ ] Plantillas validadas contra los 5 Word originales.
- [ ] Revisión de permisos de cada rol con el negocio.
