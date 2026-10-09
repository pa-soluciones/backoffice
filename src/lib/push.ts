import "server-only";
import webpush from "web-push";

// Web Push (spec/09). Sin VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY configuradas, no se envía nada.

export const vapidPublica = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

let listo = false;
function configurar() {
  const publica = vapidPublica();
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;
  if (!listo) {
    webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACTO ?? "notificaciones@pasoluciones.com.ar"}`, publica, privada);
    listo = true;
  }
  return true;
}

export const pushConfigurado = () => !!vapidPublica() && !!process.env.VAPID_PRIVATE_KEY;

/** Envía un push. Devuelve "vencida" si la suscripción ya no existe (hay que borrarla). */
export async function enviarPush(sub: { endpoint: string; p256dh: string; auth: string }, datos: { titulo: string; cuerpo?: string | null; link?: string | null }) {
  if (!configurar()) return "sin_configurar" as const;
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(datos), { TTL: 60 * 60 * 24 });
    return "ok" as const;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "vencida" as const;
    console.error("[push] falló", status ?? e);
    return "error" as const;
  }
}
