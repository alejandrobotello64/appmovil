"use client";

import { AlertTriangle, Boxes, Package, PackageX } from "lucide-react";
import type { InventoryItem } from "@/lib/inventory/types";
import { getStockStatus } from "@/lib/inventory/storage";

type InventoryStatsProps = {
  items: InventoryItem[];
};

export function InventoryStats({ items }: InventoryStatsProps) {
  const totalItems = items.length;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const lowStock = items.filter(
    (item) => getStockStatus(item.quantity, item.minStock) === "bajo_stock"
  ).length;
  const outOfStock = items.filter(
    (item) => getStockStatus(item.quantity, item.minStock) === "agotado"
  ).length;

  const cards = [
    {
      label: "Productos registrados",
      value: totalItems,
      icon: Package,
      tone: "text-[#3B46A5]",
    },
    {
      label: "Unidades en stock",
      value: totalUnits,
      icon: Boxes,
      tone: "text-[#00BFFF]",
    },
    {
      label: "Bajo stock",
      value: lowStock,
      icon: AlertTriangle,
      tone: "text-amber-600",
    },
    {
      label: "Agotados",
      value: outOfStock,
      icon: PackageX,
      tone: "text-destructive",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {card.value}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-2.5">
                <Icon className={`size-5 ${card.tone}`} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
