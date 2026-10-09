// Utilidades mínimas para editar el XML de Word (WordprocessingML) sin romper el diseño.

/** Párrafos "hoja" (sin párrafos anidados, p. ej. dentro de cajas de texto): [{start, end, xml, text}]. */
export function parrafos(xml) {
  const re = /<w:p[ >]|<\/w:p>/g;
  const pila = [];
  const out = [];
  let m;
  while ((m = re.exec(xml))) {
    if (m[0] === "</w:p>") {
      const p = pila.pop();
      const end = m.index + m[0].length;
      if (!p.hijos) out.push({ start: p.start, end, xml: xml.slice(p.start, end) });
      if (pila.length) pila[pila.length - 1].hijos = true;
    } else {
      pila.push({ start: m.index, hijos: false });
    }
  }
  return out.map((p) => ({ ...p, text: textoDe(p.xml) })).sort((a, b) => a.start - b.start);
}

export const textoDe = (xml) =>
  [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join("")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const pPrDe = (p) => p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
const aperturaDe = (p) => p.match(/^<w:p[^>]*>/)[0];
const runs = (p) => [...p.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].map((m) => m[0]);
const rPrDeRun = (r) => r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
const esNegrita = (rPr) => /<w:b\/>|<w:b w:val="(1|true)"\/>/.test(rPr);

/** rPr para texto normal y negrita, tomados de los runs del párrafo (o del rPr de párrafo). */
export function estilos(p) {
  const rs = runs(p).map(rPrDeRun);
  const marca = pPrDe(p).match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const normal = rs.find((r) => !esNegrita(r)) ?? (rs[0] ?? marca).replace(/<w:b\/>|<w:bCs\/>/g, "");
  const negrita = rs.find(esNegrita) ?? (normal ? normal.replace("</w:rPr>", "<w:b/><w:bCs/></w:rPr>") : "<w:rPr><w:b/><w:bCs/></w:rPr>");
  return { normal, negrita };
}

const run = (rPr, texto) => `<w:r>${rPr}<w:t xml:space="preserve">${escapar(texto)}</w:t></w:r>`;

/** Mismo párrafo (mismo pPr y formato del primer run) con un único texto. */
export function conTexto(p, texto, rPr) {
  const rs = runs(p);
  const estilo = rPr ?? (rs[0] ? rPrDeRun(rs[0]) : estilos(p).normal);
  return `${aperturaDe(p)}${pPrDe(p)}${run(estilo, texto)}</w:p>`;
}

/**
 * Bloque editable: párrafo que se repite por cada línea del texto (paragraphLoop de docxtemplater),
 * con runs alternando negrita/normal para soportar **negrita**. Conserva el pPr (viñetas incluidas).
 */
export function bloque(p, tag) {
  const { normal, negrita } = estilos(p);
  const pPr = pPrDe(p);
  const vacio = (t) => `<w:p>${pPr.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, "")}${run(normal, t)}</w:p>`;
  // El bucle abre y cierra en runs propios: así cada iteración emite runs completos (negrita o normal)
  // y el texto de una iteración no cae dentro del run de la anterior.
  const cuerpo = `${aperturaDe(p)}${pPr}${run(normal, "{#runs}")}${run(negrita, "{#b}{t}{/b}")}${run(normal, "{^b}{t}{/b}")}${run(normal, "{/runs}")}</w:p>`;
  return `${vacio(`{#${tag}}`)}${cuerpo}${vacio(`{/${tag}}`)}`;
}

/** Aplica reemplazos de rangos [start,end) → texto sobre el xml (de atrás para adelante). */
export function aplicar(xml, cambios) {
  for (const c of [...cambios].sort((a, b) => b.start - a.start)) xml = xml.slice(0, c.start) + c.nuevo + xml.slice(c.end);
  return xml;
}

/**
 * Reemplaza `buscado` (texto ya escapado, p. ej. "&lt;Director Obra&gt;") aunque Word lo haya
 * partido en varios runs: el reemplazo queda en el primer run (con su formato) y se quita el
 * resto del texto de los runs siguientes. Devuelve [xml, cantidad de reemplazos].
 */
export function reemplazarTexto(xml, buscado, nuevo) {
  let total = 0;
  const cambios = [];
  for (const p of parrafos(xml)) {
    const ts = [...p.xml.matchAll(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g)].map((m) => ({
      ini: p.start + m.index + m[1].length,
      texto: m[2],
    }));
    let unido = ts.map((t) => t.texto).join("");
    if (!unido.includes(buscado)) continue;
    const textos = ts.map((t) => t.texto);
    let desde = 0;
    for (;;) {
      const i = unido.indexOf(buscado, desde);
      if (i < 0) break;
      total++;
      let acum = 0;
      let restante = buscado.length;
      let puesto = false;
      for (let k = 0; k < textos.length && restante > 0; k++) {
        const largo = textos[k].length;
        const ini = Math.max(0, i - acum);
        if (i < acum + largo && ini < largo) {
          const quita = Math.min(largo - ini, restante);
          textos[k] = textos[k].slice(0, ini) + (puesto ? "" : nuevo) + textos[k].slice(ini + quita);
          restante -= quita;
          puesto = true;
        }
        acum += largo;
      }
      unido = textos.join("");
      desde = i + nuevo.length;
    }
    ts.forEach((t, k) => {
      if (textos[k] !== t.texto) cambios.push({ start: t.ini, end: t.ini + t.texto.length, nuevo: textos[k] });
    });
  }
  return [aplicar(xml, cambios), total];
}
