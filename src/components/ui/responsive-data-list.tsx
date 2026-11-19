"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { chromeLabel } from "@/lib/i18n/chrome";
import { cn } from "@/lib/utils";

export type DataField = {
  label: string;
  value: ReactNode;
  className?: string;
};

export type DataListItem = {
  key: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  fields?: DataField[];
  actions?: ReactNode;
  onSelect?: () => void;
};

type ResponsiveDataListProps = {
  items: DataListItem[];
  emptyMessage?: string;
  className?: string;
};

export function ResponsiveDataList({
  items,
  emptyMessage = "Sin registros.",
  className,
}: ResponsiveDataListProps) {
  const { locale } = useLocale();

  if (items.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-muted-foreground md:hidden">
        {chromeLabel(locale, emptyMessage)}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid w-full max-w-full min-w-0 gap-2 overflow-x-hidden p-2 md:hidden",
        className
      )}
    >
      {items.map((item) => (
        <article
          key={item.key}
          className={cn(
            "box-border w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-border/80 bg-background/60 p-2.5 shadow-sm",
            item.onSelect
              ? "cursor-pointer hover:border-[#3B46A5]/40 hover:bg-muted/40"
              : ""
          )}
          onClick={item.onSelect}
        >
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="min-w-0 text-sm font-medium text-foreground">
                {item.title}
              </div>
              {item.subtitle ? (
                <p className="mt-0.5 line-clamp-2 break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                  {item.subtitle}
                </p>
              ) : null}
            </div>
            {item.badge ? (
              <div className="max-w-[38%] shrink-0 truncate text-right">
                {item.badge}
              </div>
            ) : null}
          </div>

          {item.fields && item.fields.length > 0 ? (
            <dl className="mt-2 grid w-full min-w-0 gap-1.5">
              {item.fields.map((field) => (
                <div
                  key={field.label}
                  className={cn(
                    "grid w-full min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-x-2 gap-y-0.5",
                    field.className
                  )}
                >
                  <dt className="min-w-0 break-words text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                    {chromeLabel(locale, field.label)}
                  </dt>
                  <dd className="min-w-0 break-words text-right text-xs font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {item.actions ? (
            <div
              className="mt-2 grid w-full min-w-0 grid-cols-2 gap-1.5 border-t border-border/70 pt-2 sm:grid-cols-3"
              onClick={(event) => event.stopPropagation()}
            >
              {item.actions}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function DesktopTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hidden max-w-full overflow-x-auto md:block", className)}>
      {children}
    </div>
  );
}
