import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { armar, bloquesPorDefecto, type DatosControl } from "@/documents/control";
import { renderDocx } from "@/documents/render";
import { balance } from "@/domain/balance";

// Los registros del Word de ejemplo (pisos 17 al 2) contra 16 Ø102 + 8 Ø152 cotizadas.
const r = (piso: string, diametroMm: number, cantidad: number, observacion: string | null = null) =>
  ({ piso, elemento: "Viga", espesorCm: 29, diametroMm, cantidad, estado: "finalizado", observacion }) as const;
const registros = [
  ...["17", "16", "15", "14", "13", "12", "11"].map((p) => r(p, 102, 2)),
  r("10", 102, 1),
  r("9", 102, 1),
  r("9", 152, 1, "1ra u. de 152 mm"),
  r("8", 102, 1),
  r("8", 152, 2, "2da y 3ra u. de 152 mm"),
  r("7", 102, 2),
  ...["6", "5", "4", "3", "2"].map((p) => r(p, 102, 1)),
];
const datos: DatosControl = {
  codigo: "2026/0105-CP1",
  fecha: new Date("2026-08-27T15:00:00Z"),
  cliente: "Constructora Ejemplo",
  director: "Martín Gómez",
  direccion: "Av. Córdoba 1234, CABA",
  operadores: ["Juan Pérez", "Ana Díaz"],
  registros: [...registros],
  balance: balance(
    [
      { diametroMm: 102, cantidad: 16, precioUnitario: 1 },
      { diametroMm: 152, cantidad: 8, precioUnitario: 1 },
    ],
    registros,
  ),
};

const texto = (docx: Uint8Array, parte: string) =>
  [...new PizZip(docx).file(parte)!.asText().matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

describe("documento control de perforaciones", () => {
  it("reproduce el Word de ejemplo: registro por piso, total ejecutado y balance", () => {
    const docx = renderDocx("control", armar(datos, bloquesPorDefecto(datos)));
    const header = texto(docx, "word/header1.xml");
    const cuerpo = texto(docx, "word/document.xml");
    expect(header).toContain("Constructora Ejemplo");
    expect(header).toContain("Ø 102 mm y Ø 152 mm");
    expect(cuerpo).toContain("Operador: Juan Pérez, Ana Díaz");
    expect(cuerpo).toContain("27/08/2026");
    expect(cuerpo).toContain("Registro Detallado por Piso (Pisos 17 al 2)");
    expect(cuerpo).toContain("Total Ejecutado (Pisos 17 al 2)");
    expect(cuerpo).toContain("Finalizado (2da y 3ra u. de 152 mm)");
    expect(cuerpo.match(/Piso \d+Viga/g)).toHaveLength(18);
    expect(cuerpo).toContain("Ø 102 mm24 unidades");
    expect(cuerpo).toContain("27 unidades");
    expect(cuerpo).toContain("102 mm16 u.24 u.+8 unidades (Ejecutadas en exceso)");
    expect(cuerpo).toContain("152 mm8 u.3 u.-5 unidades (Pendientes de realizar)");
    expect(cuerpo).toContain("TOTALES24 u.27 u.+3 unidades en total general");
    expect(cuerpo).toContain("correspondientes a 16 unidades de 102 mm y 8 unidades de 152 mm");
    expect(cuerpo).toContain("Al finalizar los trabajos hasta el piso 2");
    expect(cuerpo).toContain("lo cual representa 8 unidades de más (+8 u. extra)");
    const xml = new PizZip(docx).file("word/document.xml")!.asText();
    expect(xml).toContain('EE0000"/></w:rPr><w:t xml:space="preserve">-5 unidades'); // pendiente en rojo
    expect(xml).toContain('00B050"/></w:rPr><w:t xml:space="preserve">+8 unidades'); // exceso en verde
    expect(`${header}${cuerpo}`).not.toMatch(/\{[#/^]?\w+\}|&lt;[^&]+&gt;|___/);
  });
});
