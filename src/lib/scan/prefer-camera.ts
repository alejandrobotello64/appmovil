/**
 * True en móviles / pantallas táctiles.
 * Ya no enciende la cámara al abrir el escáner; sirve solo como pista de UX.
 */
export function prefersCameraScan() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
