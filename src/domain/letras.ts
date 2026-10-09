// Montos en letras para las certificaciones (spec/06 §3.3):
// "PESOS DOS MILLONES OCHOCIENTOS TREINTA Y SEIS MIL CON 00/100".

import type { Moneda } from "./montos";

const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DIEZ_A_VEINTINUEVE = [
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
  "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

/** 0..999 */
function hastaMil(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const resto = r === 0 ? "" : r < 10 ? UNIDADES[r] : r < 30 ? DIEZ_A_VEINTINUEVE[r - 10] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` Y ${UNIDADES[r % 10]}` : ""}`;
  return [CENTENAS[c], resto].filter(Boolean).join(" ");
}

/** "UNO" → "UN" delante de MIL / MILLÓN ("VEINTIÚN MIL", "UN MILLÓN"). */
const apocope = (s: string) => s.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");

/** Entero en letras (mayúsculas), hasta 999.999.999.999. */
export function enteroEnLetras(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "UN MILLÓN" : `${apocope(enteroEnLetras(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? "MIL" : `${apocope(hastaMil(miles))} MIL`);
  if (resto) partes.push(hastaMil(resto));
  return partes.join(" ");
}

const NOMBRE: Record<Moneda, string> = { ARS: "PESOS", USD: "DÓLARES ESTADOUNIDENSES" };

export function montoEnLetras(monto: number, moneda: Moneda) {
  const centavos = Math.round(Math.abs(monto) * 100);
  const entero = Math.floor(centavos / 100);
  return `${NOMBRE[moneda]} ${enteroEnLetras(entero)} CON ${String(centavos % 100).padStart(2, "0")}/100`;
}
