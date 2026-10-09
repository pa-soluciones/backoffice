// Convierte los Word originales (spec/templates) en plantillas docxtemplater (templates/).
// Reproducible: `node scripts/plantillas/convertir.mjs`. No toca el diseño: solo reemplaza textos
// de ejemplo por tags, convierte filas de tabla en bucles y párrafos editables en bloques.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import PizZip from "pizzip";
import { aplicar, bloque, conTexto, parrafos, reemplazarTexto } from "./ooxml.mjs";

const ORIGEN = "spec/templates";
const DESTINO = "templates";

function falla(msg) {
  throw new Error(`[plantillas] ${msg}`);
}

/** Reemplazos literales (placeholders que están en un solo run). Cada uno tiene que existir. */
function literales(xml, pares) {
  for (const [de, a] of pares) {
    if (!xml.includes(de)) falla(`no encontré "${de}"`);
    xml = xml.split(de).join(a);
  }
  return xml;
}

/** Como `literales`, pero tolera placeholders partidos en varios runs. */
function textos(xml, pares) {
  for (const [de, a] of pares) {
    const [nuevo, n] = reemplazarTexto(xml, de, a);
    if (!n) falla(`no encontré "${de}"`);
    xml = nuevo;
  }
  return xml;
}

/** Párrafos cuyo texto empieza con `inicio` (y opcionalmente el rango hasta `fin`). */
function buscar(ps, inicio, fin) {
  const i = ps.findIndex((p) => p.text.trim().startsWith(inicio));
  if (i < 0) falla(`no encontré el párrafo "${inicio}"`);
  if (!fin) return [ps[i]];
  const j = ps.findIndex((p, k) => k >= i && p.text.trim().startsWith(fin));
  if (j < 0) falla(`no encontré el párrafo final "${fin}"`);
  return ps.slice(i, j + 1);
}

/** Bloques editables y textos exactos sobre párrafos. */
function editarParrafos(xml, { bloques = [], textos = [] }) {
  const ps = parrafos(xml);
  const cambios = [];
  for (const [tag, inicio, fin] of bloques) {
    const rango = buscar(ps, inicio, fin);
    cambios.push({ start: rango[0].start, end: rango[0].end, nuevo: bloque(rango[0].xml, tag) });
    for (const p of rango.slice(1)) cambios.push({ start: p.start, end: p.end, nuevo: "" });
  }
  for (const [exacto, tag] of textos) {
    const p = ps.find((x) => x.text.trim() === exacto) ?? falla(`no encontré el texto "${exacto}"`);
    cambios.push({ start: p.start, end: p.end, nuevo: conTexto(p.xml, tag) });
  }
  return aplicar(xml, cambios);
}

/** Fila de tabla que contiene `marca`: el primer párrafo de cada celda pasa a tener el tag indicado. */
function fila(xml, marca, tagsPorCelda) {
  const filas = [...xml.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)];
  const f = filas.find((m) => parrafos(m[0]).some((p) => p.text.includes(marca))) ?? falla(`no encontré la fila "${marca}"`);
  let i = 0;
  const nueva = f[0].replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (celda) => {
    const tag = tagsPorCelda[i++];
    if (tag == null) return celda;
    const [p] = parrafos(celda);
    return celda.slice(0, p.start) + conTexto(p.xml, tag) + celda.slice(p.end);
  });
  if (i < tagsPorCelda.length) falla(`la fila "${marca}" tiene ${i} celdas`);
  return xml.slice(0, f.index) + nueva + xml.slice(f.index + f[0].length);
}

/**
 * La imagen anclada en "Atentamente." (el logo) se nombra "firma": al generar, si la empresa
 * cargó su firma, src/documents/render.ts la reemplaza ahí.
 */
