import { Suspense } from "react";
import { WarehousePage } from "@/components/warehouse/warehouse-page";

export default function AlmacenRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando almacén...
        </div>
      }
    >
      <WarehousePage />
    </Suspense>
  );
}
