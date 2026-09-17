import { Suspense } from "react";
import { CalendarPage } from "@/components/dashboard/calendar-page";

export default function CalendarioRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando calendario...
        </div>
      }
    >
      <CalendarPage />
    </Suspense>
  );
}
