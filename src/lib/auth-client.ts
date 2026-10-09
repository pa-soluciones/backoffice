import { createAuthClient } from "better-auth/react";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        // Fuera de un componente no hay router: navegación completa.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login/2fa";
      },
    }),
  ],
});

/** Mensaje en español para errores de Better Auth. */
export function mensajeError(error: { status: number; code?: string } | null | undefined) {
  if (!error) return "";
  if (error.status === 429) return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
  if (error.code === "INVALID_CODE" || error.code === "INVALID_TWO_FACTOR_CODE") return "Código incorrecto.";
  if (error.status === 401 || error.status === 403) return "Usuario o contraseña incorrectos.";
  return "No se pudo completar la operación. Probá de nuevo.";
}
