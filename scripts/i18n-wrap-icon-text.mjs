import fs from "fs";
import path from "path";

const chromeSrc = fs.readFileSync("src/lib/i18n/chrome.ts", "utf8");
const CHROME = [
  ...chromeSrc.matchAll(/^\s*(?:\"([^\"]+)\"|[A-Za-zÁÉÍÓÚÑáéíóúñ][^:]*?):\s*\"/gm),
]
  .map((m) => (m[1] ?? m[0].split(":")[0].trim()).replace(/^"|"$/g, ""))
  .filter(Boolean);
// Prefer explicit list from wrap script for reliability
const LIST = JSON.parse(
  fs.readFileSync(new URL("./i18n-chrome-labels.json", import.meta.url), "utf8")
);

LIST.sort((a, b) => b.length - a.length);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", ".next"].includes(entry.name)) walk(full, out);
    } else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function addUiImport(src) {
  if (src.includes('from "@/components/ui/ui-text"')) return src;
  const line = `import { Ui } from "@/components/ui/ui-text";\n`;
  if (src.includes('"use client"')) {
    return src.replace(/("use client";\r?\n)/, `$1${line}`);
  }
  return line + src;
}

let filesChanged = 0;
let hits = 0;

for (const file of walk(path.join("src", "components"))) {
  const base = path.basename(file);
  if (["ui-text.tsx", "th.tsx", "sortable-table.tsx"].includes(base)) continue;

  let src = fs.readFileSync(file, "utf8");
  const original = src;
  let usedUi = false;

  for (const label of LIST) {
    const re = new RegExp(
      `(/>)\\s*${escapeRe(label)}\\s*(</(?:button|Button|span)>)`,
      "g"
    );
    src = src.replace(re, (full, open, close) => {
      if (full.includes("<Ui>")) return full;
      hits += 1;
      usedUi = true;
      return `${open} <Ui>${label}</Ui>${close}`;
    });
  }

  if (src !== original) {
    if (usedUi) src = addUiImport(src);
    fs.writeFileSync(file, src);
    filesChanged += 1;
  }
}

console.log(JSON.stringify({ filesChanged, hits, labels: LIST.length }, null, 2));
