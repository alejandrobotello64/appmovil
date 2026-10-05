export function foldText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Every whitespace-separated term of `query` must appear in at least one of
 * the fields; accents and case are ignored. An empty query matches everything.
 */
export function matchesSearch(query: string, fields: unknown[]) {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = fields.map(foldText).join(" ");
  return terms.every((term) => haystack.includes(term));
}
