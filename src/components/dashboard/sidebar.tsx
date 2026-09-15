"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Wrench,
  History,
  BookOpen,
  X,
} from "lucide-react";
import { WAREHOUSE_TABS } from "@/lib/warehouse/tabs";
import { cn } from "@/lib/utils";

const TAB_ICONS = {
  dashboard: LayoutDashboard,
  productos: Package,
  entradas: ArrowDownToLine,
  salidas: ArrowUpFromLine,
  movimientos: History,
  kardex: BookOpen,
  pedidos: ShoppingCart,
  proveedores: Truck,
  equipo: Wrench,
  mantenimientos: ClipboardList,
  reporte: FileBarChart2,
  usuarios: Users,
} as const;

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");
  const inWarehouse = pathname.startsWith("/dashboard/almacen");
  const [warehouseOpen, setWarehouseOpen] = useState(inWarehouse);

  useEffect(() => {
    if (inWarehouse) setWarehouseOpen(true);
  }, [inWarehouse]);

  function handleWarehouseClick() {
    const nextOpen = !warehouseOpen;
    setWarehouseOpen(nextOpen);
    if (nextOpen) {
      router.push("/dashboard/almacen?tab=dashboard");
    }
  }

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
          open
            ? "translate-x-0"
            : "-translate-x-full lg:w-0 lg:overflow-hidden lg:border-r-0"
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

          <Link
            href="/dashboard"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === "/dashboard"
                ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            Inicio
          </Link>

          <div className="mt-2">
            <button
              type="button"
              onClick={handleWarehouseClick}
              aria-expanded={warehouseOpen}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                inWarehouse || warehouseOpen
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Warehouse className="size-4 shrink-0" />
              <span className="flex-1">Almacén</span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  warehouseOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </button>

            {warehouseOpen ? (
              <div className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                {WAREHOUSE_TABS.map((tab) => {
                  const Icon = TAB_ICONS[tab.id];
                  const isActive =
                    inWarehouse &&
                    (activeTab === tab.id ||
                      (!activeTab && tab.id === "dashboard"));

                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            Dashboard y operaciones de almacén
          </p>
        </div>
      </aside>
    </>
  );
}
