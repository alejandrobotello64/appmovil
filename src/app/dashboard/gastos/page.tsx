import { Suspense } from "react";
import { ExpensesPage } from "@/components/dashboard/expenses-page";

export default function GastosRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando gastos...
        </div>
      }
    >
      <ExpensesPage />
    </Suspense>
  );
}
