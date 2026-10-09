import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Chequeo optimista: sin cookie de sesión → /login. La validación real está en services/sesion.ts.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|recuperar|api|_next|icon.svg|manifest.webmanifest|sw.js|logo|email).*)"],
};
