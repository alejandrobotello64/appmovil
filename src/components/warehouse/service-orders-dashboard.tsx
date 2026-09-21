"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  ListChecks,
  Package,
  Wrench,
} from "lucide-react";
import { getServiceOrders } from "@/lib/service-orders/storage";
import { getServiceOrderRequisitions } from "@/lib/service-orders/requisition-storage";
import {
  serviceOrderStatusLabel,
  type ServiceOrder,
} from "@/lib/service-orders/types";
import type { ServiceOrderRequisition } from "@/lib/service-orders/requisitions";
import { cn } from "@/lib/utils";

export function ServiceOrdersDashboard() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [requisitions, setRequisitions] = useState<ServiceOrderRequisition[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([getServiceOrders(), getServiceOrderRequisitions()])
      .then(([orderList, reqList]) => {
        setOrders(orderList);
        setRequisitions(reqList);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el dashboard."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const open = orders.filter(
      (o) => !["entregado", "cancelado"].includes(o.status)
    );
    const waitingParts = orders.filter(
      (o) => o.status === "espera_refacciones"
    ).length;
    const inProcess = orders.filter(
      (o) => o.status === "en_proceso" || o.status === "diagnostico"
    ).length;
    const received = orders.filter((o) => o.status === "recibido").length;
    const openReqs = requisitions.filter(
      (r) => r.status === "solicitada" || r.status === "parcial"
    ).length;
    return {
      open: open.length,
      waitingParts,
      inProcess,
      received,
      openReqs,
      recent: open.slice(0, 8),
    };
  }, [orders, requisitions]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando dashboard…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  const cards = [
    {
      label: "Órdenes abiertas",
      value: stats.open,
      href: "/dashboard/ordenes-servicio?tab=ordenes",
      icon: Wrench,
    },
    {
      label: "En recepción",
      value: stats.received,
      href: "/dashboard/ordenes-servicio?tab=ordenes",
      icon: ClipboardList,
    },
    {
      label: "En proceso / diagnóstico",
      value: stats.inProcess,
      href: "/dashboard/ordenes-servicio?tab=ordenes",
      icon: ListChecks,
    },
    {
      label: "Pedidos a almacén",
      value: stats.openReqs,
      href: "/dashboard/ordenes-servicio?tab=solicitudes",
      icon: Package,
      hint: stats.waitingParts
        ? `${stats.waitingParts} OS en espera de refacciones`
        : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#3B46A5]">
          Dashboard biomédica
        </h2>
        <p className="text-sm text-muted-foreground">
          Resumen de órdenes de servicio e insumos solicitados a almacén.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {card.label}
                </span>
                <Icon className="size-4 text-[#3B46A5]" />
              </div>
              <p className="text-3xl font-semibold tabular-nums">{card.value}</p>
              {card.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
              ) : null}
            </Link>
          );
        })}
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Órdenes recientes abiertas</h3>
          <Link
            href="/dashboard/ordenes-servicio?tab=ordenes"
            className="text-xs text-[#3B46A5] hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay órdenes abiertas por ahora.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recent.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {order.folio} · {order.clientName || "Sin cliente"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {order.equipmentName || "Sin equipo"}
                    {order.equipmentSerial
                      ? ` · Serie ${order.equipmentSerial}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    "bg-muted text-muted-foreground"
                  )}
                >
                  {serviceOrderStatusLabel(order.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
