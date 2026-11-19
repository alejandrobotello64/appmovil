import fs from "fs";
const s = fs.readFileSync("src/lib/i18n/chrome.ts", "utf8");
const keys = [];
const re = /^\s*(?:"([^"]+)"|([A-Za-zÁÉÍÓÚÑáéíóúñ_][\wÁÉÍÓÚÑáéíóúñ]*)):\s*"/gm;
let m;
while ((m = re.exec(s))) keys.push(m[1] || m[2]);
const seen = new Map();
for (const k of keys) seen.set(k, (seen.get(k) || 0) + 1);
for (const [k, v] of seen) if (v > 1) console.log(v, k);
