# 05 — Presupuestos, numeración, adicionales, workflow y agenda

## 1. Presupuesto (entidad)

El presupuesto es la **unidad de trabajo y de seguimiento**. Nace como Prospecto.

| Campo | Obligatorio | Notas |
|---|---|---|
| `codigo` | al numerar | `2026/0105` (ver §2) |
| `cliente_id`, `obra_id` | para emitir | Nulos en prospecto anónimo |
| Datos de prospecto | — | `contacto_nombre`, `contacto_telefono`, `contacto_email`, `origen` (WhatsApp, teléfono, email, web, referido, otro), `pedido` (texto libre de lo que pidieron) |
| `estado` | sí | Ver §5 |
| `requiere_visita` | sí | bool, default `false` |
| `moneda` | sí | `ARS` \| `USD` (una sola por presupuesto) |
| `tipo_cambio_ref` | no | Referencia informativa ARS/USD del día de emisión (no se imprime salvo que se pida) |
| `incluye_iva` | sí | default `false`. Si `true`: se discrimina IVA 21% (configurable) |
| `validez_dias` | sí | default de Ajustes (7) |
| `forma_contratacion` | sí | default "Ajuste Alzado" |
| `base_ajuste` | sí | default "CAC General" |
| `anticipo_pct` | sí | default 40 |
| `bonificacion` | no | `{tipo: 'pct' \| 'monto', valor}` → marca **Bonificado** |
| `asignados` | no | usuarios + rol en el trabajo |
| Bloques de texto | — | introducción, descripción técnica, condiciones (ver `06-documentos.md`) |

### 1.1 Ítems

| Campo | Ejemplo |
|---|---|
| `nro` | 1 |
| `tipo_servicio` | `perforacion` \| `corte` \| `sellado_juntas` \| `boca_ataque` \| `anclaje` \| `mano_obra` \| `otro` |
| `elemento` | Viga, Tabique, Losa, Columna, Muro, Platea, Otro |
| `diametro_mm` | 152 (perforación) |
| `espesor_cm` | 29 |
| `unidad` | `u` \| `ml` \| `m2` \| `m3` \| `h` \| `gl` |
| `cantidad` | 9 |
| `precio_unitario` | 168000.00 |
| `descripcion` | Autogenerada y editable: "Perforaciones en viga, 152mm x 29cm de espesor" |
| `subtotal` | calculado |

**RF-PRE-01 [M]** La descripción se autogenera desde los campos estructurados; si el usuario la edita, queda marcada como "manual" y deja de regenerarse.
**RF-PRE-02 [M]** Totales calculados en servidor: subtotal ítems − bonificación (+ IVA si corresponde) = **Total neto**. Montos en `numeric(14,2)`; redondeo half-up a 2 decimales por línea.
**RF-PRE-03 [M]** Bonificación: si es `%`, se aplica al **precio unitario** de cada ítem (así los documentos muestran "valor unitario bonificado", como en los templates). Si es monto fijo, se muestra como línea "Bonificación" antes del total.
**RF-PRE-04 [C]** Catálogo de servicios con precios de lista: al cargar un ítem se sugiere el precio. (Modelo ya preparado: `servicios_catalogo`.)

## 2. Numeración

**RF-NUM-01 [M]** Formato `AAAA/NNNN` (4 dígitos con ceros; si se supera 9999 crece a 5 sin romper el orden).
**RF-NUM-02 [M]** Un contador por año (`numeracion_anual(anio, proximo_numero)`). Se asigna con `UPDATE … SET proximo_numero = proximo_numero + 1 RETURNING` dentro de la transacción (sin carreras entre usuarios).
**RF-NUM-03 [M]** **Cuándo se asigna:**
- Prospecto creado **con cliente** → número al crearlo.
- Prospecto **anónimo** → sin número ("Sin numerar · #interno"); se asigna al **asociar un cliente** o al **emitir** el primer documento, lo que ocurra primero.
- El año es el de la fecha de asignación (zona horaria America/Argentina/Buenos_Aires).
**RF-NUM-04 [M]** Los números nunca se reutilizan: un presupuesto cancelado o rechazado conserva el suyo.
**RF-NUM-05 [M]** Ajustes → Numeración: el admin ve el próximo número de cada año y puede **definir el número inicial del año en curso y de años futuros** (p. ej. empezar 2026 en 0105 por migración). Validación: no puede ser ≤ al mayor número ya usado en ese año. Auditado.
**RF-NUM-06 [M]** Al cambiar el año, el primer presupuesto usa el inicial configurado para ese año, o `0001` si no hay configuración.

