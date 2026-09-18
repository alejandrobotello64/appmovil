import { Suspense } from "react";
import { QuotesPage } from "@/components/dashboard/quotes-page";

export default function CotizacionesRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando cotizaciones...
        </div>
      }
    >
      <QuotesPage />
    </Suspense>
  );
}
