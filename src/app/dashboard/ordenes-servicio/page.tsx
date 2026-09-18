import { Suspense } from "react";
import { ServiceOrdersPage } from "@/components/dashboard/service-orders-page";

export default function OrdenesServicioRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando órdenes de servicio...
        </div>
      }
    >
      <ServiceOrdersPage />
    </Suspense>
  );
}
