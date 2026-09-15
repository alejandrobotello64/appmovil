import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModalShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function ModalShell({
  title,
  description,
  children,
  className,
}: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[90vh] sm:rounded-2xl",
          className
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="shrink-0 border-b border-border px-4 py-4 sm:px-5">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
      </div>
    </div>
  );
}
