import "server-only";
import { AwsClient } from "aws4fetch";

// Cliente crudo de R2 (API S3). SOLO lo usa services/almacenamiento.ts, que reserva cupo
// del free tier antes de cada operación. No importar desde otro lado.

export const configurado = () =>
  !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID));

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT } = process.env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !(R2_ENDPOINT || R2_ACCOUNT_ID)) {
    throw new Error("Faltan las variables de R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)");
  }
  // R2_ENDPOINT permite usar MinIO en desarrollo.
  const endpoint = R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return {
    base: `${endpoint.replace(/\/$/, "")}/${R2_BUCKET}`,
    client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
  };
}

const url = (base: string, key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** URL firmada (query string) válida por `segundos`. */
async function firmar(method: "GET" | "PUT", key: string, segundos: number, params: Record<string, string> = {}) {
  const { base, client } = config();
  const u = new URL(url(base, key));
  u.searchParams.set("X-Amz-Expires", String(segundos));
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const req = await client.sign(new Request(u, { method }), { aws: { signQuery: true } });
  return req.url;
}

export const urlSubidaFirmada = (key: string, segundos = 600) => firmar("PUT", key, segundos);

export const urlDescargaFirmada = (key: string, nombre: string, segundos = 300) =>
  firmar("GET", key, segundos, { "response-content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}` });

export async function subir(key: string, cuerpo: Uint8Array, mime: string) {
  const { base, client } = config();
  const res = await client.fetch(url(base, key), { method: "PUT", body: cuerpo as BodyInit, headers: { "Content-Type": mime } });
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${await res.text()}`);
}

/** Tamaño real del objeto (para confirmar una subida directa del navegador). */
export async function tamanio(key: string): Promise<number | null> {
  const { base, client } = config();
  const res = await client.fetch(url(base, key), { method: "HEAD" });
  return res.ok ? Number(res.headers.get("content-length")) : null;
}

export async function borrar(key: string) {
  const { base, client } = config();
  const res = await client.fetch(url(base, key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}`);
}
