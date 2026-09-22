import type { ReactNode } from "react";
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
  if (items.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground md:hidden">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("grid gap-3 p-4 md:hidden", className)}>
      {items.map((item) => (
        <article
          key={item.key}
          className={cn(
            "rounded-xl border border-border/80 bg-background/60 p-4 shadow-sm",
            item.onSelect
              ? "cursor-pointer hover:border-[#3B46A5]/40 hover:bg-muted/40"
              : ""
          )}
          onClick={item.onSelect}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{item.title}</p>
              {item.subtitle ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.subtitle}
                </p>
              ) : null}
            </div>
            {item.badge ? <div className="shrink-0">{item.badge}</div> : null}
          </div>

          {item.fields && item.fields.length > 0 ? (
            <dl className="mt-3 grid gap-2">
              {item.fields.map((field) => (
                <div
                  key={field.label}
                  className={cn(
                    "flex items-start justify-between gap-3 text-sm",
                    field.className
                  )}
                >
                  <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
                  <dd className="min-w-0 text-right font-medium text-foreground">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {item.actions ? (
            <div
              className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3"
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
    <div className={cn("hidden overflow-x-auto md:block", className)}>
      {children}
    </div>
  );
}
