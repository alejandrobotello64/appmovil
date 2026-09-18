import { Suspense } from "react";
import { ClientsPage } from "@/components/dashboard/clients-page";

export default function ClientesRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando clientes...
        </div>
      }
    >
      <ClientsPage />
    </Suspense>
  );
}
