import { connection } from "next/server";
import { ejecutarCronDiario } from "@/services/recordatorios";

// Vercel Cron (vercel.json): todos los días 11:00 UTC = 08:00 Argentina. Vercel manda
// `Authorization: Bearer $CRON_SECRET`; sin el secreto correcto no se ejecuta.
export async function GET(req: Request) {
  await connection();
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) return new Response("No autorizado", { status: 401 });
  const r = await ejecutarCronDiario();
  console.info("[cron] diario", JSON.stringify(r));
  return Response.json(r);
}
