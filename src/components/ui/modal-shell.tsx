"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type ModalShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
};

export function ModalShell({
  title,
  description,
  children,
  className,
  headerAction,
}: ModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/50"
      style={{ isolation: "isolate" }}
    >
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "flex max-h-[min(92dvh,920px)] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[min(85vh,880px)] sm:rounded-2xl",
            className
          )}
          style={{
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {headerAction ? (
              <div className="shrink-0 pt-0.5">{headerAction}</div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
