import { Suspense } from "react";
import { QualityPage } from "@/components/dashboard/quality-page";

export default function CalidadRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando calidad...
        </div>
      }
    >
      <QualityPage />
    </Suspense>
  );
}
