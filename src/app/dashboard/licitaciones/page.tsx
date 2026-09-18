import { Suspense } from "react";
import { TendersPage } from "@/components/dashboard/tenders-page";

export default function LicitacionesRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando licitaciones...
        </div>
      }
    >
      <TendersPage />
    </Suspense>
  );
}
