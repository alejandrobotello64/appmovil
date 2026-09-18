import { Suspense } from "react";
import { FleetPage } from "@/components/dashboard/fleet-page";

export default function FlotillaRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando flotilla...
        </div>
      }
    >
      <FleetPage />
    </Suspense>
  );
}
