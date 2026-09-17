import { Suspense } from "react";
import { UsersPage } from "@/components/dashboard/users-page";

export default function UsuariosRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando usuarios...
        </div>
      }
    >
      <UsersPage />
    </Suspense>
  );
}
