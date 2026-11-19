import fs from "fs";

const labels = JSON.parse(fs.readFileSync("scripts/i18n-chrome-labels.json", "utf8"));
let src = fs.readFileSync("src/lib/i18n/chrome.ts", "utf8");

function hasKey(srcText, label) {
  const quoted = `"${label.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  if (srcText.includes(`${quoted}:`)) return true;
  // bare identifier keys only if label is a valid identifier-ish without spaces
  if (/^[A-Za-zÁÉÍÓÚÑáéíóúñ][\wÁÉÍÓÚÑáéíóúñ]*$/.test(label) && srcText.includes(`  ${label}:`)) {
    return true;
  }
  return false;
}

const missing = labels.filter((l) => !hasKey(src, l));
console.log("missing", missing.length);
if (!missing.length) process.exit(0);

// Temporary EN: keep Spanish until curated — better to use identity than leave untranslated?
// Actually user wants EN — use a simple dictionary for remaining common ones, else leave Spanish.
const EXTRA = {
  Montos: "Amounts",
  "Buenos días": "Good morning",
  "Buenas tardes": "Good afternoon",
  "Buenas noches": "Good evening",
  Hola: "Hello",
};

const additions = missing
  .map((label) => {
    const en = EXTRA[label] ?? null;
    if (!en) return null;
    const key = /[^A-Za-z0-9_]/.test(label) || /[ÁÉÍÓÚÑáéíóúñ]/.test(label)
      ? `"${label.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      : label;
    return `  ${key}: "${en}",`;
  })
  .filter(Boolean);

if (additions.length) {
  src = src.replace(
    /(\n\};\n\n\/\*\* Traduce chrome)/,
    `\n${additions.join("\n")}\n};\n\n/** Traduce chrome`
  );
  // fix double }; if broken - the map ends with };
  fs.writeFileSync("src/lib/i18n/chrome.ts", src);
}

console.log("added", additions.length);
console.log(
  "still missing (will stay ES until mapped):",
  missing.filter((l) => !EXTRA[l]).slice(0, 50)
);
