// CUIT/CUIL argentino: 11 dígitos, el último es verificador (módulo 11).

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Deja solo dígitos: "30-71234567-1" → "30712345671". */
export const soloDigitos = (s: string) => s.replace(/\D/g, "");

export function cuitValido(cuit: string): boolean {
  const d = soloDigitos(cuit);
  if (d.length !== 11) return false;
  const suma = PESOS.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  return verificador !== 10 && verificador === Number(d[10]);
}

/** Formato de impresión: "30-71234567-1". */
export function formatearCuit(cuit: string): string {
  const d = soloDigitos(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit;
}
