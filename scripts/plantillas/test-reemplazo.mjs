// Prueba rápida de reemplazarTexto (node scripts/plantillas/test-reemplazo.mjs).
import assert from "node:assert/strict";
import { reemplazarTexto } from "./ooxml.mjs";

const p = '<w:p><w:r><w:rPr><w:color w:val="F49600"/></w:rPr><w:t>Director de Obra:</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>&lt;</w:t></w:r><w:r><w:t>Director</w:t></w:r><w:r><w:t xml:space="preserve"> Obra&gt;</w:t></w:r></w:p>';
const [x, n] = reemplazarTexto(p, "&lt;Director Obra&gt;", "{director}");
assert.equal(n, 1);
assert.equal([...x.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("|"), "Director de Obra:| |{director}||");
assert.ok(x.includes('<w:color w:val="F49600"/></w:rPr><w:t>Director de Obra:</w:t>'), "la etiqueta conserva su formato");
const [y, m] = reemplazarTexto("<w:p><w:r><w:t>a &lt;X&gt; b &lt;X&gt;</w:t></w:r></w:p>", "&lt;X&gt;", "{x}");
assert.equal(m, 2);
assert.ok(y.includes("a {x} b {x}"));
console.log("ok reemplazarTexto");
