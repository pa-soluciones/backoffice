# 06 — Documentos, plantillas, versiones, firmas y anexos

## 1. Tipos de documento

| Tipo | Plantilla origen | Nivel | Código |
|---|---|---|---|
| `presupuesto` | `templates/Template Presupuesto.docx` | Presupuesto | `2026/0105`, `2026/0105 R1` |
| `adicional` | `templates/Template Trabajo adicional.docx` | Adicional | `2026/0105-AD1` |
| `certificacion_obra` | `templates/Template Certificación de Obra.docx` | Presupuesto | `2026/0105-C1` |
| `certificacion_adicional` | **Sin plantilla** → derivada de la Certificación de Obra (ver §3.4) | Adicional | `2026/0105-AD1-C1` |
| `control_perforaciones` | `templates/Template control perforaciones.docx` | Presupuesto | `2026/0105-CP1` |
| `reporte_mensual` | `templates/Template reporte mensual estadistico.docx` | Obra + mes | `2026-08` |

## 2. Ciclo de vida

```
BORRADOR (versiones v1, v2, … autosave) ──emitir──► EMITIDO (inmutable: DOCX + PDF + snapshot)
                                                       │
                                                       └─► "Nueva revisión/versión" → nuevo BORRADOR
```

**RF-DOC-01 [M]** Crear un documento genera un **borrador** con los datos precargados desde la base (cliente, obra, director, ítems, cobros, registros de campo) + bloques de texto por defecto (de Ajustes → Textos por defecto).
**RF-DOC-02 [M]** **Historial de versiones del borrador:** cada guardado (manual o autosave cada 30 s con cambios) crea una versión con autor, fecha, origen (`usuario` | `ia`) y snapshot JSON. Se puede ver, comparar (diff de texto) y restaurar cualquier versión.
**RF-DOC-03 [M]** **Emitir** (permiso `documentos.emitir`): congela un snapshot completo (todos los datos resueltos, incluidos los derivados), genera DOCX y PDF, los guarda en R2 con su hash SHA-256 y registra quién emitió. El documento emitido no se edita nunca más.
**RF-DOC-04 [M]** Los datos sensibles **no son editables en el documento**: código, fecha de emisión, cliente, obra, dirección, director, ítems, cantidades, precios, totales, montos en letras y situación de pagos. Se modifican en su entidad de origen (ej. ítems del presupuesto) y el borrador se refresca. El editor los muestra con un candado 🔒 y un link "Editar en el presupuesto".
**RF-DOC-05 [M]** Si los datos de origen cambian mientras hay un borrador abierto, se avisa: "Los datos del presupuesto cambiaron · Actualizar vista previa".
**RF-DOC-06 [M]** Descarga de DOCX y PDF de cualquier documento emitido. Nombre de archivo: `PAS - Presupuesto 2026-0105 R1 - Constructora Ejemplo.pdf` (sin `/`).
**RF-DOC-07 [S]** Compartir: link de descarga firmado con vencimiento (7 días) para enviar por WhatsApp/email.

## 3. Contenido por tipo

Cada documento = **campos de datos** (bloqueados, derivados) + **bloques de texto** (editables por el usuario y por la IA).

### 3.1 Presupuesto

| Sección | Origen | Editable |
|---|---|---|
| Encabezado: Presupuesto Nro., fecha, moneda, validez, base de ajuste, forma de contratación | Presupuesto | 🔒 |
| Información del cliente: Director de Obra, Contratista, Dirección de Obra | Cliente/Obra | 🔒 |
| Introducción ("Estimados Sres. {cliente}…") | Texto por defecto con variables | ✏️ |
| Descripción técnica del trabajo | Usuario / IA | ✏️ |
| Tabla de ítems (ítem, descripción, cant., valor unidad, total) + TOTAL NETO | Ítems | 🔒 |
| Leyenda impuestos/moneda ("El valor cotizado no incluye IVA…") | Según `incluye_iva` y `moneda` | 🔒 (autogenerada) |
| Condiciones generales: Cotización, Responsabilidades del cliente, Plazos de ejecución, Forma de pago, Garantía, Notas adicionales | Textos por defecto | ✏️ cada bloque |
| Cierre y firma | Ajustes de empresa | 🔒 |

Variables en textos: `{cliente}`, `{obra.direccion}`, `{director}`, `{validez_dias}`, `{anticipo_pct}`, `{base_ajuste}`, `{forma_contratacion}`, `{moneda_nombre}`. Se resuelven al renderizar; la IA no puede inventar variables nuevas.

### 3.2 Adicional (Cotización de trabajos adicionales)
- 🔒 Objeto: contratista, dirección, director, presupuesto de referencia + su fecha.
- ✏️ Descripción del servicio.
- 🔒 Tabla de ítems del adicional + Subtotal trabajos adicionales.
- ✏️ Observaciones (por defecto: bonificación vigente si aplica, leyenda IVA/moneda, forma de pago, validez 15 días).

