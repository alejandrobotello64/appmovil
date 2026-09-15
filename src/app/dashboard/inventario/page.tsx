import { Suspense } from "react";
import { InventoryPage } from "@/components/inventory/inventory-page";

export default function InventarioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando inventario...
        </div>
      }
    >
      <InventoryPage />
    </Suspense>
  );
}
