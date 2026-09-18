import { daysUntilExpiry } from "@/lib/inventory/expiry";
import type { InventoryHold } from "./types";

export type HoldDueBucket = "vencido" | "5" | "10" | "15" | "30" | "60";

export const HOLD_DUE_BUCKETS: {
  id: HoldDueBucket;
  label: string;
  maxDays: number;
}[] = [
  { id: "vencido", label: "Vencidos", maxDays: -1 },
  { id: "5", label: "≤ 5 días", maxDays: 5 },
  { id: "10", label: "≤ 10 días", maxDays: 10 },
  { id: "15", label: "≤ 15 días", maxDays: 15 },
  { id: "30", label: "≤ 30 días", maxDays: 30 },
  { id: "60", label: "≤ 60 días", maxDays: 60 },
];

export function holdDueBucket(days: number): HoldDueBucket | null {
  if (days < 0) return "vencido";
  if (days <= 5) return "5";
  if (days <= 10) return "10";
  if (days <= 15) return "15";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return null;
}

export function holdDueTone(bucket: HoldDueBucket | null) {
  switch (bucket) {
    case "vencido":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "5":
      return "bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30";
    case "10":
      return "bg-orange-500/10 text-orange-800 dark:text-orange-200 border-orange-500/30";
    case "15":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30";
    case "30":
      return "bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 border-yellow-500/30";
    case "60":
      return "bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function holdDueLabel(days: number | null, bucket: HoldDueBucket | null) {
  if (days === null || !bucket) return null;
  if (bucket === "vencido") {
    const overdue = Math.abs(days);
    return `Vencido hace ${overdue} ${overdue === 1 ? "día" : "días"}`;
  }
  if (days === 0) return "Vence hoy";
  return `Vence en ${days} ${days === 1 ? "día" : "días"}`;
}

export type HoldDueAlert = InventoryHold & {
  daysUntil: number;
  bucket: HoldDueBucket;
};

export function buildHoldDueAlerts(holds: InventoryHold[]): {
  counts: { id: HoldDueBucket; label: string; count: number }[];
  byBucket: Record<HoldDueBucket, HoldDueAlert[]>;
  alerts: HoldDueAlert[];
} {
  const byBucket: Record<HoldDueBucket, HoldDueAlert[]> = {
    vencido: [],
    "5": [],
    "10": [],
    "15": [],
    "30": [],
    "60": [],
  };

  for (const hold of holds) {
    if (hold.status !== "activo" || !hold.neededBy) continue;
    const days = daysUntilExpiry(hold.neededBy);
    if (days === null) continue;
    const bucket = holdDueBucket(days);
    if (!bucket) continue;
    byBucket[bucket].push({ ...hold, daysUntil: days, bucket });
  }

  for (const bucket of HOLD_DUE_BUCKETS) {
    byBucket[bucket.id].sort((a, b) => a.daysUntil - b.daysUntil);
  }

  return {
    counts: HOLD_DUE_BUCKETS.map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      count: byBucket[bucket.id].length,
    })),
    byBucket,
    alerts: HOLD_DUE_BUCKETS.flatMap((bucket) => byBucket[bucket.id]),
  };
}
