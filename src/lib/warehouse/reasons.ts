export const ENTRY_REASONS = [
  { id: "entrada_mercancia", label: "Entrada de mercancía" },
  { id: "recepcion_oc", label: "Recepción de orden de compra" },
  { id: "devolucion_cliente", label: "Devolución de cliente" },
  { id: "ajuste_sobrante", label: "Ajuste por sobrante" },
] as const;

export const ISSUE_REASONS = [
  { id: "venta", label: "Venta" },
  { id: "instalacion", label: "Instalación" },
  { id: "servicio_tecnico", label: "Servicio técnico" },
  { id: "consumo_interno", label: "Consumo interno" },
  { id: "prestamo", label: "Préstamo" },
  { id: "transferencia", label: "Transferencia" },
  { id: "devolucion_proveedor", label: "Devolución a proveedor" },
  { id: "muestra", label: "Muestra" },
  { id: "baja", label: "Baja" },
] as const;

export type IssueReasonId = (typeof ISSUE_REASONS)[number]["id"];
export type EntryReasonId = (typeof ENTRY_REASONS)[number]["id"];

export function isServiceIssue(reason: string) {
  return reason === "servicio_tecnico" || reason === "instalacion";
}
