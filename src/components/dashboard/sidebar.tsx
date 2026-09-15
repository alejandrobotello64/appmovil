"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, X } from "lucide-react";
import { INVENTORY_CATEGORIES } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/inventario",
    label: "Inventario",
    icon: Package,
    exact: false,
  },
] as const;

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:w-0 lg:overflow-hidden lg:border-r-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#00BFFF] uppercase">
              MAS
            </p>
            <p className="text-sm font-semibold text-foreground">
              Medical Advanced Supplies
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Menú principal
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href.split("?")[0]);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          <p className="mt-6 px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Categorías
          </p>
          <div className="space-y-1 px-1">
            {INVENTORY_CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/dashboard/inventario?category=${category.id}`}
                onClick={onClose}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {category.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            Sistema de inventario médico
          </p>
        </div>
      </aside>
    </>
  );
}