### 3.3 Certificación de Obra
- Campo `tipo`: **parcial** | **final**. Selección de cantidades a certificar por ítem (por defecto: lo ejecutado según Control de Perforaciones, o lo cotizado si no hay registros). Una parcial no puede certificar más de lo cotizado + adicionales aprobados; para excedentes sugiere crear un adicional.
- 🔒/✏️ Objeto (texto con variables; editable).
- 🔒 **Trabajos certificados según presupuesto Nro.** (ítems + subtotal, indicando "con descuento" si hay bonificación).
- 🔒 **Trabajos adicionales incorporados** (solo adicionales aprobados elegidos) + texto ✏️ explicativo por adicional.
- 🔒 **Monto total certificado** (originales + adicionales). En una certificación parcial se muestra además lo acumulado certificado previamente.
- 🔒 **Situación de pagos**: tabla autogenerada desde Cobros: concepto · estado (ABONADO / PENDIENTE / PARCIAL) · importe; anticipo, saldo y cada adicional. **Saldo total por abonar** en número **y en letras** ("PESOS DOS MILLONES OCHOCIENTOS TREINTA Y SEIS MIL CON 00/100"; en USD: "DÓLARES ESTADOUNIDENSES …").
- ✏️ Observaciones (vigencia del descuento, condición del beneficio, impuestos, forma de pago del saldo).

### 3.4 Certificación de trabajo adicional
Misma estructura que la Certificación de Obra, limitada a un adicional: objeto, ítems del adicional certificados, monto certificado, situación de pagos del adicional, observaciones. Se genera a partir de una **copia de la plantilla de Certificación de Obra** sin la sección "Trabajos certificados según presupuesto". ⚠️ Pendiente P1: si existe un Word propio, reemplazarla.

### 3.5 Control de Perforaciones
- 🔒 Encabezado: cliente, director, lugar de obra, empresa, operador(es), fecha.
- ✏️ Subtítulo (ej. "Registro de Ejecución y Balance Final: Pisos 17 al 2"; la IA puede proponerlo desde los registros).
- Filtro de alcance: rango de fechas y/o "todo lo ejecutado".
- 🔒 **Registro detallado:** piso · ubicación (elemento) · espesor · diámetro · cantidad · estado/observación. Viene de los registros de campo (`07-control-perforaciones.md`); agrupables por piso.
- 🔒 **Total ejecutado** por diámetro.
- 🔒 **Balance general y cuadro comparativo:** por diámetro → cotizadas (presupuesto vigente + adicionales aprobados) · ejecutadas · diferencia (`+n ejecutadas en exceso` / `−n pendientes de realizar`) + totales.
- ✏️ **Observaciones** (la IA las redacta desde el balance, a pedido).
- Firmas: responsable/operador (imagen de firma del usuario) y "Firma / conformidad inspección" (en blanco, para firma en papel).
- [S] Opción "Incluir anexo fotográfico": agrega al final las fotos de evidencia (grilla 2×3 por página, con piso, fecha y operario al pie de cada foto).

### 3.6 Reporte Mensual Estadístico (por obra)
- 🔒 Fecha de emisión, empresa/contratista, domicilio de la obra, período (año, mes).
- Campos numéricos (precargados y editables, porque son declaración de H&S):
  - **Cantidad de trabajadores** → precarga: operarios distintos con registros de campo o jornadas en el mes.
  - **Días trabajados** → precarga: días distintos con registros/jornadas en el mes.
  - **Cantidad de accidentes**, **días perdidos por accidentes** → 0 por defecto.
- ✏️ Observaciones / comentarios.
- Firmas: responsable de la empresa (imagen de firma + aclaración) y responsable de Higiene y Seguridad (de la obra).
- **RF-DOC-08 [S]** Recordatorio mensual (día 1) para emitir el reporte de cada obra con actividad el mes anterior.

## 4. Plantillas

**RF-TPL-01 [M]** Los Word originales se convierten **una vez** a plantillas docxtemplater, reemplazando los datos de ejemplo por tags, sin tocar el diseño:
- Simples: `{codigo}`, `{fecha_emision}`, `{cliente.razon_social}`, `{obra.direccion}`, `{director.nombre}`, `{total_neto}`, `{saldo_letras}`.
- Bucles de tablas: `{#items}{nro}{descripcion}{cantidad}{precio_unitario}{subtotal}{/items}`.
- Condicionales: `{#bonificado}…{/bonificado}`, `{#incluye_iva}…{/incluye_iva}`.
- Bloques de texto multi-párrafo: `{@bloque_descripcion}` (raw XML generado desde el texto con el estilo del párrafo original).
- Imágenes (firmas, fotos): módulo de imágenes de docxtemplater, `{%firma_responsable}`.
- Datos de empresa del pie (WhatsApp, mail, web): `{empresa.whatsapp}`, etc.
**RF-TPL-02 [M]** Las plantillas se versionan en el repo (`/templates`) y se registran en DB (`plantillas`: tipo, versión, hash). Cada documento emitido guarda qué versión de plantilla usó.
**RF-TPL-03 [S]** Ajustes → Plantillas: el admin puede subir una nueva versión de un `.docx`; el sistema valida que contenga todos los tags requeridos para ese tipo antes de activarla, y permite generar un documento de prueba con datos de ejemplo.
**RF-TPL-04 [M]** Formato de números y fechas es-AR en todos los documentos: `$ 1.512.000,00`, `US$ 12.500,00`, `30/09/2026`. Paginación "Página X de Y" se mantiene como campo de Word.

