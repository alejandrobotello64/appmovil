"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, RefreshCcw } from "lucide-react";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import {
  getWarehouseLocations,
  getWarehouses,
  type Warehouse,
  type WarehouseLocation,
} from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions } from "@/lib/auth/use-permissions";
import { ExpiredExchangeForm } from "./movements/expired-exchange-form";
import { MovementHistory } from "./movements/movement-history";
import { Alert } from "./movements/movement-ui";
import { StockMoveForm } from "./movements/stock-move-form";

type Mode = "traslado" | "canje";

const MODES: { id: Mode; label: string; description: string; icon: typeof ArrowLeftRight }[] = [
  {
    id: "traslado",
    label: "Traspaso / ubicación",
    description:
      "Mueve existencias entre almacenes o entre ubicaciones del mismo almacén, respetando lote y números de serie.",
    icon: ArrowLeftRight,
  },
  {
    id: "canje",
    label: "Canje caducado",
    description:
      "Cambia con el proveedor un lote de insumo caducado o por caducar por un lote nuevo, en el mismo almacén y ubicación.",
    icon: RefreshCcw,
  },
];

type Catalogs = {
  products: InventoryItem[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  suppliers: Supplier[];
};

async function loadCatalogs(): Promise<Catalogs> {
  const [products, warehouses, locations, suppliers] = await Promise.all([
    getInventoryItems(),
    getWarehouses(),
    getWarehouseLocations(),
    getSuppliers(),
  ]);
  return {
    products,
    warehouses,
    locations,
    suppliers: suppliers.filter((item) => item.isActive),
  };
}

export function MovementsPanel() {
  const { canWrite } = usePermissions("movimientos");
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("traslado");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadCatalogs()
      .then((data) => {
        if (!cancelled) setCatalogs(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los catálogos.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleDone = () => setRefreshKey((key) => key + 1);
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Movimientos</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{activeMode.description}</p>
          </div>
          <div className="flex w-full flex-col gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:inline-flex sm:w-auto sm:flex-row">
            {MODES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm sm:py-1.5",
                    mode === item.id
                      ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <ReadOnlyBanner visible={!canWrite} />
        </div>

        <div className="mt-5 max-w-4xl">
          {error ? (
            <Alert tone="error">{error}</Alert>
          ) : !catalogs ? (
            <p className="text-sm text-muted-foreground">Cargando catálogos...</p>
          ) : mode === "traslado" ? (
            <StockMoveForm
              products={catalogs.products}
              warehouses={catalogs.warehouses}
              locations={catalogs.locations}
              canWrite={canWrite}
              onDone={handleDone}
            />
          ) : (
            <ExpiredExchangeForm
              products={catalogs.products}
              suppliers={catalogs.suppliers}
              warehouses={catalogs.warehouses}
              canWrite={canWrite}
              onDone={handleDone}
            />
          )}
        </div>
      </section>

      <MovementHistory warehouses={catalogs?.warehouses ?? []} refreshKey={refreshKey} />
    </div>
  );
}
