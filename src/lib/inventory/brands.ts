/** Marcas que se eligen en un toque al alta y al filtrar el catálogo. */
export const QUICK_BRANDS = [
  "Dräger",
  "Philips",
  "Masimo",
  "3M",
  "ASP",
  "Welch Allyn",
  "Halyard",
  "Edwards Lifesciences",
  "Hill-Rom / Baxter",
  "Fisher & Paykel",
  "B. Braun",
  "seca",
  "Mortara",
] as const;

export function normalizeBrand(value: string | null | undefined): string {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const folded = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (folded.startsWith("drag")) return "Dräger";
  if (folded.startsWith("phil")) return "Philips";
  if (folded.startsWith("masimo")) return "Masimo";
  if (folded === "3m") return "3M";
  if (folded === "asp" || folded.includes("advanced sterilization")) return "ASP";
  if (folded === "wa" || folded.includes("welch")) return "Welch Allyn";
  if (folded.startsWith("halyard")) return "Halyard";
  if (folded.startsWith("edward")) return "Edwards Lifesciences";
  if (
    folded.includes("hill") ||
    folded.includes("baxter") ||
    folded.includes("hil-rom") ||
    folded.includes("hil rom")
  ) {
    return "Hill-Rom / Baxter";
  }
  if (folded.includes("fisher") || folded.includes("paykel") || folded === "f&p") {
    return "Fisher & Paykel";
  }
  if (folded.includes("braun") || folded === "bbraun" || folded === "b braun") {
    return "B. Braun";
  }
  if (folded === "seca") return "seca";
  if (folded.startsWith("mortara")) return "Mortara";
  return raw;
}

export function uniqueBrands(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const brand = normalizeBrand(value);
    if (!brand) continue;
    const key = brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(brand);
  }
  return result.sort((a, b) => a.localeCompare(b, "es"));
}