## 5. Vista previa editable

**RF-PRV-01 [M]** El editor muestra una **vista previa HTML** que replica el layout del documento (encabezado, tablas, pie, tipografía), generada desde los mismos datos que el DOCX. Es la vista para editar; el DOCX/PDF final sale de la plantilla Word.
**RF-PRV-02 [M]** Los bloques de texto se editan **directamente en la vista previa** (click en el párrafo → edición inline con formato básico: negrita, cursiva, listas). Los campos 🔒 no son editables.
**RF-PRV-03 [M]** Cada bloque editable tiene el botón **✨ IA** con:
- Instrucción libre ("hacelo más formal", "agregá que el trabajo se hace en horario nocturno").
- Acciones rápidas: Mejorar redacción · Más corto · Más formal · Corregir ortografía · Redactar desde notas de visita.
- La IA devuelve una propuesta que se muestra como **diff** (tachado/resaltado) → **Aceptar** / **Descartar** / **Reintentar**. Aceptar crea una versión con origen `ia`.
**RF-PRV-04 [M]** Botón **✨ IA en todo el documento** ("revisá la redacción completa"): propone cambios bloque por bloque, cada uno aceptable por separado. Nunca toca campos 🔒.
**RF-PRV-05 [S]** Vista previa del PDF real (generado on-demand desde el borrador) antes de emitir, marcada como "BORRADOR" con marca de agua.
**RF-PRV-06 [M]** En mobile: tabs "Datos" / "Vista previa"; la edición inline funciona igual con el teclado táctil.

## 6. Firmas

**RF-FIR-01 [M]** Ajustes → Empresa → Firmas: configurar por **tipo de documento** qué firma(s) lleva:
- `ninguna` | `imagen de firma de empresa` | `imagen de sello` | `firma del usuario que emite` | `firma + sello`.
- Inicialmente: **imagen de firma** (decisión del negocio).
**RF-FIR-02 [M]** Imágenes de firma/sello: PNG con fondo transparente, máx. 1 MB, guardadas en R2 privado. Solo usuarios con `configuracion.escribir` (empresa) o el propio usuario (su firma).
**RF-FIR-03 [C]** Firma digital certificada (PAdES sobre el PDF, certificado del firmante): opción prevista en el modelo (`tipo_firma = 'digital'`), sin implementar en v1.

## 7. Anexos

**RF-ANX-01 [M]** Se pueden adjuntar archivos a un presupuesto (y a una obra o a una visita): imágenes (JPEG, PNG, WebP, HEIC), PDF, DOCX, XLSX, DWG/DXF.
**RF-ANX-02 [M]** Límite de **30 MB por archivo** (antes de optimizar).
**RF-ANX-03 [M]** **Optimización de imágenes en el cliente antes de subir:** se redimensionan a un lado máximo de 2560 px, se convierten a WebP (calidad 0,8; JPEG si el navegador no soporta WebP), se corrige la orientación EXIF y se eliminan los metadatos GPS. HEIC se convierte en el cliente. Se genera además una miniatura de 400 px. El archivo original **no** se guarda.
**RF-ANX-04 [M]** Upload directo a R2 con URL prefirmada (PUT, expira en 10 min); el servidor valida tipo MIME real (magic bytes) y tamaño al confirmar.
**RF-ANX-05 [M]** Cada anexo: nombre, categoría (Foto de obra, Plano, Orden de compra, Comprobante, Contrato, Otro), descripción, fecha, autor. Galería con lightbox para imágenes; visor embebido para PDF.
**RF-ANX-06 [S]** Un anexo puede marcarse como "Incluir en el documento" para adjuntarlo al final del PDF emitido (estilo "Anexo I, II…").

## 8. Criterios de aceptación
- [ ] Emitir un presupuesto genera DOCX y PDF visualmente iguales al Word original con los datos reemplazados (comparación manual con los 5 templates).
- [ ] La IA no puede modificar ID, cliente, ni montos: el endpoint de IA solo acepta y devuelve un `bloque_id` + texto.
- [ ] Restaurar la versión v3 de un borrador recupera exactamente el texto de esa versión.
- [ ] Un documento emitido no tiene acción "Editar"; solo "Nueva revisión/versión".
- [ ] El total en letras de 2.836.000,00 ARS es "PESOS DOS MILLONES OCHOCIENTOS TREINTA Y SEIS MIL CON 00/100".
- [ ] Una foto de 12 MB del celular se sube como WebP de ≤ 1 MB.
