"use client";

import { useEffect, useRef } from "react";

/** Máximo entre teclas de una ráfaga de lector (una persona escribe más lento). */
const MAX_KEY_GAP_MS = 45;
const MAX_AVG_GAP_MS = 30;
const MIN_LENGTH = 4;
const GS = "\u001d";

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "submit", "reset", "file", "range", "color"].includes(
      target.type
    );
  }
  return false;
}

/**
 * Detecta lecturas de un lector de códigos tipo teclado (HID): caracteres muy
 * rápidos que terminan en Enter o Tab. Fuera de campos de texto, la lectura se
 * consume y se entrega a `onScan`; dentro de un campo se escribe normalmente.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let startedAt = 0;
    let lastAt = 0;
    let keys = 0;

    const reset = () => {
      buffer = "";
      keys = 0;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || isEditable(event.target)) {
        reset();
        return;
      }
      const now = performance.now();
      if (keys && now - lastAt > MAX_KEY_GAP_MS) reset();

      if (event.key === "Enter" || event.key === "Tab") {
        const avg = keys > 1 ? (lastAt - startedAt) / (keys - 1) : Infinity;
        const code = buffer;
        reset();
        if (code.replace(new RegExp(GS, "g"), "").length >= MIN_LENGTH && avg <= MAX_AVG_GAP_MS) {
          event.preventDefault();
          event.stopPropagation();
          onScanRef.current(code);
        }
        return;
      }

      let char = "";
      if (event.ctrlKey && (event.key === "]" || event.code === "BracketRight")) char = GS;
      else if (event.key === GS) char = GS;
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        char = event.key;
      }
      if (!char) return;

      if (!keys) startedAt = now;
      buffer += char;
      keys += 1;
      lastAt = now;
      if (char === GS) event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled]);
}
