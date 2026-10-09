import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor, username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

// spec/03-auth-permisos.md
export const auth = betterAuth({
  appName: "PAS Backoffice",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: { database: { generateId: "uuid" } },
  // Sin registro público: los usuarios los crea un admin.
  emailAndPassword: { enabled: true, minPasswordLength: 10, disableSignUp: true },
  // 30 días deslizantes; sin "recordarme" la cookie dura lo que la sesión del navegador.
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  user: {
    additionalFields: {
      telefono: { type: "string", required: false, input: false },
      activo: { type: "boolean", defaultValue: true, input: false },
      mustChangePassword: { type: "boolean", defaultValue: false, input: false },
      mustCompleteSetup: { type: "boolean", defaultValue: false, input: false },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/username": { window: 15 * 60, max: 5 },
      "/sign-in/email": { window: 15 * 60, max: 5 },
      "/two-factor/verify-totp": { window: 15 * 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 15 * 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Usuarios desactivados no pueden iniciar sesión (RF-USR-03).
        before: async (session) => {
          const [u] = await db
            .select({ activo: schema.user.activo })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          if (!u?.activo) return false;
        },
      },
    },
  },
  plugins: [username(), twoFactor({ issuer: "PAS Backoffice" }), nextCookies()],
});
