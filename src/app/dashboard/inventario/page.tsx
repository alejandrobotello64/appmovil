import { redirect } from "next/navigation";

export default function InventarioRedirectPage() {
  redirect("/dashboard/almacen?tab=productos");
}
