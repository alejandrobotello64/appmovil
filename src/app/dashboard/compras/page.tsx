import { Suspense } from "react";
import { PurchasingPage } from "@/components/dashboard/purchasing-page";

export default function ComprasRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando compras...
        </div>
      }
    >
      <PurchasingPage />
    </Suspense>
  );
}
