"use client";

import { purchasePriorityLabel, purchaseStatusLabel, type PurchasePriority, type PurchaseRequestStatus } from "@/lib/purchasing/types";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<PurchaseRequestStatus, string> = {
  pendiente: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  en_proceso: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ordenada: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  recibida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rechazada: "bg-destructive/10 text-destructive",
  cancelada: "bg-muted text-muted-foreground",
};

export function PurchaseStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_TONES[status])}>
      {purchaseStatusLabel(status)}
    </span>
  );
}

export function PurchasePriorityBadge({ priority }: { priority: PurchasePriority }) {
  if (priority !== "urgente") return null;
  return (
    <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-destructive">
      {purchasePriorityLabel(priority)}
    </span>
  );
}

export function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
