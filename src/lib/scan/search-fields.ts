"use client";

import { parseScan } from "./codes";
import { resolveScan } from "./lookup";

/**
 * Buscadores que reciben lecturas del lector:
 * - `type="search"` o texto de ayuda que empieza por "Buscar"/"Busca": reciben la
 *   lectura con foco y, sin foco, si son el primer buscador visible de la pantalla.
 * - `data-scan-search="true"`: igual, para buscadores con otro texto de ayuda.
 * - `data-scan-search="focus"`: solo con foco (p. ej. el buscador global).
 * - `data-scan-search="off"`: nunca.
 */
export function scanSearchMode(element: EventTarget | null): "page" | "focus" | null {
  if (!(element instanceof HTMLInputElement)) return null;
  if (element.disabled || element.readOnly || element.dataset.scanTarget === "true") return null;
  const mode = element.dataset.scanSearch;
  if (mode === "off") return null;
  if (mode === "focus") return "focus";
  if (mode === "true" || element.type === "search" || /^\s*busca/i.test(element.placeholder)) {
    return "page";
  }
  return null;
}

/** Primer buscador visible de la ventana abierta (o de la pantalla si no hay ventana). */
export function findPageSearchField() {
  const dialogs = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
  const scope: ParentNode = dialogs.length ? dialogs[dialogs.length - 1] : document;
  for (const input of scope.querySelectorAll("input")) {
    if (scanSearchMode(input) === "page" && input.getClientRects().length) return input;
  }
  return null;
}

/** Cambia el valor de un input controlado por React disparando su onChange. */
function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Escribe la lectura en el buscador. Si es un código de barras vinculado a un
 * producto (EAN/GS1), lo sustituye por el SKU para que lo encuentre cualquier buscador.
 */
export async function fillSearchField(input: HTMLInputElement, raw: string) {
  const scan = parseScan(raw);
  const text = scan.gs1?.gtin ?? scan.code;
  if (!text) return;
  input.focus();
  setInputValue(input, text);
  try {
    const match = (await resolveScan(raw)).matches[0];
    if (match?.kind === "barcode" && input.value === text) setInputValue(input, match.item.sku);
  } catch {
    /* sin conexión: se queda el código leído */
  }
}
