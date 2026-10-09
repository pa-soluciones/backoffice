# 09 — Notificaciones

## 1. Canales

| Canal | Uso | Implementación |
|---|---|---|
| **In-app** | Siempre. Campana con contador + página de notificaciones (leídas/no leídas, filtros) | Tabla `notificaciones` |
| **Push** | Opt-in por dispositivo (PWA instalada o navegador) | `web-push` + VAPID; suscripciones por dispositivo |
| **Email** | Eventos importantes y de seguridad | Resend + React Email (diseño en `spec/email/`) |

**RF-NOT-01 [M]** Cada usuario configura en su perfil, por categoría de evento, qué canales recibe (in-app no se puede apagar). Los eventos de seguridad siempre van por email.
**RF-NOT-02 [M]** **Destinatarios:** usuarios asignados al presupuesto **+ todos los administradores** (siempre, en todos los eventos de presupuestos). El autor de la acción no se notifica a sí mismo.
**RF-NOT-03 [M]** Cada notificación tiene un link directo a la entidad (deep link que abre la PWA).
**RF-NOT-04 [M]** Agrupación: varios eventos iguales en 10 min sobre la misma entidad se agrupan ("3 registros de campo nuevos en 2026/0105").

## 2. Eventos

| Evento | Destinatarios | Canal por defecto |
|---|---|---|
| Nuevo prospecto | Admins + rol Comercial | in-app, push |
| Asignación a un presupuesto | Usuario asignado + admins | in-app, push, email |
| Cambio de estado de presupuesto | Asignados + admins | in-app, push |
| Visita técnica agendada / reprogramada | Responsables + admins | in-app, push, email |
| **Recordatorio:** visita técnica mañana / hoy | Responsables | push, email (mañana) |
| **Recordatorio:** jornada de trabajo mañana | Operarios asignados | push |
| Documento emitido | Asignados + admins | in-app |
| **Recordatorio:** presupuesto En espera con oferta vencida | Asignados + admins | in-app, push |
| **Recordatorio:** En espera sin respuesta hace N días (default 7) | Asignados + admins | in-app |
| **Recordatorio:** anticipo pendiente hace N días de iniciado | Admins + Administración | in-app, email |
| **Recordatorio:** Pendiente liquidación con saldo hace N días (default 15) | Admins + Administración | in-app, email |
| Cobro registrado | Asignados + admins | in-app |
| Excedente de perforaciones sin adicional | Asignados + admins | in-app, push |
| Stock bajo mínimo | Admins + Administración | in-app |
| **Recordatorio:** emitir Reporte Mensual (día 1) | Asignados de obras con actividad + admins | in-app, push |
| Seguridad: login desde nuevo dispositivo, reset de contraseña/2FA, cambio de permisos | Usuario afectado + admins | email (siempre) |
| Sincronización offline con conflictos | Usuario | in-app |

Los días "N" son configurables en Ajustes.

## 3. Ejecución

**RF-NOT-05 [M]** Eventos inmediatos: se generan dentro del mismo `service` que realiza la acción (después del commit).
**RF-NOT-06 [M]** Recordatorios: `GET /api/cron/daily` (Vercel Cron, 08:00 ART = 11:00 UTC), protegido con `CRON_SECRET`. Es idempotente: guarda `(tipo, entidad, fecha)` para no repetir el mismo recordatorio el mismo día.
> Vercel Hobby solo permite cron diario. El recordatorio de "visita hoy" sale a las 08:00. Con Pro se puede agregar un cron horario para avisar "en 1 hora".
**RF-NOT-07 [M]** Envío de email desacoplado: si Resend falla, la notificación in-app igual se crea y el email se reintenta en el próximo cron (máx. 3 intentos).
**RF-NOT-08 [M]** El proveedor de email se usa a través de una única función `sendEmail()`; si `RESEND_API_KEY` no está configurado, se registra en log y no rompe el flujo (salvo la verificación de email del admin, que sí lo requiere).

## 4. Emails transaccionales

Plantillas (diseño en `spec/email/base.html`):
1. Código de verificación de email.
2. Restablecer contraseña.
3. Bienvenida / alta de usuario (sin contraseña en el cuerpo; link para definirla).
4. Alerta de seguridad.
5. Notificación genérica (título, texto, botón "Ver en PAS Backoffice").
6. Resumen diario de recordatorios (un email por usuario con todos sus recordatorios del día, no uno por evento).

## 5. Criterios de aceptación
- [ ] Un admin recibe la notificación de cambio de estado de un presupuesto al que no está asignado.
- [ ] Ejecutar el cron dos veces el mismo día no duplica recordatorios.
- [ ] Sin RESEND_API_KEY, cambiar un estado funciona y crea la notificación in-app.
