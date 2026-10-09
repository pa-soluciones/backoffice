import "server-only";

/** Convierte un DOCX a PDF con Gotenberg (LibreOffice). Ver spec/01-arquitectura.md §7. */
export async function docxToPdf(docx: Uint8Array, filename = "documento.docx"): Promise<Uint8Array> {
  const form = new FormData();
  form.append("files", new Blob([docx as BlobPart]), filename);

  // Basic auth en Cloud Run; vacío en local (docker compose).
  const { GOTENBERG_USER: user, GOTENBERG_PASSWORD: password } = process.env;
  const res = await fetch(`${process.env.GOTENBERG_URL}/forms/libreoffice/convert`, {
    method: "POST",
    body: form,
    headers: user ? { Authorization: `Basic ${btoa(`${user}:${password}`)}` } : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Gotenberg ${res.status}: ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}
