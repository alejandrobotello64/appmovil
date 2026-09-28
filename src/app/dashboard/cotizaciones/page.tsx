import { redirect } from "next/navigation";

export default function CotizacionesRoutePage() {
  redirect("/dashboard/ventas?tab=cotizaciones");
}
