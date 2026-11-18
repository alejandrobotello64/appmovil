"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { scanSearchMode } from "./search-fields";

/** Máximo entre teclas de una ráfaga de lector (una persona escribe más lento). */
const MAX_KEY_GAP_MS = 90;
const MAX_AVG_GAP_MS = 45;
/** Sin Enter/Tab de sufijo, la lectura se da por terminada tras este silencio. */
const IDLE_MS = 200;
const MIN_LENGTH = 4;
const MIN_LENGTH_WITHOUT_SUFFIX = 6;
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

function isFastBurst(keys: number, startedAt: number, lastAt: number, minLength: number) {
  if (keys < minLength) return false;
  return (lastAt - startedAt) / (keys - 1) <= MAX_AVG_GAP_MS;
}

/**
 * Detecta lecturas de un lector de códigos tipo teclado (HID): caracteres muy
 * rápidos que terminan en Enter/Tab o en un silencio breve. Fuera de campos de
 * texto, la lectura se entrega a `onScan`; en un buscador (ver `scanSearchMode`)
 * se escribe normalmente y al terminar se entrega a `onFieldScan`; en otros
 * campos no se intercepta.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  options: {
    enabled?: boolean;
    onFieldScan?: (input: HTMLInputElement, code: string) => void;
  } = {}
) {
  const enabled = options.enabled ?? true;
  const onScanRef = useRef(onScan);
  const onFieldScanRef = useRef(options.onFieldScan);
  useEffect(() => {
    onScanRef.current = onScan;
    onFieldScanRef.current = options.onFieldScan;
  }, [onScan, options.onFieldScan]);

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let startedAt = 0;
    let lastAt = 0;
    let keys = 0;
    let idleTimer = 0;
    let field: HTMLInputElement | null = null;

    const reset = () => {
      buffer = "";
      keys = 0;
      field = null;
      window.clearTimeout(idleTimer);
    };

    const flushIfScan = (minLength: number) => {
      const code = buffer;
      const target = field;
      const fast = isFastBurst(keys, startedAt, lastAt, minLength);
      reset();
      if (fast && code.replace(new RegExp(GS, "g"), "").length >= minLength) {
        if (target) onFieldScanRef.current?.(target, code);
        else onScanRef.current(code);
        return true;
      }
      return false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const searchField =
        onFieldScanRef.current && scanSearchMode(event.target)
          ? (event.target as HTMLInputElement)
          : null;
      if (event.isComposing || (isEditable(event.target) && !searchField)) {
        reset();
        return;
      }
      const now = performance.now();
      if (keys && (now - lastAt > MAX_KEY_GAP_MS || field !== searchField)) reset();

      if (event.key === "Enter" || event.key === "Tab") {
        if (keys && flushIfScan(MIN_LENGTH)) {
          event.preventDefault();
          event.stopPropagation();
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

      if (!keys) {
        startedAt = now;
        field = searchField;
      }
      buffer += char;
      keys += 1;
      lastAt = now;
      if (char === GS) event.preventDefault();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => flushIfScan(MIN_LENGTH_WITHOUT_SUFFIX), IDLE_MS);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.clearTimeout(idleTimer);
    };
  }, [enabled]);
}

/**
 * Para un campo de texto donde el lector escribe sin Enter: al terminar una
 * ráfaga rápida entrega el valor del campo (p. ej. para buscar o agregar).
 */
export function useScanBurstInput(onBurst: (value: string) => void) {
  const onBurstRef = useRef(onBurst);
  const state = useRef({ startedAt: 0, lastAt: 0, keys: 0, timer: 0 });
  useEffect(() => {
    onBurstRef.current = onBurst;
  }, [onBurst]);
  useEffect(() => {
    const current = state.current;
    return () => window.clearTimeout(current.timer);
  }, []);

  return useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    const current = state.current;
    if (event.key === "Enter" || event.key === "Tab") {
      window.clearTimeout(current.timer);
      current.keys = 0;
      return;
    }
    if (event.key.length !== 1) return;
    const now = performance.now();
    if (!current.keys || now - current.lastAt > MAX_KEY_GAP_MS) {
      current.keys = 0;
      current.startedAt = now;
    }
    current.keys += 1;
    current.lastAt = now;
    const input = event.currentTarget;
    window.clearTimeout(current.timer);
    current.timer = window.setTimeout(() => {
      const fast = isFastBurst(
        current.keys,
        current.startedAt,
        current.lastAt,
        MIN_LENGTH_WITHOUT_SUFFIX
      );
      current.keys = 0;
      if (fast && input.value.trim()) onBurstRef.current(input.value);
    }, IDLE_MS);
  }, []);
}

/** Evento con el que el lector serie entrega un código al campo enfocado. */
export const SCAN_TARGET_EVENT = "mas-scan";

/**
 * Hace que el campo reciba los códigos del lector serie mientras tiene el foco
 * (el campo debe llevar `data-scan-target="true"`).
 */
export function useScanTarget(
  ref: { current: HTMLElement | null },
  onCode: (code: string) => void
) {
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handle = (event: Event) => onCodeRef.current(String((event as CustomEvent).detail ?? ""));
    element.addEventListener(SCAN_TARGET_EVENT, handle);
    return () => element.removeEventListener(SCAN_TARGET_EVENT, handle);
  }, [ref]);
}
