import { Suspense } from "react";
import { EducationPage } from "@/components/dashboard/education-page";

export default function EducacionRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Cargando educación...
        </div>
      }
    >
      <EducationPage />
    </Suspense>
  );
}
