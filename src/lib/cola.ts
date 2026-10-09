"use client";

// Cola offline de registros de campo (spec/12 RNF-04/05). Todo alta pasa por acá: se guarda en
// IndexedDB y `sincronizar` la manda al servidor en orden (FIFO). Cada registro lleva un `clientId`
// y el servidor lo aplica una sola vez, así los reintentos no duplican.

import type { DatosRegistro } from "@/services/campo";

export type Pendiente = {
  clientId: string;
  presupuestoId: string;
  etiqueta: string; // "2026/0105 · Piso 17 · Ø102 × 2"
  datos: DatosRegistro;
  fotos: { archivo: Blob; nombre: string; tomadaAt: string }[];
  /** Avance: el registro ya se creó en el servidor / cuántas fotos ya subieron. */
  registroId?: string;
  fotosSubidas: number;
  error?: string;
  creada: number;
};

export type Envio = {
  registrar: (presupuestoId: string, clientId: string, d: DatosRegistro) => Promise<{ id: string } | { error: string }>;
  prepararFoto: (registroId: string, f: { nombre: string; mime: string; bytes: number; tomadaAt: string }) => Promise<{ archivoId: string; url: string } | { error: string }>;
  confirmarFoto: (archivoId: string) => Promise<{ ok: true } | { error: string }>;
};

const DB = "pas-campo";
const STORE = "pendientes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "clientId" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const r = fn(db.transaction(STORE, modo).objectStore(STORE));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

const avisar = () => window.dispatchEvent(new Event("pas-cola"));

export async function listar(): Promise<Pendiente[]> {
  return (await tx("readonly", (s) => s.getAll() as IDBRequest<Pendiente[]>)).sort((a, b) => a.creada - b.creada);
}

export async function guardar(p: Pendiente) {
  await tx("readwrite", (s) => s.put(p));
  avisar();
}

export async function descartar(clientId: string) {
  await tx("readwrite", (s) => s.delete(clientId));
  avisar();
}

let corriendo = false;

/**
 * Manda los pendientes en orden. Un rechazo del servidor (ErrorNegocio) deja el pendiente con su
 * motivo y sigue con el próximo; un error de red corta y se reintenta más tarde.
 */
export async function sincronizar(envio: Envio) {
  if (corriendo || !navigator.onLine) return;
  corriendo = true;
  window.dispatchEvent(new Event("pas-cola-inicio"));
  try {
    for (const p of await listar()) {
      if (p.error) continue;
      try {
        if (!p.registroId) {
          const r = await envio.registrar(p.presupuestoId, p.clientId, p.datos);
          if ("error" in r) {
            await guardar({ ...p, error: r.error });
            continue;
          }
          p.registroId = r.id;
          await guardar(p);
        }
        for (; p.fotosSubidas < p.fotos.length; p.fotosSubidas++) {
          const f = p.fotos[p.fotosSubidas];
          const prep = await envio.prepararFoto(p.registroId, { nombre: f.nombre, mime: f.archivo.type, bytes: f.archivo.size, tomadaAt: f.tomadaAt });
          if ("error" in prep) throw new Rechazo(prep.error);
          const put = await fetch(prep.url, { method: "PUT", body: f.archivo, headers: { "Content-Type": f.archivo.type } });
          if (!put.ok) throw new Error(`PUT ${put.status}`);
          const c = await envio.confirmarFoto(prep.archivoId);
          if ("error" in c) throw new Rechazo(c.error);
          await guardar({ ...p, fotosSubidas: p.fotosSubidas + 1 });
        }
        await descartar(p.clientId);
      } catch (e) {
        if (e instanceof Rechazo) {
          await guardar({ ...p, error: `Fotos: ${e.message}` });
          continue;
        }
        return; // sin conexión o servidor caído: se reintenta después
      }
    }
  } finally {
    corriendo = false;
    avisar();
  }
}

class Rechazo extends Error {}
