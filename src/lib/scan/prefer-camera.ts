/** True en móviles / pantallas táctiles (priorizar cámara al abrir el escáner). */
export function prefersCameraScan() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
