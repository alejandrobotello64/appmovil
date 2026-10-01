import { Suspense } from "react";
import { ComprasPage } from "@/components/compras/compras-page";

export default function ComprasRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando compras...
        </div>
      }
    >
      <ComprasPage />
    </Suspense>
  );
}
