# 07 — Control de perforaciones (trabajo de campo)

Objetivo: dejar **registro visual y de datos** de que las perforaciones se ejecutaron, y calcular automáticamente el balance contra lo cotizado. Carga opcional día a día; también se puede cargar todo junto al final.

## 1. Registro de campo

| Campo | Obligatorio | Notas |
|---|---|---|
| `presupuesto_id` | sí | Solo presupuestos En progreso (o Pendiente liquidación, para correcciones) |
| `fecha` | sí | Default hoy |
| `operarios` | sí | 1..n usuarios; default el usuario actual |
| `piso` | sí | Texto corto: "17", "PB", "SS1", "Azotea" |
| `elemento` | sí | Viga, Tabique, Losa, Columna, Muro, Platea, Otro |
| `espesor_cm` | sí | Default del ítem vinculado |
| `diametro_mm` | sí | Default del ítem vinculado |
| `cantidad` | sí | Entero ≥ 1 |
| `item_id` | sugerido | Ítem del presupuesto o de un adicional aprobado; se autoselecciona por Ø + elemento + espesor |
| `estado` | sí | `finalizado` (default) \| `parcial` \| `con_observacion` |
| `observacion` | no | "1ra u. de 152 mm", "interferencia con armadura" |
| `fotos` | recomendado | 0..n; si se guarda sin fotos, se muestra la advertencia "Sin evidencia fotográfica" |

**RF-CMP-01 [M]** Formulario mobile-first: elegir presupuesto (solo los asignados en progreso) → los campos se precargan con el último registro (piso, elemento, Ø) para cargar rápido y en serie.
**RF-CMP-02 [M]** Botón "📷 Foto" abre la cámara trasera; varias fotos por registro; optimización según `06-documentos.md` §7.
**RF-CMP-03 [M]** Cada foto guarda: fecha/hora de captura (EXIF o del dispositivo), usuario y registro asociado. Al pie de la foto se muestra "Piso 17 · Viga · Ø102 · 27/08/2026 · J. Pérez".
**RF-CMP-04 [M]** **Funciona offline** (ver `12-no-funcionales.md` §1): registro + fotos quedan en cola y se sincronizan al volver la conexión.
**RF-CMP-05 [M]** Editar o eliminar un registro: el autor dentro de las 48 h o quien tenga `campo.escribir`/`eliminar` con alcance `todos`. Auditado.
**RF-CMP-06 [S]** Cortes: el mismo registro admite `tipo_servicio = corte` con `unidad` ml/m² y `medida` en lugar de Ø, para que el modelo no quede atado a perforaciones. La UI v1 prioriza perforaciones.

## 2. Balance

Función pura `domain/balance.ts`:

```
cotizado[clave]  = Σ cantidad de ítems tipo perforación del presupuesto (revisión vigente) + adicionales aprobados
ejecutado[clave] = Σ cantidad de registros de campo
diferencia       = ejecutado − cotizado
clave            = diámetro_mm   (opción: diámetro + elemento + espesor)
```

**RF-BAL-01 [M]** Vista "Balance" en el presupuesto (tab Campo): por diámetro → cotizadas · ejecutadas · diferencia, con barra de avance y totales. Con `ver_montos`: valorizado (diferencia × precio unitario).
**RF-BAL-02 [M]** Etiquetas: `diferencia > 0` → "+n ejecutadas en exceso" (naranja); `< 0` → "−n pendientes de realizar" (gris); `= 0` → "Completo" (verde).
**RF-BAL-03 [M]** Si hay excedente sin adicional que lo cubra → aviso "8 perforaciones Ø102 sin cotizar · Crear adicional" (ver `05` RF-ADI-05).
**RF-BAL-04 [M]** El balance alimenta el documento Control de Perforaciones y la precarga de cantidades de la Certificación.
**RF-BAL-05 [M]** Agrupación configurable del registro detallado: por piso (default, orden descendente como en el template), por fecha o por diámetro.

## 3. Galería de evidencia
**RF-EVI-01 [M]** Tab "Evidencia" del presupuesto: todas las fotos de campo en grilla, filtrables por piso, fecha, operario y diámetro.
**RF-EVI-02 [S]** Descargar todas las fotos (ZIP) del presupuesto o de un rango de fechas.

## 4. Criterios de aceptación
- [ ] Con 16 Ø102 + 8 Ø152 cotizadas y los registros del template de ejemplo, el balance da Ø102 `+8`, Ø152 `−5`, total `+3`.
- [ ] Cargar 3 registros con fotos en modo avión y luego reconectar: aparecen en el servidor sin duplicados.
- [ ] Un operario sin `ver_montos` ve el balance sin columnas de importes.
