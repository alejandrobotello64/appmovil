/** Normaliza texto para comparar equipos: "Atlan A350 Xl" y "atlan  a350 XL" son iguales. */
export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Valor más repetido (sin contar vacíos); sirve para elegir la escritura "oficial" de un grupo. */
export function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const clean = value.replace(/\s+/g, " ").trim();
    if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