### 2.1 Códigos derivados

| Documento | Código | Ejemplo |
|---|---|---|
| Presupuesto original | `AAAA/NNNN` | `2026/0105` |
| Revisión del presupuesto | `AAAA/NNNN Rn` | `2026/0105 R1` |
| Adicional | `AAAA/NNNN-ADn` | `2026/0105-AD2` |
| Revisión de adicional | `AAAA/NNNN-ADn Rm` | `2026/0105-AD2 R1` |
| Certificación de obra | `AAAA/NNNN-Cn` | `2026/0105-C1` |
| Certificación de adicional | `AAAA/NNNN-ADn-Cm` | `2026/0105-AD1-C1` |
| Control de perforaciones | `AAAA/NNNN-CPn` | `2026/0105-CP1` |
| Reporte mensual | por obra y período | `Av. Córdoba 1234 · 2026-08` |

Los sufijos `n` son secuenciales dentro del presupuesto (o del adicional) y nunca se reutilizan.

## 3. Revisiones

**RF-REV-01 [M]** Un presupuesto emitido es inmutable. Para cambiarlo → **"Nueva revisión"**: copia ítems y textos a un nuevo borrador `R(n+1)`.
**RF-REV-02 [M]** Al emitir una revisión, pasa a ser la **revisión vigente**; las anteriores quedan visibles como históricas ("Reemplazada por R2").
**RF-REV-03 [M]** Los ítems del presupuesto (para balance, certificaciones, cobros) son siempre los de la **revisión vigente**.
**RF-REV-04 [S]** Comparar dos revisiones (diff de ítems y totales).

## 4. Adicionales

**RF-ADI-01 [M]** Desde un presupuesto (estado En progreso o Pendiente liquidación) → "+ Adicional". Se crea `ADn` con sus propios ítems, textos, moneda (por defecto la del presupuesto), validez (default 15 días) y opción "mantener bonificación del presupuesto".
**RF-ADI-02 [M]** Estados del adicional: `borrador → enviado → aprobado | rechazado | cancelado`.
**RF-ADI-03 [M]** Solo los adicionales **aprobados** suman a: cantidades cotizadas (balance de perforaciones), certificaciones e importes a cobrar.
**RF-ADI-04 [M]** Cobro del adicional: por defecto 100% contra certificación (sin anticipo), editable (`anticipo_pct`).
**RF-ADI-05 [M]** Sugerencia automática: si el balance de Control de Perforaciones muestra excedente (ej. +8 Ø102), ofrecer "Crear adicional con el excedente" precargando ítems y precio unitario vigente (bonificado si aplica).
**RF-ADI-06 [M]** Cada adicional tiene su propia **Certificación de trabajo adicional** (ver `06-documentos.md`).

## 5. Workflow de estados (por presupuesto)

```
                    ┌────────────────────┐
   (requiere_visita)│                    ▼
 PROSPECTO ──────► VISITA_TECNICA ──► EN_ESPERA ──► EN_PROGRESO ──► PENDIENTE_LIQUIDACION ──► TERMINADO
     │                  │                │   │
     │                  │                │   └──► RECHAZADO
     └──────────────────┴────────────────┴──────► CANCELADO  (desde cualquier estado no final)
```

