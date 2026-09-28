import { Suspense } from "react";
import { SalesPage } from "@/components/dashboard/sales-page";

export default function VentasRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando ventas...
        </div>
      }
    >
      <SalesPage />
    </Suspense>
  );
}