function marcarFirma(xml) {
  const ps = parrafos(xml);
  const p = ps.find((x) => x.text.trim() === "Atentamente.") ?? falla("no encontré \"Atentamente.\"");
  const docPr = p.xml.match(/<wp:docPr [^>]*name="[^"]*"/g) ?? [];
  if (docPr.length !== 1) falla(`"Atentamente." tiene ${docPr.length} imágenes`);
  return aplicar(xml, [{ start: p.start, end: p.end, nuevo: p.xml.replace(/(<wp:docPr [^>]*name=")[^"]*"/, '$1firma"') }]);
}

function convertir(origen, destino, partes) {
  const zip = new PizZip(readFileSync(`${ORIGEN}/${origen}`));
  for (const [parte, fn] of Object.entries(partes)) {
    zip.file(parte, fn(zip.file(parte).asText()));
  }
  mkdirSync(DESTINO, { recursive: true });
  writeFileSync(`${DESTINO}/${destino}`, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`✓ ${destino}`);
}

// ── Presupuesto ───────────────────────────────────────────────────────────────
convertir("Template Presupuesto.docx", "presupuesto.docx", {
  "word/header1.xml": (x) =>
    editarParrafos(
      literales(x, [
        ["&lt;ID Presupuesto&gt;", "{codigo}"],
        ["&lt;Fecha de Emisión&gt;", "{fecha}"],
        ["&lt;Nombre director Obra&gt;", "{director}"],
        ["&lt;Nombre Contratista&gt;", "{cliente}"],
        ["&lt;Ubicación Obra&gt;", "{direccion}"],
      ]),
      {
        textos: [
          ["Pesos argentinos (ARS)", "{moneda}"],
          ["7 días", "{validez}"],
          ["CAC General", "{base_ajuste}"],
          ["Ajuste Alzado", "{forma_contratacion}"],
        ],
      },
    ),
  "word/document.xml": (x) => {
    x = marcarFirma(x);
    x = fila(x, "Perforaciones en viga", ["{#items}{nro}", "{descripcion}", "{cantidad}", "{precio}", "{subtotal}{/items}"]);
    x = fila(x, "TOTAL NETO:", [null, "{total}"]);
    return editarParrafos(x, {
      bloques: [
        ["introduccion", "Estimados Sres."],
        ["descripcion", "El trabajo por ejecutar"],
        ["leyenda", "El valor cotizado no incluye IVA"],
        ["cotizacion", "La contratación de esta oferta"],
        ["responsabilidades_intro", "Para la correcta ejecución"],
        ["responsabilidades", "Realizar el replanteo", "Proporcionar asistencia"],
        ["plazos", "Plazo estimado de inicio", "Plazo de ejecución"],
        ["forma_pago", "40% de anticipo"],
        ["garantia", "Garantía de mano de obra"],
        ["notas", "Cualquier trabajo adicional"],
      ],
    });
  },
});

// ── Trabajo adicional ─────────────────────────────────────────────────────────
convertir("Template Trabajo adicional.docx", "adicional.docx", {
  "word/header1.xml": (x) =>
    textos(x, [
      ["&lt;ID Presupuesto&gt;-AD1", "{codigo}"],
      ["Nro.&lt;ID Presupuesto&gt;— &lt;Fecha presupuesto&gt;", "Nro. {presupuesto_codigo} — {presupuesto_fecha}"],
      ["&lt;Fecha de Emisión&gt;", "{fecha}"],
      ["&lt;Nombre Contratista&gt;", "{cliente}"],
      ["&lt;Director Obra&gt;", "{director}"],
      ["&lt;Ubicación Obra&gt;", "{direccion}"],
    ]),
  "word/document.xml": (x) => {
    x = marcarFirma(x);
    x = fila(x, "Perforaciones en Viga de Ø 102", ["{#items}{nro}", "{descripcion}", "{cantidad}", "{precio}", "{subtotal}{/items}"]);
    x = fila(x, "Subtotal trabajos adicionales", [null, "{total}"]);
    return editarParrafos(x, {
      bloques: [
        ["objeto", "Cotización de trabajos adicionales"],
        ["descripcion", "Ejecución de"],
        ["observaciones", "Los valores unitarios incluyen", "Validez de la presente"],
      ],
    });
  },
});
