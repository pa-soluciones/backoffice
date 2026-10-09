import { describe, expect, it } from "vitest";
import { contenidoCoincide, familiaPorFirma, mimePorNombre } from "./archivos";

const b = (...xs: (number | string)[]) => new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("archivos", () => {
  it("detecta el tipo real por los primeros bytes", () => {
    expect(familiaPorFirma(b(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(familiaPorFirma(b(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(familiaPorFirma(b("RIFF", 0, 0, 0, 0, "WEBPVP8"))).toBe("webp");
    expect(familiaPorFirma(b("%PDF-1.7"))).toBe("pdf");
    expect(familiaPorFirma(b(0x50, 0x4b, 0x03, 0x04))).toBe("zip");
    expect(familiaPorFirma(b("hola"))).toBeNull();
  });

  it("un texto renombrado a .pdf no pasa", () => {
    expect(contenidoCoincide("application/pdf", b("hola, no soy un PDF"))).toBe(false);
    expect(contenidoCoincide("application/pdf", b("%PDF-1.4"))).toBe(true);
    expect(contenidoCoincide("image/png", b(0xff, 0xd8, 0xff))).toBe(false);
    expect(contenidoCoincide("text/html", b("<html>"))).toBe(false);
  });

  it("tipo por extensión", () => {
    expect(mimePorNombre("Plano Planta Baja.DWG")).toBe("image/vnd.dwg");
    expect(mimePorNombre("foto.jpeg")).toBe("image/jpeg");
    expect(mimePorNombre("virus.exe")).toBeNull();
  });
});
