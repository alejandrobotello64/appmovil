"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  PackageCheck,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { getPurchaseRequests } from "@/lib/compras/storage";
import {
  isOpenPurchaseRequest,
  purchaseRequestStatusLabel,
  type PurchaseRequest,
} from "@/lib/compras/types";
import { getPurchaseOrders } from "@/lib/warehouse/orders";
import type { PurchaseOrder } from "@/lib/warehouse/orders";
import { cn } from "@/lib/utils";

type Kpi = {
  label: string;
  value: string | number;
  hint: string;
  href: string;
  icon: LucideIcon;
};

function pendingQty(order: PurchaseOrder) {
  return order.items.reduce(
    (sum, line) => sum + Math.max(line.quantity - line.receivedQuantity, 0),
    0
  );
}

export function ComprasDashboard() {
  const { canView } = useSessionAccess();
  const showRequests = canView("solicitudes_compra");
  const showOrders = canView("pedidos");
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      showRequests ? getPurchaseRequests() : Promise.resolve([]),
      showOrders ? getPurchaseOrders() : Promise.resolve([]),
    ])
      .then(([requestRows, orderRows]) => {
        setRequests(requestRows);
        setOrders(orderRows);
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el dashboard de compras."
        );
      })
      .finally(() => setLoading(false));
  }, [showRequests, showOrders]);

  const stats = useMemo(() => {
    const openRequests = requests.filter((item) =>
      isOpenPurchaseRequest(item.status)
    );
    const waiting = requests.filter((item) => item.status === "solicitada");
    const inPurchase = requests.filter(
      (item) => item.status === "en_compra" || item.status === "pedida"
    );
    const openOrders = orders.filter(
      (order) => order.status !== "recibido" && order.status !== "cancelado"
    );
    const requestedQty = requests.reduce(
      (sum, item) =>
        sum + item.lines.reduce((acc, line) => acc + line.quantityRequested, 0),
      0
    );
    const receivedQty = requests.reduce(
      (sum, item) =>
        sum + item.lines.reduce((acc, line) => acc + line.quantityReceived, 0),
      0
    );
    return {
      openRequests: openRequests.length,
      waiting: waiting.length,
      inPurchase: inPurchase.length,
      openOrders: openOrders.length,
      pendingReceive: openOrders.reduce((sum, order) => sum + pendingQty(order), 0),
      requestedQty,
      receivedQty,
    };
  }, [orders, requests]);

  const kpis: Kpi[] = [
    {
      label: "Solicitudes abiertas",
      value: stats.openRequests,
      hint: `${stats.waiting} sin tomar`,
      href: "/dashboard/compras?tab=solicitudes",
      icon: ClipboardList,
    },
    {
      label: "En compra",
      value: stats.inPurchase,
      hint: "Tomadas o con pedido",
      href: "/dashboard/compras?tab=solicitudes",
      icon: ShoppingCart,
    },
    {
      label: "Pedidos abiertos",
      value: stats.openOrders,
      hint: `${stats.pendingReceive} pzas pendientes de recibir`,
      href: "/dashboard/compras?tab=pedidos",
      icon: PackageCheck,
    },
    {
      label: "Surtimiento",
      value: `${stats.receivedQty}/${stats.requestedQty || 0}`,
      hint: "Recibido vs solicitado por almacén",
      href: "/dashboard/compras?tab=solicitudes",
      icon: Truck,
    },
  ];

  const recent = requests.slice(0, 8);
  const pipeline = [
    { id: "solicitada", label: "Solicitada" },
    { id: "en_compra", label: "En compra" },
    { id: "pedida", label: "Pedida" },
    { id: "parcial", label: "Parcial" },
    { id: "recibida", label: "Recibida" },
  ] as const;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando compras...</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
                </div>
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#00BFFF]/10 text-[#3B46A5]">
                  <Icon className="size-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Avance de la compra</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          De la solicitud de almacén hasta la recepción del surtimiento.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {pipeline.map((step) => {
            const count = requests.filter((item) => item.status === step.id).length;
            return (
              <div
                key={step.id}
                className="rounded-xl border border-border bg-background px-3 py-3"
              >
                <p className="text-xs text-muted-foreground">{step.label}</p>
                <p className="mt-1 text-xl font-semibold">{count}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Solicitudes recientes</h2>
          <Link
            href="/dashboard/compras?tab=solicitudes"
            className="text-xs font-medium text-[#3B46A5] hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Todavía no hay solicitudes de almacén. Cuando no se pueda surtir un
            producto, almacén genera la orden aquí.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.folio}
                    {item.sourceFolio ? ` · ${item.sourceFolio}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.requestedBy || "Almacén"} · {item.lines.length} línea
                    {item.lines.length === 1 ? "" : "s"}
                    {item.purchaseOrderNumber
                      ? ` · ${item.purchaseOrderNumber}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    item.status === "recibida"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : item.status === "solicitada"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                  )}
                >
                  {purchaseRequestStatusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