| Transición | Condición (validada en servidor) | Efectos |
|---|---|---|
| Prospecto → Visita técnica | `requiere_visita = true` | Habilita agendar visita |
| Prospecto → En espera | Hay un **presupuesto emitido** (R vigente) | Inicia conteo de validez |
| Visita técnica → En espera | Visita `realizada` u `omitida` (con motivo), y presupuesto emitido | — |
| En espera → En progreso | Cliente confirmó (fecha de confirmación obligatoria; adjunto opcional: OC, email, WhatsApp) | Genera cobro esperado de anticipo (`anticipo_pct` × total). Notifica a asignados |
| En espera → Rechazado | Motivo obligatorio (precio, plazo, sin respuesta, otro) | Final |
| En progreso → Pendiente liquidación | Confirmación de fin de trabajos + **cierre de materiales** completado (ver `08`) | Genera cobro esperado de saldo. Sugiere emitir Certificación final |
| Pendiente liquidación → Terminado | Saldo pendiente = 0 (automático al registrar el último cobro) **o** manual con motivo (ej. saldo condonado) | Final. Resumen de ingresos/egresos congelado |
| Cualquiera no final → Cancelado | Motivo obligatorio | Final. Libera stock asignado (pide destino) |

**RF-WF-01 [M]** Las transiciones solo se ejecutan vía `services/presupuestos.cambiarEstado()`, que valida la tabla anterior (función pura en `domain/workflow.ts`, testeada).
**RF-WF-02 [M]** Requiere permiso `presupuestos.cambiar_estado`.
**RF-WF-03 [M]** Estados finales: Terminado, Rechazado, Cancelado. **Reabrir** solo admin, con motivo, vuelve al estado anterior. Auditado.
**RF-WF-04 [M]** Historial de estados con fecha, usuario y motivo, visible en el presupuesto.
**RF-WF-05 [M]** Validez vencida: si está En espera y pasaron `validez_dias` desde la emisión → etiqueta "Oferta vencida" (no cambia el estado) + notificación. Se puede emitir revisión o "extender validez".
**RF-WF-06 [M]** **Bonificado**: marca visible (chip) en listados, kanban y detalle cuando `bonificacion` está cargada. Se puede aplicar en Prospecto, Visita técnica o En espera (si ya hay documento emitido, requiere nueva revisión).
**RF-WF-07 [M]** Tablero kanban por estado; arrastrar una tarjeta dispara la transición (con su formulario de condiciones si corresponde). Filtros: cliente, asignado, bonificado, vencidos.

## 6. Visitas técnicas y agenda

**RF-AGE-01 [M]** Una visita tiene: presupuesto, fecha y hora, duración estimada, responsables (usuarios), dirección (por defecto la de la obra o la indicada en el prospecto), contacto en sitio, notas previas.
**RF-AGE-02 [M]** Estados de la visita: `pendiente → agendada → realizada | omitida | cancelada`. Al marcarla realizada: notas de visita, fotos (anexos) y medidas relevadas.
**RF-AGE-03 [M]** Las notas de la visita quedan disponibles como contexto para que la IA redacte la descripción técnica (solo a pedido del usuario).
**RF-AGE-04 [M]** Vista agenda: mes / semana / lista (desktop); lista por día (mobile). Muestra visitas técnicas y **jornadas de trabajo** planificadas.
**RF-AGE-05 [S]** Jornadas de trabajo: el presupuesto En progreso puede tener días planificados con operarios asignados (alimenta recordatorios y el Reporte Mensual).
**RF-AGE-06 [S]** Exportar evento a calendario (`.ics`) / link de Google Calendar.

## 7. Criterios de aceptación
- [ ] Dos usuarios creando prospectos con cliente al mismo tiempo obtienen números distintos y consecutivos.
- [ ] Un prospecto anónimo no consume número hasta asociarle cliente o emitir.
- [ ] Configurar 2026 para empezar en 0105 hace que el próximo sea `2026/0105`; intentar 0050 cuando ya existe 0080 falla con mensaje claro.
- [ ] No se puede pasar a En espera sin un presupuesto emitido.
- [ ] Registrar el último cobro en Pendiente liquidación pasa el presupuesto a Terminado automáticamente.
- [ ] Un adicional en borrador no altera el balance de perforaciones ni los importes a cobrar.
