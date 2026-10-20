export function foldText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Lowercase letters+digits only, so `M-1668 A` and `M1668A` compare equal. */
export function compactText(value: unknown) {
  return foldText(value).replace(/[^a-z0-9]+/g, "");
}

/**
 * Every whitespace-separated term of `query` must appear in at least one of
 * the fields; accents and case are ignored. Codes also match without spaces,
 * hyphens or dots (`9898-0319-0371` → `989803190371`). An empty query matches
 * everything.
 */
export function matchesSearch(query: string, fields: unknown[]) {
  const folded = foldText(query).trim();
  if (!folded) return true;
  const terms = folded.split(/\s+/).filter(Boolean);
  const haystack = fields.map(foldText).join(" ");
  const compactHaystack = compactText(fields.join(" "));
  const compactQuery = compactText(query);

  if (compactQuery.length >= 4 && compactHaystack.includes(compactQuery)) {
    return true;
  }

  return terms.every((term) => {
    if (haystack.includes(term)) return true;
    const compactTerm = compactText(term);
    return compactTerm.length >= 4 && compactHaystack.includes(compactTerm);
  });
}
