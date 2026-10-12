export type CatalogPhotoItem = {
  sku: string;
  name: string;
  brand: string;
  partNumber: string;
  category: string;
};

function xml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapName(name: string, size = 28) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > size && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === 3) break;
  }
  if (current && lines.length < 4) lines.push(current);
  if (!lines.length) lines.push("Producto");
  return lines.slice(0, 4);
}

function pictogram(category: string) {
  if (category === "equipos") {
    return `<rect x="140" y="118" width="200" height="132" rx="14" fill="#e8eefc" stroke="#3B46A5" stroke-width="8"/>
      <rect x="168" y="142" width="144" height="72" rx="8" fill="#3B46A5"/>
      <circle cx="240" cy="274" r="16" fill="#00BFFF"/>`;
  }
  if (category === "insumos") {
    return `<rect x="150" y="124" width="180" height="140" rx="16" fill="#fde8e8" stroke="#e11d48" stroke-width="8"/>
      <path d="M168 168h144M168 198h144M168 228h96" stroke="#e11d48" stroke-width="8" stroke-linecap="round"/>`;
  }
  if (category === "refacciones") {
    return `<circle cx="240" cy="194" r="78" fill="#fff7ed" stroke="#ea580c" stroke-width="10"/>
      <circle cx="240" cy="194" r="28" fill="#ea580c"/>`;
  }
  return `<path d="M240 112l78 46v92l-78 46-78-46v-92z" fill="#ecfeff" stroke="#0f766e" stroke-width="8"/>
    <circle cx="240" cy="194" r="22" fill="#0f766e"/>`;
}

export function catalogPhotoSvg(item: CatalogPhotoItem) {
  const lines = wrapName(item.name);
  const lineNodes = lines
    .map(
      (line, index) =>
        `<text x="240" y="${348 + index * 28}" text-anchor="middle" font-size="22" font-weight="700" fill="#111827">${xml(line)}</text>`
    )
    .join("");
  const part = item.partNumber || item.sku;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 480 480">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="480" height="480" fill="url(#bg)"/>
  <rect x="28" y="28" width="424" height="424" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <path d="M28 28h148l-40 40H28z" fill="#e11d48"/>
  <text x="46" y="54" font-size="13" font-weight="800" fill="#ffffff">FOTO</text>
  ${pictogram(item.category)}
  <text x="240" y="312" text-anchor="middle" font-size="15" font-weight="700" fill="#3B46A5">${xml(item.brand || "MAS")}</text>
  ${lineNodes}
  <rect x="96" y="430" width="288" height="36" rx="18" fill="#111827"/>
  <text x="240" y="453" text-anchor="middle" font-size="16" font-family="ui-monospace, monospace" fill="#ffffff">${xml(part)}</text>
</svg>`;
}
